import { Env } from '../../types';
import { jsonResponse, errorResponse } from '../../utils/response';
import { parseBody, extractIdFromPath, QuestionRichTextValidationError } from '../../utils/helpers';
import { verifyJWTMiddleware, requireTeacher } from '../../middleware/jwtAuth';
import { internalErrorResponse } from '../../utils/internalError';
import { canAccessQuiz } from '../../services/quizOwnership';
import {
    CURRENT_MATH_FORMAT_VERSION,
    QuestionMathValidationError,
} from '../../services/questionMath';
import { QuestionScoringContractValidationError } from '../../services/questionScoringContract';
import { buildQuestionInsertStatement, mapQuestionBatch, mathValidationResponse, richTextValidationResponse, scoringContractValidationResponse } from './questionPersistence';
import { inferQuizSourceType, loadQuizUsage, quizConflictResponse } from './quizUsage';

export async function handleCreateQuizRoute(
    request: Request,
    env: Env,
    path: string,
    method: string,
): Promise<Response | null> {
    if (path !== '/api/quizzes' || method !== 'POST') return null;

    const authResult = await verifyJWTMiddleware(request, env);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    if (!requireTeacher(user)) {
        return errorResponse('Forbidden: Teacher or admin access required', 403);
    }

    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');

    const incomingQuestions = Array.isArray(body.questions) ? body.questions : [];
    let mappedQuestions: string[][];
    try {
        // Normalize and validate every question before any D1 statement is executed.
        mappedQuestions = mapQuestionBatch(incomingQuestions, String(body.id || ''));
    } catch (error) {
        if (error instanceof QuestionMathValidationError) return mathValidationResponse(error);
        if (error instanceof QuestionRichTextValidationError) return richTextValidationResponse(error);
        if (error instanceof QuestionScoringContractValidationError) {
            return scoringContractValidationResponse(error);
        }
        throw error;
    }

    try {
        const batch: D1PreparedStatement[] = [];
        const createdBy = user.username;
        const createdAt = body.createdAt || new Date().toISOString();
        const updatedAt = body.updatedAt || createdAt;
        batch.push(
            env.DB.prepare(
                `INSERT INTO quizzes (
                    id, title, class_level, category, time_limit, created_at, access_code, require_code,
                    created_by, show_on_home, tags, source_type, parent_quiz_id, version_number, revision, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                body.id, body.title, body.classLevel, body.category || '',
                body.timeLimit, createdAt, body.accessCode || '',
                body.requireCode ? 'TRUE' : 'FALSE', createdBy,
                body.showOnHome === false ? 'FALSE' : 'TRUE',
                body.tags ? (Array.isArray(body.tags) ? JSON.stringify(body.tags) : body.tags) : '[]',
                inferQuizSourceType(body), body.parentQuizId || null,
                Number(body.versionNumber || 1), 1, updatedAt,
            )
        );

        if (mappedQuestions.length > 0) {
            const stmt = buildQuestionInsertStatement(env.DB);
            mappedQuestions.forEach((mapped) => batch.push(stmt.bind(...mapped)));
        }

        await env.DB.batch(batch);
        return jsonResponse({
            status: 'success',
            questionCount: mappedQuestions.length,
            mathFormatVersion: CURRENT_MATH_FORMAT_VERSION,
            revision: 1,
        });
    } catch (error: unknown) {
        return internalErrorResponse(error, request, { context: 'POST /api/quizzes' });
    }
}

export async function handleUpdateQuizRoute(
    request: Request,
    env: Env,
    path: string,
    method: string,
): Promise<Response | null> {
    if (!path.match(/^\/api\/quizzes\/[^/]+$/) || method !== 'PUT') return null;

    const authResult = await verifyJWTMiddleware(request, env);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    if (!requireTeacher(user)) {
        return errorResponse('Forbidden: Teacher or admin access required', 403);
    }

    const quizId = extractIdFromPath(path, '/api/quizzes');
    if (!quizId) return errorResponse('Missing quiz ID');
    if (!(await canAccessQuiz(env.DB, user, quizId))) {
        return errorResponse('Forbidden: You do not have permission to edit this quiz', 403);
    }

    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');
    if (body.id && String(body.id) !== quizId) {
        return errorResponse('Quiz ID in body must match the URL', 400);
    }

    const [originalQuiz, usage] = await Promise.all([
        env.DB.prepare('SELECT * FROM quizzes WHERE id = ?').bind(quizId).first<import('../../types').Quiz>(),
        loadQuizUsage(env.DB, quizId),
    ]);
    if (!originalQuiz) return errorResponse('Quiz not found', 404);
    if (usage.activeLiveExamCount > 0) {
        return quizConflictResponse(
            'QUIZ_LIVE_EXAM_ACTIVE',
            'Đề đang được sử dụng trong một ca thi trực tiếp và không thể chỉnh sửa.',
            { activeLiveExamCount: usage.activeLiveExamCount },
        );
    }
    if (usage.resultCount > 0) {
        return quizConflictResponse(
            'QUIZ_HAS_SUBMISSIONS',
            'Đề đã có bài nộp. Hãy tạo phiên bản mới để chỉnh sửa.',
            { resultCount: usage.resultCount },
        );
    }

    const currentRevision = Number(originalQuiz.revision || 1);
    if (body.revision !== undefined && Number(body.revision) !== currentRevision) {
        return quizConflictResponse(
            'QUIZ_REVISION_CONFLICT',
            'Đề đã được chỉnh sửa ở một phiên khác. Vui lòng tải lại dữ liệu.',
            { currentRevision },
        );
    }

    const incomingQuestions = Array.isArray(body.questions) ? body.questions : [];
    let mappedQuestions: string[][];
    try {
        // Validate before deleting any existing question rows.
        mappedQuestions = mapQuestionBatch(incomingQuestions, quizId);
    } catch (error) {
        if (error instanceof QuestionMathValidationError) return mathValidationResponse(error);
        if (error instanceof QuestionRichTextValidationError) return richTextValidationResponse(error);
        if (error instanceof QuestionScoringContractValidationError) {
            return scoringContractValidationResponse(error);
        }
        throw error;
    }

    try {
        const nextRevision = currentRevision + 1;
        const updatedAt = new Date().toISOString();
        const batch: D1PreparedStatement[] = [
            env.DB.prepare('DELETE FROM questions WHERE quiz_id = ?').bind(quizId),
            env.DB.prepare(
                `UPDATE quizzes SET
                    title = ?, class_level = ?, category = ?, time_limit = ?, access_code = ?, require_code = ?,
                    show_on_home = ?, tags = ?, source_type = ?, parent_quiz_id = ?, version_number = ?,
                    revision = ?, updated_at = ?
                 WHERE id = ?`
            ).bind(
                body.title, body.classLevel, body.category || '', body.timeLimit,
                body.accessCode || '', body.requireCode ? 'TRUE' : 'FALSE',
                body.showOnHome === false ? 'FALSE' : 'TRUE',
                body.tags ? (Array.isArray(body.tags) ? JSON.stringify(body.tags) : body.tags) : '[]',
                body.sourceType || originalQuiz.source_type || 'manual',
                body.parentQuizId ?? originalQuiz.parent_quiz_id ?? null,
                Number(body.versionNumber || originalQuiz.version_number || 1),
                nextRevision, updatedAt, quizId,
            ),
        ];

        if (mappedQuestions.length > 0) {
            const stmt = buildQuestionInsertStatement(env.DB);
            mappedQuestions.forEach((mapped) => batch.push(stmt.bind(...mapped)));
        }

        await env.DB.batch(batch);

        const countResult = await env.DB.prepare('SELECT COUNT(*) as cnt FROM questions WHERE quiz_id = ?')
            .bind(quizId)
            .first<{ cnt: number }>();
        const actualCount = countResult?.cnt || 0;
        if (actualCount !== mappedQuestions.length) {
            return internalErrorResponse(
                new Error(`Save verification failed: expected ${mappedQuestions.length}, actual ${actualCount}`),
                request,
                { context: `PUT /api/quizzes/${quizId} verification` },
            );
        }

        return jsonResponse({
            status: 'success',
            questionCount: actualCount,
            mathFormatVersion: CURRENT_MATH_FORMAT_VERSION,
            revision: nextRevision,
            updatedAt,
        });
    } catch (error: unknown) {
        return internalErrorResponse(error, request, { context: `PUT /api/quizzes/${quizId}` });
    }
}

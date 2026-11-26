import { Env } from '../../types';
import { jsonResponse, errorResponse, generateId } from '../../utils/response';
import { parseBody, QuestionRichTextValidationError } from '../../utils/helpers';
import { verifyJWTMiddleware, requireTeacher } from '../../middleware/jwtAuth';
import { internalErrorResponse } from '../../utils/internalError';
import { canAccessQuiz } from '../../services/quizOwnership';
import { CURRENT_MATH_FORMAT_VERSION, QuestionMathValidationError } from '../../services/questionMath';
import { buildQuestionInsertStatement, copiedQuestionValues, mathValidationResponse, richTextValidationResponse } from './questionPersistence';

export async function handleVersionRoute(
    request: Request,
    env: Env,
    path: string,
    method: string,
): Promise<Response | null> {
    if (!path.match(/^\/api\/quizzes\/[^/]+\/versions$/) || method !== 'POST') return null;

    const authResult = await verifyJWTMiddleware(request, env);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;
    if (!requireTeacher(user)) return errorResponse('Forbidden: Teacher or admin access required', 403);

    const quizId = path.split('/')[3];
    if (!quizId) return errorResponse('Missing quiz ID');
    if (!(await canAccessQuiz(env.DB, user, quizId))) {
        return errorResponse('Forbidden: You do not have permission to create a version of this quiz', 403);
    }

    try {
        const originalQuiz = await env.DB.prepare('SELECT * FROM quizzes WHERE id = ?')
            .bind(quizId)
            .first<import('../../types').Quiz>();
        if (!originalQuiz) return errorResponse('Quiz not found', 404);

        const [originalQuestions, body] = await Promise.all([
            env.DB.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY rowid ASC')
                .bind(quizId)
                .all<import('../../types').Question>(),
            parseBody(request),
        ]);
        const rootQuizId = originalQuiz.parent_quiz_id || originalQuiz.id;
        const versionRow = await env.DB.prepare(
            'SELECT MAX(version_number) AS max_version FROM quizzes WHERE id = ? OR parent_quiz_id = ?'
        ).bind(rootQuizId, rootQuizId).first<{ max_version: number }>();
        const versionNumber = Number(versionRow?.max_version || originalQuiz.version_number || 1) + 1;
        const newQuizId = generateId('quiz');
        const createdAt = new Date().toISOString();
        const newTitle = String(body?.title || `${originalQuiz.title} - Phiên bản ${versionNumber}`);

        let copiedValues: string[][];
        try {
            copiedValues = originalQuestions.results.map((question) =>
                copiedQuestionValues(question, generateId('q'), newQuizId));
        } catch (error) {
            if (error instanceof QuestionMathValidationError) return mathValidationResponse(error);
            if (error instanceof QuestionRichTextValidationError) return richTextValidationResponse(error);
            throw error;
        }

        const batch: D1PreparedStatement[] = [
            env.DB.prepare(
                `INSERT INTO quizzes (
                    id, title, class_level, category, time_limit, created_at, access_code, require_code,
                    created_by, show_on_home, tags, source_type, parent_quiz_id, version_number, revision, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                newQuizId, newTitle, originalQuiz.class_level, originalQuiz.category || '',
                originalQuiz.time_limit, createdAt, '', originalQuiz.require_code || 'FALSE',
                user.username, 'FALSE', originalQuiz.tags || '[]', originalQuiz.source_type || 'manual',
                rootQuizId, versionNumber, 1, createdAt,
            ),
        ];
        if (copiedValues.length > 0) {
            const stmt = buildQuestionInsertStatement(env.DB);
            copiedValues.forEach((mapped) => batch.push(stmt.bind(...mapped)));
        }
        await env.DB.batch(batch);

        return jsonResponse({
            status: 'success',
            data: {
                id: newQuizId,
                title: newTitle,
                parentQuizId: rootQuizId,
                versionNumber,
                revision: 1,
                questionCount: copiedValues.length,
            },
        });
    } catch (error: unknown) {
        return internalErrorResponse(error, request, {
            context: `POST /api/quizzes/${quizId}/versions`,
        });
    }
}

export async function handleDuplicateRoute(
    request: Request,
    env: Env,
    path: string,
    method: string,
): Promise<Response | null> {
    if (!path.match(/^\/api\/quizzes\/[^/]+\/duplicate$/) || method !== 'POST') return null;

    const authResult = await verifyJWTMiddleware(request, env);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    if (!requireTeacher(user)) {
        return errorResponse('Forbidden: Teacher or admin access required', 403);
    }

    const quizId = path.split('/')[3];
    if (!quizId) return errorResponse('Missing quiz ID');
    if (!(await canAccessQuiz(env.DB, user, quizId))) {
        return errorResponse('Forbidden: You do not have permission to duplicate this quiz', 403);
    }

    try {
        const originalQuiz = await env.DB.prepare('SELECT * FROM quizzes WHERE id = ?')
            .bind(quizId)
            .first<import('../../types').Quiz>();
        if (!originalQuiz) return errorResponse('Quiz not found', 404);

        const originalQuestions = await env.DB.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY rowid ASC')
            .bind(quizId)
            .all<import('../../types').Question>();
        const newQuizId = generateId('quiz');
        const createdAt = new Date().toISOString();
        const newTitle = `Bản sao của ${originalQuiz.title}`;

        let copiedValues: string[][];
        try {
            copiedValues = originalQuestions.results.map((question) =>
                copiedQuestionValues(question, generateId('q'), newQuizId));
        } catch (error) {
            if (error instanceof QuestionMathValidationError) return mathValidationResponse(error);
            if (error instanceof QuestionRichTextValidationError) return richTextValidationResponse(error);
            throw error;
        }

        const batch: D1PreparedStatement[] = [
            env.DB.prepare(
                `INSERT INTO quizzes (
                    id, title, class_level, category, time_limit, created_at, access_code, require_code,
                    created_by, show_on_home, tags, source_type, parent_quiz_id, version_number, revision, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                newQuizId, newTitle, originalQuiz.class_level, originalQuiz.category || '',
                originalQuiz.time_limit, createdAt, '', originalQuiz.require_code || 'FALSE',
                user.username, 'FALSE', originalQuiz.tags || '[]', 'duplicated', null, 1, 1, createdAt,
            ),
        ];
        if (copiedValues.length > 0) {
            const stmt = buildQuestionInsertStatement(env.DB);
            copiedValues.forEach((mapped) => batch.push(stmt.bind(...mapped)));
        }
        await env.DB.batch(batch);

        return jsonResponse({
            status: 'success',
            data: {
                id: newQuizId,
                title: newTitle,
                classLevel: originalQuiz.class_level,
                category: originalQuiz.category || '',
                timeLimit: originalQuiz.time_limit,
                createdAt,
                questionCount: copiedValues.length,
                mathFormatVersion: CURRENT_MATH_FORMAT_VERSION,
            },
        });
    } catch (error: unknown) {
        return internalErrorResponse(error, request, {
            context: `POST /api/quizzes/${quizId}/duplicate`,
        });
    }
}

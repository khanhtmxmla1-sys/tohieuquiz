// Quizzes + Questions API Routes
// GET /api/quizzes - List all quizzes (PUBLIC)
// GET /api/questions - Public DTOs exclude answer fields; teachers receive scoped full data
// POST /api/quizzes - Create quiz (TEACHER/ADMIN)
// PUT /api/quizzes/:id - Update quiz (TEACHER/ADMIN with ownership check)
// DELETE /api/quizzes/:id - Delete quiz (TEACHER/ADMIN with ownership check)
// POST /api/quizzes/:id/duplicate - Duplicate quiz (TEACHER/ADMIN)

import { Env } from '../types';
import { jsonResponse, errorResponse, generateId } from '../utils/response';
import { mapQuestionForSave, parseBody, extractIdFromPath } from '../utils/helpers';
import { verifyJWTMiddleware, requireAdmin, requireTeacher } from '../middleware/jwtAuth';
import { JWTPayload } from '../utils/jwt';
import { withD1Retry } from '../utils/d1';
import { internalErrorResponse } from '../utils/internalError';
import {
    loadTeacherQuizOwnerIdentity,
    quizOwnerMatchesIdentity,
    teacherQuizOwnerQueryValues,
} from '../services/quizOwnership';
import {
    auditPersistedQuestionRow,
    CURRENT_MATH_FORMAT_VERSION,
    normalizePersistedQuestionRow,
    QuestionMathValidationError,
    type PersistedQuestionRow,
} from '../services/questionMath';
import { QuestionScoringContractValidationError } from '../services/questionScoringContract';
import { z } from 'zod';

const canAccessQuiz = async (db: D1Database, user: JWTPayload, quizId: string): Promise<boolean> => {
    if (requireAdmin(user)) return true;
    if (user.role !== 'teacher') return false;

    const [quiz, identity] = await Promise.all([
        db.prepare('SELECT created_by FROM quizzes WHERE id = ?').bind(quizId).first<{ created_by: string }>(),
        loadTeacherQuizOwnerIdentity(db, user.username),
    ]);
    if (!quiz || !identity) return false;

    return quizOwnerMatchesIdentity(quiz.created_by, identity);
};

const parseJsonArray = (value: unknown): any[] => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const quizAccessCodeSchema = z.object({
    accessCode: z.string().trim().min(1).max(10).regex(/^[A-Za-z0-9]+$/),
});

const isEnabledFlag = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value ?? '').trim().toLowerCase());
};

const constantTimeTextEqual = (actual: string, expected: string): boolean => {
    const encoder = new TextEncoder();
    const actualBytes = encoder.encode(actual);
    const expectedBytes = encoder.encode(expected);
    const maxLength = Math.max(actualBytes.length, expectedBytes.length);
    let difference = actualBytes.length ^ expectedBytes.length;
    for (let index = 0; index < maxLength; index += 1) {
        difference |= (actualBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
    }
    return difference === 0;
};

export const sanitizeQuizForStudent = (
    quiz: Record<string, unknown>,
): Record<string, unknown> => {
    const safeQuiz = { ...quiz };
    delete safeQuiz.access_code;
    delete safeQuiz.accessCode;
    return safeQuiz;
};

const shuffle = <T>(values: T[]): T[] => {
    const output = [...values];
    for (let i = output.length - 1; i > 0; i--) {
        const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
        [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
};

const buildQuestionInsertStatement = (db: D1Database) => db.prepare(
    `INSERT INTO questions (
        id, quiz_id, type, question, options, correct_answer, items, text_field,
        blanks, distractors, sentence, words, correct_word_indexes, image, tags,
        subject, skill_code, subskill_code, difficulty, math_format_version, points, explanation, image_alt,
        answer_schema_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const mapQuestionBatch = (questions: unknown[], quizId: string): string[][] =>
    questions.map((question) => mapQuestionForSave(
        question as Partial<import('../types').Question> & { type: string },
        quizId,
    ));

const mathValidationResponse = (error: QuestionMathValidationError): Response => jsonResponse({
    status: 'error',
    code: 'INVALID_MATH_NOTATION',
    message: 'Một hoặc nhiều trường công thức toán học chưa hợp lệ.',
    issues: error.issues.map((issue) => ({
        field: issue.field,
        code: issue.code,
        message: issue.message,
        index: issue.index,
    })),
}, 400);

const scoringContractValidationResponse = (
    error: QuestionScoringContractValidationError,
): Response => jsonResponse({
    status: 'error',
    code: 'INVALID_QUESTION_SCORING_CONTRACT',
    message: 'Một hoặc nhiều câu hỏi chưa có hợp đồng đáp án hợp lệ để chấm tự động.',
    issues: error.issues,
}, 400);

const copiedQuestionValues = (
    question: import('../types').Question,
    newQuestionId: string,
    newQuizId: string,
): string[] => {
    const persisted = question as unknown as PersistedQuestionRow;
    const audit = auditPersistedQuestionRow(persisted);
    if (audit.remainingIssues.length > 0) {
        throw new QuestionMathValidationError(audit.remainingIssues);
    }
    const normalized = normalizePersistedQuestionRow(persisted);
    return [
        newQuestionId,
        newQuizId,
        question.type,
        String(normalized.question ?? ''),
        String(normalized.options ?? ''),
        String(normalized.correct_answer ?? ''),
        String(normalized.items ?? ''),
        String(normalized.text_field ?? ''),
        String(normalized.blanks ?? ''),
        String(normalized.distractors ?? ''),
        String(normalized.sentence ?? ''),
        String(normalized.words ?? ''),
        String(normalized.correct_word_indexes ?? ''),
        question.image || '',
        question.tags || '',
        question.subject || '',
        question.skill_code || '',
        question.subskill_code || '',
        String(question.difficulty || ''),
        String(CURRENT_MATH_FORMAT_VERSION),
        question.points === undefined || question.points === null ? '' : String(question.points),
        question.explanation || '',
        String((question as import('../types').Question & { imageAlt?: string; image_alt?: string }).imageAlt
            ?? (question as import('../types').Question & { imageAlt?: string; image_alt?: string }).image_alt
            ?? ''),
        String(question.answer_schema_version || 1),
    ];
};

interface QuizUsage {
    resultCount: number;
    activeLiveExamCount: number;
    openAssignmentCount: number;
}

const readCount = (row: { count?: number } | null): number => Number(row?.count || 0);

const loadQuizUsage = async (db: D1Database, quizId: string): Promise<QuizUsage> => {
    const [results, liveExams, assignments] = await Promise.all([
        db.prepare('SELECT COUNT(*) AS count FROM results WHERE quiz_id = ?').bind(quizId).first<{ count: number }>(),
        db.prepare(`
            SELECT COUNT(*) AS count
            FROM live_exam_sessions WHERE quiz_id = ? AND status IN ('waiting', 'active', 'scoring')
        `).bind(quizId).first<{ count: number }>(),
        db.prepare("SELECT COUNT(*) AS count FROM assignments WHERE quiz_id = ? AND status = 'OPEN'")
            .bind(quizId).first<{ count: number }>(),
    ]);
    return {
        resultCount: readCount(results),
        activeLiveExamCount: readCount(liveExams),
        openAssignmentCount: readCount(assignments),
    };
};

const buildQuizEditability = (usage: QuizUsage) => {
    const reason = usage.activeLiveExamCount > 0
        ? 'LIVE_EXAM_ACTIVE'
        : usage.resultCount > 0
            ? 'HAS_SUBMISSIONS'
            : null;
    const canEditStructure = reason === null;
    return {
        mode: canEditStructure ? 'EDIT' : 'READONLY',
        canEditStructure,
        canCreateVersion: true,
        reason,
        requiresPublishedWarning: canEditStructure && usage.openAssignmentCount > 0,
        ...usage,
    };
};

const quizConflictResponse = (
    code: string,
    message: string,
    details: Record<string, unknown> = {},
): Response => jsonResponse({ status: 'error', code, message, ...details }, 409);

const inferQuizSourceType = (body: Record<string, any>): string => {
    const requested = String(body.sourceType || body.source_type || '').trim();
    if (requested) return requested;
    return body.aiGeneration ? 'ai' : 'manual';
};

const toEditorQuizDto = (quiz: import('../types').Quiz) => ({
    id: quiz.id,
    title: quiz.title,
    classLevel: quiz.class_level,
    category: quiz.category || '',
    timeLimit: quiz.time_limit,
    createdAt: quiz.created_at,
    updatedAt: quiz.updated_at || quiz.created_at,
    createdBy: quiz.created_by || '',
    accessCode: quiz.access_code || undefined,
    requireCode: String(quiz.require_code || '').toUpperCase() === 'TRUE',
    showOnHome: String(quiz.show_on_home || 'TRUE').toUpperCase() !== 'FALSE',
    tags: (() => {
        try { return JSON.parse(quiz.tags || '[]'); } catch { return []; }
    })(),
    sourceType: quiz.source_type || 'manual',
    parentQuizId: quiz.parent_quiz_id || null,
    versionNumber: Number(quiz.version_number || 1),
    revision: Number(quiz.revision || 1),
});

export const sanitizeQuestionForStudent = (question: any): any => {
    const safe = { ...question };
    for (const field of [
        'correct_answer', 'correctAnswer', 'correct_answers', 'correctAnswers',
        'explanation',
        'correct_order', 'correctOrder', 'correct_word_indexes', 'correctWordIndexes',
        'correct_word', 'correctWord', 'wrong_word', 'wrongWord',
    ]) delete safe[field];

    const type = String(question.type || '').toUpperCase();
    const items = parseJsonArray(question.items);
    if (type === 'MATCHING' && items.some((item) => item && typeof item === 'object' && 'left' in item && 'right' in item)) {
        safe.items = '[]';
        safe.left_items = JSON.stringify(items.map((item, index) => ({
            id: `left-${index}`,
            content: String(item.left),
        })));
        safe.right_items = JSON.stringify(shuffle(items.map((item, index) => ({
            id: `right-${index}`,
            content: String(item.right),
        }))));
    } else if (items.length > 0) {
        safe.items = JSON.stringify(items.map((item) => {
            if (!item || typeof item !== 'object') return item;
            const { isCorrect, isTrue, correct, answer, categoryId, ...rest } = item;
            return rest;
        }));
    }

    const blanks = parseJsonArray(question.blanks);
    if (type === 'DRAG_DROP') {
        const normalizedBlanks = blanks.map((blank, index) => {
            if (blank && typeof blank === 'object') {
                return {
                    id: String(blank.id || `blank-${index}`),
                    correctAnswer: String(blank.correctAnswer ?? blank.answer ?? ''),
                };
            }
            return { id: `blank-${index}`, correctAnswer: String(blank ?? '') };
        });
        const correctChoices = normalizedBlanks.map((blank) => blank.correctAnswer).filter(Boolean);
        const distractors = parseJsonArray(question.distractors).map((item) => String(item ?? '')).filter(Boolean);
        const originalText = String(question.text_field ?? question.text ?? '');
        let placeholderIndex = 0;
        const safeText = originalText.replace(/\[[^\]]*\]/g, () => `[${++placeholderIndex}]`);
        safe.text_field = safeText;
        if ('text' in safe) safe.text = safeText;
        safe.blanks = JSON.stringify(normalizedBlanks.map((blank) => ({ id: blank.id })));
        safe.distractors = JSON.stringify(shuffle([...correctChoices, ...distractors]));
    } else if (blanks.length > 0 && blanks.some((blank) => blank && typeof blank === 'object')) {
        safe.blanks = JSON.stringify(blanks.map((blank) => {
            if (!blank || typeof blank !== 'object') return blank;
            const { correctAnswer, answer, ...rest } = blank;
            return rest;
        }));
    }
    if (type === 'ERROR_CORRECTION') delete safe.distractors;
    return safe;
};

export async function handleQuizRoutes(request: Request, env: Env, path: string, method: string): Promise<Response> {
    const db = env.DB;

    // POST /api/quizzes/access-verification/:quizId
    const accessVerificationMatch = path.match(/^\/api\/quizzes\/access-verification\/([^/]+)$/);
    if (accessVerificationMatch && method === 'POST') {
        let quizId = '';
        try {
            quizId = decodeURIComponent(accessVerificationMatch[1]).trim();
        } catch {
            return jsonResponse({
                status: 'error',
                code: 'INVALID_ACCESS_CODE_FORMAT',
                message: 'Mã làm bài chưa đúng định dạng.',
            }, 400);
        }

        const body = await parseBody(request);
        const parsed = quizAccessCodeSchema.safeParse(body);
        if (!quizId || !parsed.success) {
            return jsonResponse({
                status: 'error',
                code: 'INVALID_ACCESS_CODE_FORMAT',
                message: 'Mã làm bài chưa đúng định dạng.',
            }, 400);
        }

        const quiz = await db.prepare(
            'SELECT access_code, require_code FROM quizzes WHERE id = ?',
        ).bind(quizId).first<{
            access_code?: string | null;
            require_code?: string | number | boolean | null;
        }>();

        if (!quiz) {
            return jsonResponse({ valid: false, error: 'INVALID_ACCESS_CODE' }, 403);
        }
        if (!isEnabledFlag(quiz.require_code)) {
            return jsonResponse({ valid: true });
        }

        const actualCode = parsed.data.accessCode.toUpperCase();
        const expectedCode = String(quiz.access_code ?? '').trim().toUpperCase();
        if (!expectedCode || !constantTimeTextEqual(actualCode, expectedCode)) {
            return jsonResponse({ valid: false, error: 'INVALID_ACCESS_CODE' }, 403);
        }
        return jsonResponse({ valid: true });
    }

    // GET /api/quizzes
    if (path === '/api/quizzes' && method === 'GET') {
        const authResult = await verifyJWTMiddleware(request, env);
        const user: JWTPayload | null = authResult instanceof Response ? null : authResult.user;
        const rows = await withD1Retry(
            () => db.prepare('SELECT * FROM quizzes').all<import('../types').Quiz>(),
            'GET /api/quizzes'
        );
        const quizzes = user && requireTeacher(user)
            ? rows.results
            : rows.results.map((quiz) => sanitizeQuizForStudent(quiz as unknown as Record<string, unknown>));
        return jsonResponse(quizzes);
    }

    // GET /api/quizzes/:id/editor - Unified editor payload and editability contract
    if (path.match(/^\/api\/quizzes\/[^/]+\/editor$/) && method === 'GET') {
        const authResult = await verifyJWTMiddleware(request, env);
        if (authResult instanceof Response) return authResult;
        const { user } = authResult;
        if (!requireTeacher(user)) return errorResponse('Forbidden: Teacher or admin access required', 403);

        const quizId = path.split('/')[3];
        if (!quizId) return errorResponse('Missing quiz ID');
        if (!(await canAccessQuiz(db, user, quizId))) {
            return errorResponse('Forbidden: You do not have permission to edit this quiz', 403);
        }

        const [quiz, questions, usage] = await Promise.all([
            db.prepare('SELECT * FROM quizzes WHERE id = ?').bind(quizId).first<import('../types').Quiz>(),
            db.prepare('SELECT * FROM questions WHERE quiz_id = ?').bind(quizId).all<import('../types').Question>(),
            loadQuizUsage(db, quizId),
        ]);
        if (!quiz) return errorResponse('Quiz not found', 404);

        return jsonResponse({
            quiz: toEditorQuizDto(quiz),
            questions: questions.results,
            editability: buildQuizEditability(usage),
        });
    }

    // GET /api/questions
    if (path === '/api/questions' && method === 'GET') {
        const authResult = await verifyJWTMiddleware(request, env);
        const user: JWTPayload | null = authResult instanceof Response ? null : authResult.user;

        const url = new URL(request.url);
        const quizId = url.searchParams.get('quizId');

        if (user && quizId && requireTeacher(user) && !(await canAccessQuiz(db, user, quizId))) {
            return errorResponse('Forbidden: You do not have permission to read this quiz', 403);
        }

        let rows: { results: any[] };
        if (!user && quizId) {
            rows = await withD1Retry(
                () => db.prepare(`
                    SELECT q.*
                    FROM questions q
                    JOIN quizzes z ON z.id = q.quiz_id
                    WHERE q.quiz_id = ?
                      AND UPPER(COALESCE(z.show_on_home, 'FALSE')) = 'TRUE'
                `).bind(quizId).all<any>(),
                'GET /api/questions public quiz',
            );
        } else if (!user) {
            rows = await withD1Retry(
                () => db.prepare(`
                    SELECT q.*
                    FROM questions q
                    JOIN quizzes z ON z.id = q.quiz_id
                    WHERE UPPER(COALESCE(z.show_on_home, 'FALSE')) = 'TRUE'
                `).all<any>(),
                'GET /api/questions public catalog',
            );
        } else if (quizId) {
            rows = await withD1Retry(
                () => db.prepare('SELECT * FROM questions WHERE quiz_id = ?').bind(quizId).all<any>(),
                'GET /api/questions by quizId',
            );
        } else if (requireAdmin(user)) {
            rows = await withD1Retry(() => db.prepare('SELECT * FROM questions').all<any>(), 'GET /api/questions admin');
        } else if (user.role === 'teacher') {
            const identity = await loadTeacherQuizOwnerIdentity(db, user.username);
            if (!identity) return errorResponse('Teacher not found', 404);
            rows = await withD1Retry(
                () => db.prepare(`
                    SELECT q.*
                    FROM questions q
                    JOIN quizzes z ON z.id = q.quiz_id
                    WHERE LOWER(TRIM(z.created_by)) = LOWER(TRIM(?))
                       OR (? IS NOT NULL AND LOWER(TRIM(z.created_by)) = LOWER(TRIM(?)))
                `).bind(...teacherQuizOwnerQueryValues(identity)).all<any>(),
                'GET /api/questions teacher',
            );
        } else {
            rows = await withD1Retry(
                () => db.prepare('SELECT * FROM questions').all<any>(),
                'GET /api/questions student catalog',
            );
        }

        const mustSanitize = !user || user.role === 'student';
        return jsonResponse(mustSanitize ? rows.results.map(sanitizeQuestionForStudent) : rows.results);
    }

    // POST /api/quizzes - Create quiz (TEACHER/ADMIN only)
    if (path === '/api/quizzes' && method === 'POST') {
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
                db.prepare(
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
                const stmt = buildQuestionInsertStatement(db);
                mappedQuestions.forEach((mapped) => batch.push(stmt.bind(...mapped)));
            }

            await db.batch(batch);
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

    // PUT /api/quizzes/:id - Update quiz with ownership, usage locks, and optimistic revision control
    if (path.match(/^\/api\/quizzes\/[^/]+$/) && method === 'PUT') {
        const authResult = await verifyJWTMiddleware(request, env);
        if (authResult instanceof Response) return authResult;
        const { user } = authResult;

        if (!requireTeacher(user)) {
            return errorResponse('Forbidden: Teacher or admin access required', 403);
        }

        const quizId = extractIdFromPath(path, '/api/quizzes');
        if (!quizId) return errorResponse('Missing quiz ID');
        if (!(await canAccessQuiz(db, user, quizId))) {
            return errorResponse('Forbidden: You do not have permission to edit this quiz', 403);
        }

        const body = await parseBody(request);
        if (!body) return errorResponse('Invalid JSON body');
        if (body.id && String(body.id) !== quizId) {
            return errorResponse('Quiz ID in body must match the URL', 400);
        }

        const [originalQuiz, usage] = await Promise.all([
            db.prepare('SELECT * FROM quizzes WHERE id = ?').bind(quizId).first<import('../types').Quiz>(),
            loadQuizUsage(db, quizId),
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
            if (error instanceof QuestionScoringContractValidationError) {
                return scoringContractValidationResponse(error);
            }
            throw error;
        }

        try {
            const nextRevision = currentRevision + 1;
            const updatedAt = new Date().toISOString();
            const batch: D1PreparedStatement[] = [
                db.prepare('DELETE FROM questions WHERE quiz_id = ?').bind(quizId),
                db.prepare(
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
                const stmt = buildQuestionInsertStatement(db);
                mappedQuestions.forEach((mapped) => batch.push(stmt.bind(...mapped)));
            }

            await db.batch(batch);

            const countResult = await db.prepare('SELECT COUNT(*) as cnt FROM questions WHERE quiz_id = ?')
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

    // POST /api/quizzes/:id/versions - Create an editable successor without copying attempts or assignments
    if (path.match(/^\/api\/quizzes\/[^/]+\/versions$/) && method === 'POST') {
        const authResult = await verifyJWTMiddleware(request, env);
        if (authResult instanceof Response) return authResult;
        const { user } = authResult;
        if (!requireTeacher(user)) return errorResponse('Forbidden: Teacher or admin access required', 403);

        const quizId = path.split('/')[3];
        if (!quizId) return errorResponse('Missing quiz ID');
        if (!(await canAccessQuiz(db, user, quizId))) {
            return errorResponse('Forbidden: You do not have permission to create a version of this quiz', 403);
        }

        try {
            const originalQuiz = await db.prepare('SELECT * FROM quizzes WHERE id = ?')
                .bind(quizId)
                .first<import('../types').Quiz>();
            if (!originalQuiz) return errorResponse('Quiz not found', 404);

            const [originalQuestions, body] = await Promise.all([
                db.prepare('SELECT * FROM questions WHERE quiz_id = ?')
                    .bind(quizId)
                    .all<import('../types').Question>(),
                parseBody(request),
            ]);
            const rootQuizId = originalQuiz.parent_quiz_id || originalQuiz.id;
            const versionRow = await db.prepare(
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
                throw error;
            }

            const batch: D1PreparedStatement[] = [
                db.prepare(
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
                const stmt = buildQuestionInsertStatement(db);
                copiedValues.forEach((mapped) => batch.push(stmt.bind(...mapped)));
            }
            await db.batch(batch);

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

    // POST /api/quizzes/:id/duplicate - Duplicate quiz with all questions (TEACHER/ADMIN)
    if (path.match(/^\/api\/quizzes\/[^/]+\/duplicate$/) && method === 'POST') {
        const authResult = await verifyJWTMiddleware(request, env);
        if (authResult instanceof Response) return authResult;
        const { user } = authResult;

        if (!requireTeacher(user)) {
            return errorResponse('Forbidden: Teacher or admin access required', 403);
        }

        const quizId = path.split('/')[3];
        if (!quizId) return errorResponse('Missing quiz ID');
        if (!(await canAccessQuiz(db, user, quizId))) {
            return errorResponse('Forbidden: You do not have permission to duplicate this quiz', 403);
        }

        try {
            const originalQuiz = await db.prepare('SELECT * FROM quizzes WHERE id = ?')
                .bind(quizId)
                .first<import('../types').Quiz>();
            if (!originalQuiz) return errorResponse('Quiz not found', 404);

            const originalQuestions = await db.prepare('SELECT * FROM questions WHERE quiz_id = ?')
                .bind(quizId)
                .all<import('../types').Question>();
            const newQuizId = generateId('quiz');
            const createdAt = new Date().toISOString();
            const newTitle = `Bản sao của ${originalQuiz.title}`;

            // Normalize all copied rows before creating the destination quiz.
            let copiedValues: string[][];
            try {
                copiedValues = originalQuestions.results.map((question) =>
                    copiedQuestionValues(question, generateId('q'), newQuizId));
            } catch (error) {
                if (error instanceof QuestionMathValidationError) return mathValidationResponse(error);
                throw error;
            }

            const batch: D1PreparedStatement[] = [
                db.prepare(
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
                const stmt = buildQuestionInsertStatement(db);
                copiedValues.forEach((mapped) => batch.push(stmt.bind(...mapped)));
            }
            await db.batch(batch);

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

    // DELETE /api/quizzes/:id (TEACHER/ADMIN with ownership check)
    if (path.startsWith('/api/quizzes/') && method === 'DELETE') {
        const authResult = await verifyJWTMiddleware(request, env);
        if (authResult instanceof Response) return authResult;
        const { user } = authResult;

        if (!requireTeacher(user)) {
            return errorResponse('Forbidden: Teacher or admin access required', 403);
        }

        const quizId = extractIdFromPath(path, '/api/quizzes');
        if (!quizId) return errorResponse('Missing quiz ID');

        // Check ownership
        if (!(await canAccessQuiz(db, user, quizId))) {
            return errorResponse('Forbidden: You do not have permission to delete this quiz', 403);
        }

        await db.prepare('DELETE FROM questions WHERE quiz_id = ?').bind(quizId).run();
        await db.prepare('DELETE FROM quizzes WHERE id = ?').bind(quizId).run();
        return jsonResponse({ status: 'success' });
    }

    return errorResponse('Not found: ' + path, 404);
}

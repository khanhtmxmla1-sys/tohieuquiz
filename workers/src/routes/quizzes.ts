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
        subject, skill_code, subskill_code, difficulty, math_format_version, points, explanation, image_alt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    ];
};

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
        safe.left_items = JSON.stringify(items.map((item) => ({ id: String(item.left), content: String(item.left) })));
        safe.right_items = JSON.stringify(shuffle(items.map((item) => ({ id: String(item.right), content: String(item.right) }))));
    } else if (items.length > 0) {
        safe.items = JSON.stringify(items.map((item) => {
            if (!item || typeof item !== 'object') return item;
            const { isCorrect, isTrue, correct, answer, categoryId, ...rest } = item;
            return rest;
        }));
    }

    const blanks = parseJsonArray(question.blanks);
    if (type === 'DRAG_DROP') {
        const correctChoices = blanks.map((blank) => String(blank ?? '')).filter(Boolean);
        const distractors = parseJsonArray(question.distractors).map((item) => String(item ?? '')).filter(Boolean);
        const originalText = String(question.text_field ?? question.text ?? '');
        let placeholderIndex = 0;
        const safeText = originalText.replace(/\[[^\]]*\]/g, () => `[${++placeholderIndex}]`);
        safe.text_field = safeText;
        if ('text' in safe) safe.text = safeText;
        safe.blanks = '[]';
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

    // GET /api/quizzes
    if (path === '/api/quizzes' && method === 'GET') {
        const rows = await withD1Retry(
            () => db.prepare('SELECT * FROM quizzes').all<import('../types').Quiz>(),
            'GET /api/quizzes'
        );
        return jsonResponse(rows.results);
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
            throw error;
        }

        try {
            const batch: D1PreparedStatement[] = [];
            const createdBy = user.username;
            batch.push(
                db.prepare(
                    `INSERT INTO quizzes (id, title, class_level, category, time_limit, created_at, access_code, require_code, created_by, show_on_home, tags)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    body.id, body.title, body.classLevel, body.category || '',
                    body.timeLimit, body.createdAt, body.accessCode || '',
                    body.requireCode ? 'TRUE' : 'FALSE', createdBy,
                    body.showOnHome === false ? 'FALSE' : 'TRUE',
                    body.tags ? (Array.isArray(body.tags) ? JSON.stringify(body.tags) : body.tags) : '[]'
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
            });
        } catch (error: unknown) {
            return internalErrorResponse(error, request, { context: 'POST /api/quizzes' });
        }
    }

    // PUT /api/quizzes/:id - Update quiz (TEACHER/ADMIN with ownership check)
    if (path.startsWith('/api/quizzes/') && method === 'PUT') {
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

        const incomingQuestions = Array.isArray(body.questions) ? body.questions : [];
        let mappedQuestions: string[][];
        try {
            // This must happen before destructive replacement so invalid TeX cannot erase the existing quiz.
            mappedQuestions = mapQuestionBatch(incomingQuestions, quizId);
        } catch (error) {
            if (error instanceof QuestionMathValidationError) return mathValidationResponse(error);
            throw error;
        }

        try {
            const originalQuiz = await db.prepare('SELECT created_by FROM quizzes WHERE id = ?')
                .bind(quizId)
                .first<{ created_by: string }>();
            const createdBy = originalQuiz?.created_by || user.username;
            const batch: D1PreparedStatement[] = [
                db.prepare('DELETE FROM questions WHERE quiz_id = ?').bind(quizId),
                db.prepare('DELETE FROM quizzes WHERE id = ?').bind(quizId),
                db.prepare(
                    `INSERT INTO quizzes (id, title, class_level, category, time_limit, created_at, access_code, require_code, created_by, show_on_home, tags)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    quizId, body.title, body.classLevel, body.category || '',
                    body.timeLimit, body.createdAt, body.accessCode || '',
                    body.requireCode ? 'TRUE' : 'FALSE', createdBy,
                    body.showOnHome === false ? 'FALSE' : 'TRUE',
                    body.tags ? (Array.isArray(body.tags) ? JSON.stringify(body.tags) : body.tags) : '[]'
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
            });
        } catch (error: unknown) {
            return internalErrorResponse(error, request, { context: `PUT /api/quizzes/${quizId}` });
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
                    `INSERT INTO quizzes (id, title, class_level, category, time_limit, created_at, access_code, require_code, created_by, show_on_home, tags)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    newQuizId, newTitle, originalQuiz.class_level, originalQuiz.category || '',
                    originalQuiz.time_limit, createdAt, '', originalQuiz.require_code || 'FALSE',
                    user.username, 'FALSE', originalQuiz.tags || '[]'
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

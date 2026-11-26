import { Env } from '../../types';
import { jsonResponse, errorResponse } from '../../utils/response';
import { verifyJWTMiddleware, requireAdmin, requireTeacher } from '../../middleware/jwtAuth';
import { withD1Retry } from '../../utils/d1';
import {
    canAccessQuiz,
    loadTeacherQuizOwnerIdentity,
    teacherQuizOwnerQueryValues,
} from '../../services/quizOwnership';
import { isPublicPracticeQuiz, resolveQuizPlayAccess } from '../../services/quizAccessPolicy';
import { buildQuizEditability, loadQuizUsage, toEditorQuizDto } from './quizUsage';
import { mapQuestionFromD1, sanitizeQuestionForStudent, sanitizeQuizForStudent } from './questionDto';

export async function handleQuizCatalogRoute(
    request: Request,
    env: Env,
    path: string,
    method: string,
): Promise<Response | null> {
    if (path === '/api/quizzes' && method === 'GET') {
        const authResult = await verifyJWTMiddleware(request, env);
        const user = authResult instanceof Response ? null : authResult.user;
        let rows: { results: import('../../types').Quiz[] };
        if (user && requireAdmin(user)) {
            rows = await withD1Retry(
                () => env.DB.prepare('SELECT * FROM quizzes').all<import('../../types').Quiz>(),
                'GET /api/quizzes admin',
            );
        } else if (user?.role === 'teacher') {
            const identity = await loadTeacherQuizOwnerIdentity(env.DB, user.username);
            if (!identity) return errorResponse('Teacher not found', 404);
            rows = await withD1Retry(
                () => env.DB.prepare(`
                    SELECT *
                    FROM quizzes
                    WHERE LOWER(TRIM(created_by)) = LOWER(TRIM(?))
                       OR (? IS NOT NULL AND LOWER(TRIM(created_by)) = LOWER(TRIM(?)))
                `).bind(...teacherQuizOwnerQueryValues(identity)).all<import('../../types').Quiz>(),
                'GET /api/quizzes teacher',
            );
        } else {
            rows = await withD1Retry(
                () => env.DB.prepare('SELECT * FROM quizzes').all<import('../../types').Quiz>(),
                'GET /api/quizzes catalog',
            );
        }
        const quizzes = user && requireTeacher(user)
            ? rows.results
            : rows.results.map((quiz) => sanitizeQuizForStudent(quiz as unknown as Record<string, unknown>));
        return jsonResponse(quizzes);
    }

    if (path.match(/^\/api\/quizzes\/[^/]+\/editor$/) && method === 'GET') {
        const authResult = await verifyJWTMiddleware(request, env);
        if (authResult instanceof Response) return authResult;
        const { user } = authResult;
        if (!requireTeacher(user)) return errorResponse('Forbidden: Teacher or admin access required', 403);

        const quizId = path.split('/')[3];
        if (!quizId) return errorResponse('Missing quiz ID');
        if (!(await canAccessQuiz(env.DB, user, quizId))) {
            return errorResponse('Forbidden: You do not have permission to edit this quiz', 403);
        }

        const [quiz, questions, usage] = await Promise.all([
            env.DB.prepare('SELECT * FROM quizzes WHERE id = ?').bind(quizId).first<import('../../types').Quiz>(),
            env.DB.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY rowid ASC').bind(quizId).all<import('../../types').Question>(),
            loadQuizUsage(env.DB, quizId),
        ]);
        if (!quiz) return errorResponse('Quiz not found', 404);

        return jsonResponse({
            quiz: toEditorQuizDto(quiz),
            questions: questions.results.map(mapQuestionFromD1),
            editability: buildQuizEditability(usage),
        });
    }

    if (path === '/api/questions' && method === 'GET') {
        const authResult = await verifyJWTMiddleware(request, env);
        const user = authResult instanceof Response ? null : authResult.user;

        const url = new URL(request.url);
        const quizId = url.searchParams.get('quizId');

        // Learners must use the scoped play-questions endpoint.  Keep the
        // legacy GET only for an explicitly public, unlocked quiz so a known
        // quiz ID cannot turn into a protected-question oracle.
        if ((user?.role === 'student' || !user) && !quizId) {
            return errorResponse('Forbidden: Quiz access required', 403);
        }
        if ((user?.role === 'student' || !user) && quizId) {
            const access = await resolveQuizPlayAccess(env.DB, {
                quizId,
                actor: user,
                now: new Date(),
            });
            if (!access.allowed) return errorResponse('Forbidden: Quiz access required', 403);
            if (!(await isPublicPracticeQuiz(env.DB, quizId))) {
                return errorResponse('Forbidden: Quiz access required', 403);
            }
        }

        if (user && quizId && requireTeacher(user) && !(await canAccessQuiz(env.DB, user, quizId))) {
            return errorResponse('Forbidden: You do not have permission to read this quiz', 403);
        }

        let rows: { results: any[] };
        if (!user && quizId) {
            rows = await withD1Retry(
                () => env.DB.prepare(`
                    SELECT q.*
                    FROM questions q
                    JOIN quizzes z ON z.id = q.quiz_id
                    WHERE q.quiz_id = ?
                      AND UPPER(COALESCE(z.show_on_home, 'FALSE')) = 'TRUE'
                    ORDER BY q.rowid ASC
                `).bind(quizId).all<any>(),
                'GET /api/questions public quiz',
            );
        } else if (!user) {
            rows = await withD1Retry(
                () => env.DB.prepare(`
                    SELECT q.*
                    FROM questions q
                    JOIN quizzes z ON z.id = q.quiz_id
                    WHERE UPPER(COALESCE(z.show_on_home, 'FALSE')) = 'TRUE'
                `).all<any>(),
                'GET /api/questions public catalog',
            );
        } else if (quizId) {
            rows = await withD1Retry(
                () => env.DB.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY rowid ASC').bind(quizId).all<any>(),
                'GET /api/questions by quizId',
            );
        } else if (requireAdmin(user)) {
            rows = await withD1Retry(() => env.DB.prepare('SELECT * FROM questions').all<any>(), 'GET /api/questions admin');
        } else if (user.role === 'teacher') {
            const identity = await loadTeacherQuizOwnerIdentity(env.DB, user.username);
            if (!identity) return errorResponse('Teacher not found', 404);
            rows = await withD1Retry(
                () => env.DB.prepare(`
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
                () => env.DB.prepare('SELECT * FROM questions').all<any>(),
                'GET /api/questions student catalog',
            );
        }

        const mustSanitize = !user || user.role === 'student';
        return jsonResponse(mustSanitize
            ? rows.results.map(sanitizeQuestionForStudent)
            : rows.results.map(mapQuestionFromD1));
    }

    return null;
}

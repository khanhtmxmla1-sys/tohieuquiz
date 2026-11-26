import { parseBody, handleValidateAnswers } from '../../utils/helpers';
import { errorResponse } from '../../utils/response';
import { requireTeacher, isStudent } from '../../middleware/jwtAuth';
import { canAccessQuiz } from '../../services/quizOwnership';
import {
    isPublicPracticeQuiz,
    resolveQuizPlayAccess,
} from '../../services/quizAccessPolicy';
import type { ResultRouteContext } from './context';

export async function handleResultValidateRoute(context: ResultRouteContext): Promise<Response | null> {
    const { request, db, user, path, method } = context;

    // POST /api/validate - Validate answers (server-side anti-cheat)
    if (path === '/api/validate' && method === 'POST') {
        const body = await parseBody(request);
        if (!body) return errorResponse('Invalid JSON body');
        if (!requireTeacher(user) && !isStudent(user)) {
            return errorResponse('Forbidden: Authenticated user required', 403);
        }

        const quizId = String(body.quizId || '').trim();
        if (user.role === 'teacher' && !(await canAccessQuiz(db, user, quizId))) {
            return errorResponse('Forbidden: Quiz access required', 403);
        }
        if (isStudent(user)) {
            const quiz = await db.prepare(`
                SELECT id, revision, show_on_home, require_code, time_limit
                FROM quizzes
                WHERE id = ?
                LIMIT 1
            `).bind(quizId).first<{
                id: string;
                revision?: number | null;
                show_on_home?: string | number | boolean | null;
                require_code?: string | number | boolean | null;
                time_limit?: number | null;
            }>();
            const access = quiz
                ? await resolveQuizPlayAccess(db, { quizId, actor: user, now: new Date() })
                : { allowed: false as const, code: 'QUIZ_NOT_FOUND' };
            if (!access.allowed || access.kind !== 'public' || access.requiresCode || !(await isPublicPracticeQuiz(db, quizId))) {
                return errorResponse('Forbidden: Quiz access required', 403);
            }
        }

        return await handleValidateAnswers(db, body, {
            includeCorrectAnswers: requireTeacher(user),
            subject: {
                role: user.role as 'admin' | 'teacher' | 'student' | 'parent' | 'public',
                username: user.username,
                classIds: [],
            },
        });
    }

    return null;
}

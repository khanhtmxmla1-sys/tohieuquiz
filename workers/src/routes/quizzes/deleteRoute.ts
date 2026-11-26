import { Env } from '../../types';
import { jsonResponse, errorResponse } from '../../utils/response';
import { extractIdFromPath } from '../../utils/helpers';
import { verifyJWTMiddleware, requireTeacher } from '../../middleware/jwtAuth';
import { canAccessQuiz } from '../../services/quizOwnership';
import { loadQuizUsage, quizConflictResponse } from './quizUsage';

export async function handleDeleteQuizRoute(
    request: Request,
    env: Env,
    path: string,
    method: string,
): Promise<Response | null> {
    if (!path.startsWith('/api/quizzes/') || method !== 'DELETE') return null;

    const authResult = await verifyJWTMiddleware(request, env);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    if (!requireTeacher(user)) {
        return errorResponse('Forbidden: Teacher or admin access required', 403);
    }

    const quizId = extractIdFromPath(path, '/api/quizzes');
    if (!quizId) return errorResponse('Missing quiz ID');

    // Check ownership
    if (!(await canAccessQuiz(env.DB, user, quizId))) {
        return errorResponse('Forbidden: You do not have permission to delete this quiz', 403);
    }

    const usage = await loadQuizUsage(env.DB, quizId);
    if (usage.activeLiveExamCount > 0) {
        return quizConflictResponse(
            'QUIZ_LIVE_EXAM_ACTIVE',
            'Đề đang được sử dụng trong một ca thi trực tiếp và không thể xóa.',
            { activeLiveExamCount: usage.activeLiveExamCount },
        );
    }
    if (usage.resultCount > 0) {
        return quizConflictResponse(
            'QUIZ_HAS_SUBMISSIONS',
            'Đề đã có bài nộp và không thể xóa vì cần giữ dữ liệu xem lại kết quả.',
            { resultCount: usage.resultCount },
        );
    }
    if (usage.openAssignmentCount > 0) {
        return quizConflictResponse(
            'QUIZ_HAS_OPEN_ASSIGNMENTS',
            'Đề đang được giao cho học sinh và không thể xóa khi bài giao còn mở.',
            { openAssignmentCount: usage.openAssignmentCount },
        );
    }

    await env.DB.prepare('DELETE FROM questions WHERE quiz_id = ?').bind(quizId).run();
    await env.DB.prepare('DELETE FROM quizzes WHERE id = ?').bind(quizId).run();
    return jsonResponse({ status: 'success' });
}

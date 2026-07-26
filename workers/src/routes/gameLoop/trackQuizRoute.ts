import { recordQuizActivity } from '../../gameLoop/activityService';
import { buildDashboardResponse } from '../../gameLoop/dashboardService';
import { normalizeGameLoopCategory } from '../../gameLoop/normalization';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';

export const handleTrackQuizRoute = async (
    request: Request,
    db: D1Database,
    username: string
): Promise<Response> => {
    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');

    const activityId = String(body.activityId || '').trim();
    if (!activityId) return errorResponse('Missing activityId');

    await recordQuizActivity(db, username, {
        activityId,
        quizId: String(body.quizId || ''),
        category: normalizeGameLoopCategory(String(body.category || body.subject || '').trim()),
        totalQuestions: Math.max(0, Math.floor(Number(body.totalQuestions) || 0)),
        correctCount: Math.max(0, Math.floor(Number(body.correctCount) || 0)),
    });
    const data = await buildDashboardResponse(db, username);
    return jsonResponse({ status: 'success', data });
};

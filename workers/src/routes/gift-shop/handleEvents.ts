import type { Env } from '../../types';
import { requireAdmin } from '../../middleware/jwtAuth';
import { errorResponse, jsonResponse } from '../../utils/response';
import { getAuthenticatedUser } from './auth';
import { mapEvent } from './mappers';

export const handleEvents = async (request: Request, env: Env): Promise<Response> => {
    const userOrResponse = await getAuthenticatedUser(request, env);
    if (userOrResponse instanceof Response) return userOrResponse;
    if (!requireAdmin(userOrResponse)) return errorResponse('Forbidden', 403);

    const rows = await env.DB.prepare(`
        SELECT *
        FROM gift_order_events
        ORDER BY datetime(created_at) DESC
        LIMIT 200
    `).all();
    return jsonResponse((rows.results || []).map(mapEvent));
};

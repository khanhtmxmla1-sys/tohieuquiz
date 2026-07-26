import type { Env } from '../../types';
import { requireTeacher } from '../../middleware/jwtAuth';
import { extractIdFromPath, parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';
import { ensureCanManageOrder, getActorAccessFromUser, getAuthenticatedUser } from './auth';
import { commitCancellation } from './commitCancellation';
import { mapOrder } from './mappers';
import { getCoinsByStudentId, getOrderById } from './orderRepository';
import { nowIso } from './values';

export const handleCancellation = async (request: Request, env: Env, path: string): Promise<Response> => {
    const orderId = extractIdFromPath(path, '/api/gift-shop/orders');
    if (!orderId) return errorResponse('Missing order ID');

    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');
    const reason = String(body.reason || '').trim() || 'Cancelled by staff';

    const userOrResponse = await getAuthenticatedUser(request, env);
    if (userOrResponse instanceof Response) return userOrResponse;
    if (!requireTeacher(userOrResponse)) return errorResponse('Forbidden', 403);

    const actorUsername = userOrResponse.username || 'system';
    const actorAccess = getActorAccessFromUser(userOrResponse);
    const order = await getOrderById(env.DB, orderId);
    if (!order) return errorResponse('Order not found', 404);

    try {
        ensureCanManageOrder(order, actorAccess.isAdmin, actorAccess.teacherClass);
    } catch (error: any) {
        return errorResponse(error.message || 'Forbidden', 403);
    }

    if (order.status === 'DELIVERED') return errorResponse('Delivered order cannot be cancelled', 400);
    if (order.status === 'CANCELLED_REFUNDED') {
        return errorResponse('Order has already been cancelled', 400);
    }

    const refundAmount = Number(order.price_coins) || 0;
    await commitCancellation(env.DB, {
        orderId,
        studentId: order.student_id,
        actorUsername,
        reason,
        refundAmount,
        now: nowIso(),
    });

    const cancelled = await getOrderById(env.DB, orderId);
    if (!cancelled) return errorResponse('Order not found after cancel', 500);
    const newCoins = await getCoinsByStudentId(env.DB, order.student_id);
    return jsonResponse({ order: mapOrder(cancelled), newCoins });
};

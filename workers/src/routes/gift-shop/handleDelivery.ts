import type { Env } from '../../types';
import { requireTeacher } from '../../middleware/jwtAuth';
import { extractIdFromPath, parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';
import { ensureCanManageOrder, getActorAccessFromUser, getAuthenticatedUser } from './auth';
import { commitDelivery } from './commitDelivery';
import { mapOrder } from './mappers';
import { getOrderById } from './orderRepository';
import { nowIso } from './values';

export const handleDelivery = async (request: Request, env: Env, path: string): Promise<Response> => {
    const orderId = extractIdFromPath(path, '/api/gift-shop/orders');
    if (!orderId) return errorResponse('Missing order ID');

    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');

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

    if (order.status !== 'VOUCHER_ISSUED') {
        return errorResponse('Order is not in a deliverable state', 400);
    }

    await commitDelivery(env.DB, {
        orderId,
        studentId: order.student_id,
        actorUsername,
        now: nowIso(),
    });

    const delivered = await getOrderById(env.DB, orderId);
    if (!delivered) return errorResponse('Order not found after update', 500);
    return jsonResponse(mapOrder(delivered));
};

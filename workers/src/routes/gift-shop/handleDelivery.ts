import type { Env } from '../../types';
import { requireTeacher } from '../../middleware/jwtAuth';
import { extractIdFromPath, parseBody } from '../../utils/helpers';
import { getRequestId } from '../../utils/logger';
import { errorResponse, jsonResponse } from '../../utils/response';
import { ensureCanManageOrder, getActorAccessFromUser, getAuthenticatedUser } from './auth';
import { mapGiftShopDatabaseError } from './errors';
import { mapOrder } from './mappers';
import { getOrderById } from './orderRepository';
import { nowIso } from './values';

export const handleDelivery = async (request: Request, env: Env, path: string): Promise<Response> => {
    const orderId = extractIdFromPath(path, '/api/gift-shop/orders');
    if (!orderId) return errorResponse('Missing order ID');
    if (!await parseBody(request)) return errorResponse('Invalid JSON body');
    const userOrResponse = await getAuthenticatedUser(request, env);
    if (userOrResponse instanceof Response) return userOrResponse;
    if (!requireTeacher(userOrResponse)) return errorResponse('Forbidden', 403);

    const order = await getOrderById(env.DB, orderId);
    if (!order) return errorResponse('Order not found', 404);
    const access = getActorAccessFromUser(userOrResponse);
    try { ensureCanManageOrder(order, access.isAdmin, access.teacherClass); }
    catch (error) { return errorResponse(error instanceof Error ? error.message : 'Forbidden', 403); }
    if (order.status !== 'APPROVED') return errorResponse('Trạng thái đơn không cho phép thao tác này.', 409);

    const now = nowIso();
    try {
        await env.DB.prepare(`
            UPDATE gift_orders
            SET status='DELIVERED', delivered_by=?, delivered_at=?, transition_actor=?,
                transition_request_id=?, updated_at=?
            WHERE id=? AND status='APPROVED'
        `).bind(userOrResponse.username, now, userOrResponse.username, getRequestId(request), now, orderId).run();
    } catch (error) {
        const mapped = mapGiftShopDatabaseError(error);
        if (mapped) return mapped;
        throw error;
    }
    const delivered = await getOrderById(env.DB, orderId);
    if (!delivered || delivered.status !== 'DELIVERED') return errorResponse('Trạng thái đơn không cho phép thao tác này.', 409);
    return jsonResponse(mapOrder(delivered));
};

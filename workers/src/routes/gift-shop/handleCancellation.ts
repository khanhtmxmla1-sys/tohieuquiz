import type { Env } from '../../types';
import { requireTeacher } from '../../middleware/jwtAuth';
import { extractIdFromPath, parseBody } from '../../utils/helpers';
import { getRequestId } from '../../utils/logger';
import { errorResponse, jsonResponse } from '../../utils/response';
import { ensureCanManageOrder, getActorAccessFromUser, getAuthenticatedUser } from './auth';
import { mapGiftShopDatabaseError } from './errors';
import { mapOrder } from './mappers';
import { getCoinsByStudentId, getOrderById } from './orderRepository';
import { nowIso } from './values';

export const handleCancellation = async (request: Request, env: Env, path: string): Promise<Response> => {
    const orderId = extractIdFromPath(path, '/api/gift-shop/orders');
    if (!orderId) return errorResponse('Missing order ID');
    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');
    const reason = String(body.reason || '').trim();
    if (!reason) return errorResponse('Vui lòng nhập lý do hủy đơn.', 400);

    const userOrResponse = await getAuthenticatedUser(request, env);
    if (userOrResponse instanceof Response) return userOrResponse;
    if (!requireTeacher(userOrResponse)) return errorResponse('Forbidden', 403);
    const order = await getOrderById(env.DB, orderId);
    if (!order) return errorResponse('Order not found', 404);
    const access = getActorAccessFromUser(userOrResponse);
    try { ensureCanManageOrder(order, access.isAdmin, access.teacherClass); }
    catch (error) { return errorResponse(error instanceof Error ? error.message : 'Forbidden', 403); }

    if (order.status === 'DELIVERED') return errorResponse('Trạng thái đơn không cho phép thao tác này.', 409);
    if (order.status === 'CANCELLED') {
        return jsonResponse({
            order: mapOrder(order),
            newCoins: await getCoinsByStudentId(env.DB, order.student_id),
            refundedCoins: 0,
            idempotencyReplay: true,
        });
    }

    const now = nowIso();
    try {
        await env.DB.prepare(`
            UPDATE gift_orders
            SET status='CANCELLED', cancel_reason=?, cancelled_by=?, cancelled_at=?,
                transition_actor=?, transition_request_id=?, updated_at=?
            WHERE id=? AND status IN ('PENDING', 'APPROVED')
        `).bind(reason, userOrResponse.username, now, userOrResponse.username, getRequestId(request), now, orderId).run();
    } catch (error) {
        const mapped = mapGiftShopDatabaseError(error);
        if (mapped) return mapped;
        throw error;
    }
    const cancelled = await getOrderById(env.DB, orderId);
    if (!cancelled || cancelled.status !== 'CANCELLED') return errorResponse('Trạng thái đơn không cho phép thao tác này.', 409);
    return jsonResponse({
        order: mapOrder(cancelled),
        newCoins: await getCoinsByStudentId(env.DB, order.student_id),
        refundedCoins: Number(order.price_coins) || 0,
        idempotencyReplay: false,
    });
};

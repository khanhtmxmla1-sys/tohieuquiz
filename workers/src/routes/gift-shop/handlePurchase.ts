import type { Env } from '../../types';
import { requireTeacher } from '../../middleware/jwtAuth';
import { parseBody } from '../../utils/helpers';
import { errorResponse, generateId } from '../../utils/response';
import { getActorAccessFromUser, getAuthenticatedUser } from './auth';
import { commitPurchase } from './commitPurchase';
import { findOrderByIdempotency, getCoinsByStudentId, getOrderById } from './orderRepository';
import { buildItemSnapshot, getActiveCatalogItem, getStudentForPurchase } from './purchaseRepository';
import { purchaseResponse } from './purchaseResponse';
import { generateVoucherCode, nowIso } from './values';

export const handlePurchase = async (request: Request, env: Env): Promise<Response> => {
    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');

    const userOrResponse = await getAuthenticatedUser(request, env);
    if (userOrResponse instanceof Response) return userOrResponse;

    const studentId = String(body.studentId || '').trim();
    if (userOrResponse.role === 'student' && String(userOrResponse.id || '') !== studentId) {
        return errorResponse('Forbidden', 403);
    }
    if (userOrResponse.role !== 'student' && !requireTeacher(userOrResponse)) {
        return errorResponse('Forbidden', 403);
    }

    const itemId = String(body.itemId || '').trim();
    const idempotencyKey = String(body.idempotencyKey || '').trim();
    if (!studentId || !itemId || !idempotencyKey) {
        return errorResponse('Missing studentId, itemId, or idempotencyKey');
    }

    const student = await getStudentForPurchase(env.DB, studentId);
    if (!student) return errorResponse('Student not found', 404);

    if (userOrResponse.role !== 'student') {
        const actorAccess = getActorAccessFromUser(userOrResponse);
        const teacherClass = String(actorAccess.teacherClass || '').trim();
        const studentClassId = String(student.class_id || '').trim();
        const studentClassName = String(student.class_name || '').trim();
        if (!actorAccess.isAdmin && (!teacherClass || (teacherClass !== studentClassId && teacherClass !== studentClassName))) {
            return errorResponse('Forbidden', 403);
        }
    }

    const existingOrder = await findOrderByIdempotency(env.DB, idempotencyKey, studentId);
    if (existingOrder) {
        const coins = await getCoinsByStudentId(env.DB, studentId);
        return purchaseResponse(existingOrder, coins, true);
    }

    const item = await getActiveCatalogItem(env.DB, itemId);
    if (!item) return errorResponse('Gift item not found', 404);

    const currentCoins = Number(student.coins) || 0;
    const priceCoins = Number(item.price_coins) || 0;
    if (currentCoins < priceCoins) return errorResponse('Insufficient coins', 400);

    const orderId = generateId('gord');
    const voucherCode = generateVoucherCode();
    const now = nowIso();
    const itemSnapshot = buildItemSnapshot(item, priceCoins, now);

    try {
        await commitPurchase(env.DB, {
            orderId,
            idempotencyKey,
            studentId,
            classId: student.class_id,
            studentUsername: student.username || '',
            itemId,
            itemSnapshot,
            priceCoins,
            voucherCode,
            now,
        });
    } catch (error: any) {
        const errorText = String(error?.message || '');
        if (!errorText.includes('gift_orders.idempotency_key')) throw error;

        const replayOrder = await findOrderByIdempotency(env.DB, idempotencyKey, studentId);
        if (!replayOrder) throw error;
        const coins = await getCoinsByStudentId(env.DB, studentId);
        return purchaseResponse(replayOrder, coins, true);
    }

    const createdOrder = await getOrderById(env.DB, orderId);
    if (!createdOrder) return errorResponse('Failed to create order', 500);
    const newCoins = await getCoinsByStudentId(env.DB, studentId);
    return purchaseResponse(createdOrder, newCoins, false, orderId, voucherCode);
};

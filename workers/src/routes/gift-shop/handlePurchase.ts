import type { Env } from '../../types';
import { requireTeacher } from '../../middleware/jwtAuth';
import { parseBody } from '../../utils/helpers';
import { getRequestId } from '../../utils/logger';
import { errorResponse, generateId } from '../../utils/response';
import { getActorAccessFromUser, getAuthenticatedUser } from './auth';
import { commitPurchase } from './commitPurchase';
import { mapGiftShopDatabaseError } from './errors';
import { findOrderByIdempotency, getCoinsByStudentId, getOrderById } from './orderRepository';
import { buildItemSnapshot, getActiveCatalogItem, getStudentForPurchase } from './purchaseRepository';
import { purchaseResponse } from './purchaseResponse';
import { getIsoWeekKey, gradeFromClassName, nowIso } from './values';

export const handlePurchase = async (request: Request, env: Env): Promise<Response> => {
    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');
    const userOrResponse = await getAuthenticatedUser(request, env);
    if (userOrResponse instanceof Response) return userOrResponse;

    const studentId = String(body.studentId || '').trim();
    if (userOrResponse.role === 'student' && String(userOrResponse.id || '') !== studentId) {
        return errorResponse('Forbidden', 403);
    }
    if (userOrResponse.role !== 'student' && !requireTeacher(userOrResponse)) return errorResponse('Forbidden', 403);

    const itemId = String(body.itemId || '').trim();
    const idempotencyKey = String(body.idempotencyKey || '').trim().slice(0, 128);
    if (!studentId || !itemId || !idempotencyKey) return errorResponse('Missing studentId, itemId, or idempotencyKey');

    const student = await getStudentForPurchase(env.DB, studentId);
    if (!student) return errorResponse('Student not found', 404);
    if (userOrResponse.role !== 'student') {
        const access = getActorAccessFromUser(userOrResponse);
        const teacherClass = access.teacherClass;
        if (!access.isAdmin && (!teacherClass || (teacherClass !== student.class_id && teacherClass !== student.class_name))) {
            return errorResponse('Forbidden', 403);
        }
    }

    const existingOrder = await findOrderByIdempotency(env.DB, idempotencyKey, studentId);
    if (existingOrder) return purchaseResponse(existingOrder, await getCoinsByStudentId(env.DB, studentId), true);

    const item = await getActiveCatalogItem(env.DB, itemId);
    if (!item) return errorResponse('Gift item not found', 404);
    const priceCoins = Number(item.price_coins) || 0;
    const orderId = generateId('gord');
    const now = nowIso();

    try {
        await commitPurchase(env.DB, {
            orderId,
            idempotencyKey,
            studentId,
            classId: student.class_id,
            schoolId: String(student.school_id || ''),
            gradeLevel: gradeFromClassName(student.class_name),
            studentUsername: student.username || studentId,
            itemId,
            itemSnapshot: buildItemSnapshot(item, priceCoins, now),
            priceCoins,
            weekKey: getIsoWeekKey(new Date(now)),
            requestId: getRequestId(request),
            now,
        });
    } catch (error) {
        const text = error instanceof Error ? error.message : String(error || '');
        if (text.includes('gift_orders.idempotency_key') || text.includes('UNIQUE constraint failed: gift_orders.idempotency_key')) {
            const replay = await findOrderByIdempotency(env.DB, idempotencyKey, studentId);
            if (replay) return purchaseResponse(replay, await getCoinsByStudentId(env.DB, studentId), true);
        }
        const mapped = mapGiftShopDatabaseError(error);
        if (mapped) return mapped;
        throw error;
    }

    const created = await getOrderById(env.DB, orderId);
    if (!created) return errorResponse('Failed to create order', 500);
    return purchaseResponse(created, await getCoinsByStudentId(env.DB, studentId), false, orderId, '');
};

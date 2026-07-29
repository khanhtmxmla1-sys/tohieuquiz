import type { GiftCatalogItem, GiftOrder, GiftPurchasePayload } from '../../types/giftShop.types';
import { pushEvent, pushLedger, randomId } from './mockStateHelpers';
import type { GiftShopMockState } from './types';

export const createPurchaseRecords = (payload: GiftPurchasePayload, item: GiftCatalogItem, now: string) => {
    const order: GiftOrder = {
        id: randomId('order'),
        studentId: payload.studentId,
        studentName: payload.studentName,
        studentUsername: payload.studentUsername,
        classId: payload.classId,
        className: payload.className,
        itemId: item.id,
        schoolId: item.schoolId,
        gradeLevel: item.gradeLevel,
        itemSnapshot: { ...item },
        priceCoins: item.priceCoins,
        status: 'PENDING',
        voucherCode: '',
        createdAt: now,
        updatedAt: now,
    };
    return { order };
};

export const recordPurchase = (state: GiftShopMockState, payload: GiftPurchasePayload, order: GiftOrder) => {
    state.orders.unshift(order);
    state.idempotencyOrderMap[payload.idempotencyKey] = order.id;
    pushLedger(state, { studentId: payload.studentId, deltaCoins: -order.priceCoins, reason: 'PURCHASE', refOrderId: order.id });
    pushEvent(state, {
        type: 'ORDER_CREATED', orderId: order.id, studentId: payload.studentId,
        metadata: { itemId: order.itemSnapshot.id, priceCoins: order.priceCoins },
    });
};

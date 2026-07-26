import type {
    GiftCatalogItem,
    GiftOrder,
    GiftPurchasePayload,
    GiftVoucher,
} from '../../types/giftShop.types';
import { pushEvent, pushLedger, randomId } from './mockStateHelpers';
import type { GiftShopMockState } from './types';

export const createPurchaseRecords = (
    payload: GiftPurchasePayload,
    item: GiftCatalogItem,
    now: string
) => {
    const orderId = randomId('order');
    const voucherCode = `VCH-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const order: GiftOrder = {
        id: orderId,
        studentId: payload.studentId,
        studentName: payload.studentName,
        studentUsername: payload.studentUsername,
        classId: payload.classId,
        className: payload.className,
        itemSnapshot: item,
        priceCoins: item.priceCoins,
        status: 'VOUCHER_ISSUED',
        voucherCode,
        createdAt: now,
        updatedAt: now,
    };
    const voucher: GiftVoucher = {
        code: voucherCode,
        orderId,
        studentId: payload.studentId,
        issuedAt: now,
        status: 'ISSUED',
    };
    return { order, voucher };
};

export const recordPurchase = (
    state: GiftShopMockState,
    payload: GiftPurchasePayload,
    order: GiftOrder,
    voucher: GiftVoucher
) => {
    state.orders.unshift(order);
    state.vouchers.unshift(voucher);
    state.idempotencyOrderMap[payload.idempotencyKey] = order.id;
    pushLedger(state, {
        studentId: payload.studentId,
        deltaCoins: -order.priceCoins,
        reason: 'PURCHASE',
        refOrderId: order.id,
    });
    pushEvent(state, {
        type: 'ORDER_CREATED',
        orderId: order.id,
        studentId: payload.studentId,
        metadata: { itemId: order.itemSnapshot.id, priceCoins: order.priceCoins },
    });
    pushEvent(state, {
        type: 'VOUCHER_ISSUED',
        orderId: order.id,
        studentId: payload.studentId,
        metadata: { voucherCode: voucher.code },
    });
};

import type { GiftPurchasePayload, GiftPurchaseResponse } from '../../types/giftShop.types';
import { getOrderById } from './mockOrderAccess';
import { createPurchaseRecords, recordPurchase } from './mockPurchaseRecords';
import { readMockState, saveMockState } from './mockState';
import { ensureWallet, nowIso } from './mockStateHelpers';

export const purchaseMock = async (
    payload: GiftPurchasePayload
): Promise<GiftPurchaseResponse> => {
    const state = readMockState();
    const existingOrderId = state.idempotencyOrderMap[payload.idempotencyKey];
    if (existingOrderId) {
        const existingOrder = getOrderById(state, existingOrderId);
        return {
            orderId: existingOrder.id,
            voucherCode: existingOrder.voucherCode,
            newCoins: state.walletByStudentId[payload.studentId] ?? Math.max(0, payload.currentCoins),
            status: existingOrder.status,
            idempotencyReplay: true,
            order: existingOrder,
        };
    }

    const item = state.catalog.find((candidate) =>
        candidate.id === payload.itemId && candidate.isActive
    );
    if (!item) throw new Error('Món quà không còn khả dụng.');

    const wallet = ensureWallet(state, payload.studentId, payload.currentCoins);
    if (wallet < item.priceCoins) throw new Error('Không đủ xu để đổi quà.');
    state.walletByStudentId[payload.studentId] = wallet - item.priceCoins;

    const { order, voucher } = createPurchaseRecords(payload, item, nowIso());
    recordPurchase(state, payload, order, voucher);
    saveMockState(state);
    return {
        orderId: order.id,
        voucherCode: voucher.code,
        newCoins: state.walletByStudentId[payload.studentId],
        status: order.status,
        idempotencyReplay: false,
        order,
    };
};

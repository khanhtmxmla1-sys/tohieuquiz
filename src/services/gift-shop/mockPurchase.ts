import type { GiftPurchasePayload, GiftPurchaseResponse } from '../../types/giftShop.types';
import { getOrderById } from './mockOrderAccess';
import { createPurchaseRecords, recordPurchase } from './mockPurchaseRecords';
import { readMockState, saveMockState } from './mockState';
import { ensureWallet, nowIso } from './mockStateHelpers';

const currentWeekKey = (value: string) => {
    const date = new Date(value);
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const weekday = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - weekday);
    const start = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    return `${target.getUTCFullYear()}-${Math.ceil((((target.getTime() - start.getTime()) / 86400000) + 1) / 7)}`;
};

export const purchaseMock = async (payload: GiftPurchasePayload): Promise<GiftPurchaseResponse> => {
    const state = readMockState();
    const existingOrderId = state.idempotencyOrderMap[payload.idempotencyKey];
    if (existingOrderId) {
        const existingOrder = getOrderById(state, existingOrderId);
        return { orderId: existingOrder.id, voucherCode: existingOrder.voucherCode, newCoins: state.walletByStudentId[payload.studentId] ?? Math.max(0, payload.currentCoins), status: existingOrder.status, idempotencyReplay: true, order: existingOrder };
    }
    if (!state.settings.effective.isOpen) throw new Error('Tiệm tạp hóa đang tạm đóng.');
    const item = state.catalog.find((candidate) => candidate.id === payload.itemId && candidate.isActive);
    if (!item) throw new Error('Món quà không còn khả dụng.');
    if (item.stockRemaining <= 0) throw new Error('Phần thưởng đã hết hàng.');
    const now = nowIso();
    const weekKey = currentWeekKey(now);
    const purchasedThisWeek = state.orders.filter((order) =>
        order.studentId === payload.studentId && order.itemSnapshot.id === item.id
        && currentWeekKey(order.createdAt) === weekKey && order.status !== 'CANCELLED'
    ).length;
    if (item.weeklyLimitPerStudent > 0 && purchasedThisWeek >= item.weeklyLimitPerStudent) {
        throw new Error('Em đã đạt giới hạn đổi món quà này trong tuần.');
    }
    const wallet = ensureWallet(state, payload.studentId, payload.currentCoins);
    if (wallet < item.priceCoins) throw new Error('Không đủ xu để đổi quà.');
    state.walletByStudentId[payload.studentId] = wallet - item.priceCoins;
    item.stockRemaining -= 1;
    const { order } = createPurchaseRecords(payload, item, now);
    recordPurchase(state, payload, order);
    saveMockState(state);
    return { orderId: order.id, voucherCode: '', newCoins: state.walletByStudentId[payload.studentId], status: order.status, idempotencyReplay: false, order };
};

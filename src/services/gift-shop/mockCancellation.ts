import type { GiftOrderActor } from '../../types/giftShop.types';
import { assertCanManageOrder, getOrderById, getVoucherByOrderId } from './mockOrderAccess';
import { readMockState, saveMockState } from './mockState';
import { ensureWallet, nowIso, pushEvent, pushLedger } from './mockStateHelpers';
import type { GiftCancelResult } from './types';

export const cancelOrderMock = async (orderId: string, actor: GiftOrderActor, reason: string): Promise<GiftCancelResult> => {
    const state = readMockState();
    const order = getOrderById(state, orderId);
    assertCanManageOrder(order, actor);
    if (order.status === 'DELIVERED') throw new Error('Đơn đã trao quà, không thể hủy.');
    if (order.status === 'CANCELLED') {
        return { order, newCoins: state.walletByStudentId[order.studentId] || 0, refundedCoins: 0, idempotencyReplay: true };
    }
    if (!reason.trim()) throw new Error('Vui lòng nhập lý do hủy đơn.');
    const currentWallet = ensureWallet(state, order.studentId, 0);
    state.walletByStudentId[order.studentId] = currentWallet + order.priceCoins;
    const item = state.catalog.find((entry) => entry.id === order.itemSnapshot.id);
    if (item) item.stockRemaining = Math.min(item.stockTotal, item.stockRemaining + 1);
    const now = nowIso();
    order.status = 'CANCELLED';
    order.cancelReason = reason.trim();
    order.cancelledBy = actor.username;
    order.cancelledAt = now;
    order.updatedAt = now;
    const voucher = getVoucherByOrderId(state, orderId);
    if (voucher) voucher.status = 'CANCELLED';
    pushLedger(state, { studentId: order.studentId, deltaCoins: order.priceCoins, reason: 'REFUND', refOrderId: order.id });
    pushEvent(state, { type: 'ORDER_CANCELLED', orderId, studentId: order.studentId, actor: actor.username, metadata: { reason: order.cancelReason } });
    pushEvent(state, { type: 'WALLET_REFUNDED', orderId, studentId: order.studentId, actor: actor.username, metadata: { amount: order.priceCoins } });
    saveMockState(state);
    return { order, newCoins: state.walletByStudentId[order.studentId], refundedCoins: order.priceCoins, idempotencyReplay: false };
};

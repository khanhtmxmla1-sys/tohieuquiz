import type { GiftOrderActor } from '../../types/giftShop.types';
import { assertCanManageOrder, getOrderById, getVoucherByOrderId } from './mockOrderAccess';
import { readMockState, saveMockState } from './mockState';
import { ensureWallet, nowIso, pushEvent, pushLedger } from './mockStateHelpers';
import type { GiftCancelResult } from './types';

export const cancelOrderMock = async (
    orderId: string,
    actor: GiftOrderActor,
    reason: string
): Promise<GiftCancelResult> => {
    const state = readMockState();
    const order = getOrderById(state, orderId);
    assertCanManageOrder(order, actor);
    if (order.status === 'DELIVERED') {
        throw new Error('Đơn đã trao quà, không thể hủy.');
    }
    if (order.status === 'CANCELLED_REFUNDED') {
        throw new Error('Đơn đã được hủy trước đó.');
    }

    const currentWallet = ensureWallet(state, order.studentId, 0);
    state.walletByStudentId[order.studentId] = currentWallet + order.priceCoins;
    const now = nowIso();
    order.status = 'CANCELLED_REFUNDED';
    order.cancelReason = reason || 'Hủy thủ công';
    order.updatedAt = now;
    order.deliveredBy = actor.username;
    order.deliveredAt = now;
    const voucher = getVoucherByOrderId(state, orderId);
    if (voucher) voucher.status = 'CANCELLED';

    pushLedger(state, {
        studentId: order.studentId,
        deltaCoins: order.priceCoins,
        reason: 'REFUND',
        refOrderId: order.id,
    });
    pushEvent(state, {
        type: 'ORDER_CANCELLED',
        orderId,
        studentId: order.studentId,
        actor: actor.username,
        metadata: { reason: order.cancelReason },
    });
    pushEvent(state, {
        type: 'WALLET_REFUNDED',
        orderId,
        studentId: order.studentId,
        actor: actor.username,
        metadata: { amount: order.priceCoins },
    });
    saveMockState(state);
    return { order, newCoins: state.walletByStudentId[order.studentId] };
};

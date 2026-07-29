import type { GiftOrder, GiftOrderActor, GiftVoucher } from '../../types/giftShop.types';
import { assertCanManageOrder, getOrderById } from './mockOrderAccess';
import { readMockState, saveMockState } from './mockState';
import { nowIso, pushEvent } from './mockStateHelpers';

export const approveOrderMock = async (orderId: string, actor: GiftOrderActor): Promise<GiftOrder> => {
    const state = readMockState();
    const order = getOrderById(state, orderId);
    assertCanManageOrder(order, actor);
    if (order.status !== 'PENDING') throw new Error('Đơn hàng không ở trạng thái có thể duyệt.');
    const now = nowIso();
    const code = `VCH-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    order.status = 'APPROVED';
    order.voucherCode = code;
    order.approvedBy = actor.username;
    order.approvedAt = now;
    order.updatedAt = now;
    const voucher: GiftVoucher = { code, orderId, studentId: order.studentId, issuedAt: now, status: 'ISSUED' };
    state.vouchers.unshift(voucher);
    pushEvent(state, { type: 'ORDER_APPROVED', orderId, studentId: order.studentId, actor: actor.username, metadata: { voucherCode: code } });
    saveMockState(state);
    return order;
};

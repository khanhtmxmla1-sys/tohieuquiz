import type { GiftOrder, GiftOrderActor } from '../../types/giftShop.types';
import { assertCanManageOrder, getOrderById, getVoucherByOrderId } from './mockOrderAccess';
import { readMockState, saveMockState } from './mockState';
import { nowIso, pushEvent } from './mockStateHelpers';

export const deliverOrderMock = async (
    orderId: string,
    actor: GiftOrderActor
): Promise<GiftOrder> => {
    const state = readMockState();
    const order = getOrderById(state, orderId);
    assertCanManageOrder(order, actor);
    if (order.status !== 'VOUCHER_ISSUED') {
        throw new Error('Đơn hàng không ở trạng thái có thể trao quà.');
    }

    order.status = 'DELIVERED';
    order.deliveredBy = actor.username;
    order.deliveredAt = nowIso();
    order.updatedAt = order.deliveredAt;
    const voucher = getVoucherByOrderId(state, orderId);
    if (voucher) voucher.status = 'USED';
    pushEvent(state, {
        type: 'ORDER_DELIVERED',
        orderId,
        studentId: order.studentId,
        actor: actor.username,
    });
    saveMockState(state);
    return order;
};

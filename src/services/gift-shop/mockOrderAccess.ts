import type { GiftOrder, GiftOrderActor, GiftOrderQuery } from '../../types/giftShop.types';
import type { GiftShopMockState } from './types';

export const assertCanManageOrder = (order: GiftOrder, actor: GiftOrderActor) => {
    if (actor.isAdmin) return;
    const teacherClass = (actor.teacherClass || '').trim();
    if (!teacherClass || teacherClass !== order.classId) {
        throw new Error('Bạn không có quyền xử lý đơn của lớp này.');
    }
};

export const applyOrderFilters = (orders: GiftOrder[], query: GiftOrderQuery) =>
    orders.filter((order) => {
        if (query.studentId && order.studentId !== query.studentId) return false;
        if (query.classId && order.classId !== query.classId) return false;
        if (query.status && query.status !== 'ALL' && order.status !== query.status) return false;
        return true;
    });

export const getOrderById = (state: GiftShopMockState, orderId: string) => {
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) throw new Error('Không tìm thấy đơn hàng.');
    return order;
};

export const getVoucherByOrderId = (state: GiftShopMockState, orderId: string) =>
    state.vouchers.find((item) => item.orderId === orderId);

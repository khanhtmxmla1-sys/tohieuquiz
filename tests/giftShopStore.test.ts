import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GiftOrder } from '../src/types/giftShop.types';

const mocks = vi.hoisted(() => ({
  cancelOrder: vi.fn(),
  getOrders: vi.fn(),
}));

vi.mock('../src/services/giftShop.service', () => ({
  giftShopService: {
    cancelOrder: mocks.cancelOrder,
    getOrders: mocks.getOrders,
  },
}));

import { useClassroomStore } from '../src/stores/useClassroomStore';
import { useGamificationStore } from '../src/stores/useGamificationStore';
import { useGiftShopStore } from '../src/stores/useGiftShopStore';

const cancelledOrder: GiftOrder = {
  id: 'order-1',
  studentId: 'student-1',
  studentName: 'Nguyễn An',
  studentUsername: 'an3a',
  classId: 'class-3a',
  className: '3A',
  itemSnapshot: {
    id: 'gift-1',
    name: 'Bút chì',
    category: 'SUPPLY',
    priceCoins: 120,
    imageUrl: 'https://cdn.example.com/pencil.png',
    isActive: true,
    createdAt: '2026-07-21T00:00:00.000Z',
    updatedAt: '2026-07-21T00:00:00.000Z',
  },
  priceCoins: 120,
  status: 'CANCELLED_REFUNDED',
  voucherCode: 'VCH-1234',
  cancelReason: 'Học sinh đổi ý',
  createdAt: '2026-07-21T00:00:00.000Z',
  updatedAt: '2026-07-21T00:05:00.000Z',
};

const actor = { username: 'teacher-3a', isAdmin: false, teacherClass: '3A' };

beforeEach(() => {
  mocks.cancelOrder.mockReset().mockResolvedValue({ order: cancelledOrder, newCoins: 500 });
  mocks.getOrders.mockReset().mockResolvedValue([]);
  useClassroomStore.setState({ studentSession: null, isLoading: false, error: null });
  useGamificationStore.setState({ coins: 999 });
  useGiftShopStore.setState({
    catalog: [],
    myOrders: [],
    managedOrders: [cancelledOrder],
    eventLogs: [],
    loading: { catalog: false, studentOrders: false, managedOrders: false, events: false, action: false },
    errors: { catalog: null, studentOrders: null, managedOrders: null, events: null, action: null },
    isLoading: false,
    error: null,
    pendingAction: null,
    lastPurchase: null,
  });
});

describe('gift shop store wallet synchronization', () => {
  it('does not overwrite the local wallet when staff refunds another student', async () => {
    const ok = await useGiftShopStore.getState().cancelOrder('order-1', actor, 'Học sinh đổi ý');

    expect(ok).toBe(true);
    expect(useGamificationStore.getState().coins).toBe(999);
    expect(mocks.getOrders).toHaveBeenCalledTimes(1);
  });

  it('synchronizes coins when the refunded order belongs to the active student session', async () => {
    useClassroomStore.setState({
      studentSession: {
        studentId: 'student-1',
        fullName: 'Nguyễn An',
        username: 'an3a',
        classId: 'class-3a',
        className: '3A',
      },
    });

    const ok = await useGiftShopStore.getState().cancelOrder('order-1', actor, 'Học sinh đổi ý');

    expect(ok).toBe(true);
    expect(useGamificationStore.getState().coins).toBe(500);
    expect(mocks.getOrders).toHaveBeenCalledTimes(2);
  });
});

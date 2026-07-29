import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GiftShopTab from '../src/components/TeacherDashboard/GiftShopTab';
import { useAuthStore } from '../stores/authStore';
import { useGiftShopStore } from '../src/stores/useGiftShopStore';
import type { GiftCatalogItem, GiftOrder, GiftShopEventLog } from '../src/types/giftShop.types';

const mockedShowError = vi.fn();
const mockedShowConfirm = vi.fn();

vi.mock('../src/utils/toast', () => ({
  showError: (...args: unknown[]) => mockedShowError(...args),
  showConfirm: (...args: unknown[]) => mockedShowConfirm(...args),
}));

vi.mock('../src/services/giftShop.service', () => ({
  giftShopService: {
    getMode: () => 'api',
  },
}));

const catalogItem: GiftCatalogItem = {
  id: 'gift-1',
  name: 'Bút chì',
  category: 'SUPPLY',
  priceCoins: 120,
  imageUrl: 'https://cdn.example.com/pencil.png',
  isActive: true,
  stockTotal: 20,
  stockRemaining: 4,
  lowStockThreshold: 5,
  weeklyLimitPerStudent: 1,
  scopeType: 'SCHOOL',
  schoolId: 'admin_01',
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
};

const managedOrder: GiftOrder = {
  id: 'order-1',
  studentId: 'student-1',
  studentName: 'Nguyễn An',
  studentUsername: 'an3a',
  classId: '3A',
  className: 'Lớp 3A',
  itemSnapshot: catalogItem,
  priceCoins: 120,
  status: 'APPROVED',
  voucherCode: 'VCH-1234',
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
};

const eventLog: GiftShopEventLog = {
  id: 'event-1',
  type: 'ORDER_CREATED',
  createdAt: '2026-07-19T00:00:00.000Z',
};

function resetStores(options: {
  isAdmin?: boolean;
  teacherClass?: string | null;
  catalog?: GiftCatalogItem[];
  orders?: GiftOrder[];
  events?: GiftShopEventLog[];
  error?: string | null;
  isLoading?: boolean;
} = {}) {
  useAuthStore.setState({
    isLoggedIn: true,
    username: options.isAdmin ? 'admin_01' : 'teacher_01',
    teacherName: options.isAdmin ? 'Quản trị viên' : 'Cô Mai',
    isAdmin: options.isAdmin ?? false,
    teacherClass: options.teacherClass ?? '3A',
    isLoggingIn: false,
    loginError: false,
  });

  useGiftShopStore.setState({
    catalog: options.catalog ?? [],
    myOrders: [],
    managedOrders: options.orders ?? [],
    eventLogs: options.events ?? [],
    shopSettings: {
      effective: { isOpen: true, closedReason: '', closedScope: null, schoolId: 'teacher_01', classId: '3A' },
      settings: [],
    },
    loading: {
      catalog: false,
      studentOrders: false,
      managedOrders: options.isLoading ?? false,
      events: false,
      action: false,
    },
    errors: {
      catalog: null,
      studentOrders: null,
      managedOrders: options.error ?? null,
      events: null,
      action: null,
    },
    isLoading: options.isLoading ?? false,
    error: options.error ?? null,
    pendingAction: null,
    lastPurchase: null,
    loadCatalog: vi.fn(async () => undefined),
    loadStudentOrders: vi.fn(async () => undefined),
    loadManagedOrders: vi.fn(async () => undefined),
    loadEventLogs: vi.fn(async () => undefined),
    loadSettings: vi.fn(async () => undefined),
    purchaseGift: vi.fn(async () => null),
    approveOrder: vi.fn(async () => true),
    deliverOrder: vi.fn(async () => true),
    cancelOrder: vi.fn(async () => true),
    saveCatalogItem: vi.fn(async () => catalogItem),
    removeCatalogItem: vi.fn(async () => true),
    updateSettings: vi.fn(async () => true),
    clearLastPurchase: vi.fn(),
    clearError: vi.fn(),
  });
}

describe('TeacherDashboard GiftShopTab contracts', () => {
  it('keeps the legacy import path as a compatibility barrel', async () => {
    const source = await import('../src/components/TeacherDashboard/GiftShopTab?raw');
    expect(source.default.trim()).toBe("export { default } from './gift-shop-tab';");
  });

  beforeEach(() => {
    window.history.replaceState({}, '', '/teacher/gift-shop?status=PENDING');
    vi.clearAllMocks();
    resetStores();
  });

  it('forces a teacher to their own class and does not load admin event logs', async () => {
    render(<GiftShopTab />);

    const state = useGiftShopStore.getState();
    await waitFor(() => {
      expect(state.loadCatalog).toHaveBeenCalled();
      expect(state.loadManagedOrders).toHaveBeenCalledWith({
        status: 'PENDING',
        classId: '3A',
        actorUsername: 'teacher_01',
        actorIsAdmin: false,
        actorTeacherClass: '3A',
      });
    });

    expect(state.loadEventLogs).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText(/Tên lớp/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nhật ký hoạt động/i)).not.toBeInTheDocument();
  });

  it('loads admin audit data and refreshes orders when admin filters change', async () => {
    resetStores({ isAdmin: true, teacherClass: null, events: [eventLog] });
    render(<GiftShopTab />);

    const state = useGiftShopStore.getState();
    await waitFor(() => {
      expect(state.loadEventLogs).toHaveBeenCalled();
      expect(state.loadManagedOrders).toHaveBeenCalledWith(expect.objectContaining({
        status: 'PENDING',
        classId: undefined,
        actorUsername: 'admin_01',
        actorIsAdmin: true,
      }));
    });

    fireEvent.change(screen.getByPlaceholderText(/Tên lớp/i), { target: { value: '4B' } });
    await waitFor(() => {
      expect(state.loadManagedOrders).toHaveBeenCalledWith(expect.objectContaining({
        classId: '4B',
        actorIsAdmin: true,
      }));
    }, { timeout: 1500 });

    fireEvent.click(screen.getByRole('button', { name: /^Nhật ký$/i }));
    expect(screen.getByText('Đã tạo đơn đổi quà')).toBeInTheDocument();
    expect(screen.getByText(/Nhật ký hoạt động/i)).toBeInTheDocument();
  });

  it('validates catalog input, normalizes a valid payload, and resets the form', async () => {
    resetStores({ isAdmin: true, teacherClass: null });
    render(<GiftShopTab />);

    fireEvent.click(screen.getByRole('button', { name: /Thêm quà mới/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Thêm quà$/i }));
    expect(mockedShowError).toHaveBeenCalledWith('Vui lòng nhập đầy đủ tên, giá, tồn kho, giới hạn và phạm vi hợp lệ.');

    fireEvent.change(screen.getByPlaceholderText('Tên quà'), { target: { value: '  Vở ô ly  ' } });
    fireEvent.change(screen.getByDisplayValue('Ăn vặt'), { target: { value: 'SUPPLY' } });
    fireEvent.change(screen.getByPlaceholderText('Giá xu'), { target: { value: '125' } });
    fireEvent.change(screen.getByPlaceholderText(/Link ảnh/i), { target: { value: '  https://cdn.example.com/notebook.png  ' } });
    fireEvent.click(screen.getByRole('button', { name: /^Thêm quà$/i }));

    const saveCatalogItem = useGiftShopStore.getState().saveCatalogItem;
    await waitFor(() => {
      expect(saveCatalogItem).toHaveBeenCalledWith({
        id: undefined,
        name: 'Vở ô ly',
        category: 'SUPPLY',
        priceCoins: 125,
        imageUrl: 'https://cdn.example.com/notebook.png',
        isActive: true,
        stockTotal: 100,
        lowStockThreshold: 5,
        weeklyLimitPerStudent: 1,
        scopeType: 'SCHOOL',
        schoolId: undefined,
        classId: undefined,
        gradeLevel: undefined,
        actorIsAdmin: true,
      });
    });

    expect(screen.getByPlaceholderText('Tên quà')).toHaveValue('');
    expect(screen.getByPlaceholderText('Giá xu')).toHaveValue(null);
  });

  it('edits a catalog item and deletes it through the destructive confirmation contract', async () => {
    resetStores({ isAdmin: true, teacherClass: null, catalog: [catalogItem] });
    render(<GiftShopTab />);
    fireEvent.click(screen.getByRole('button', { name: /^Kho quà$/i }));

    fireEvent.click(screen.getByRole('button', { name: /^Sửa$/i }));
    expect(screen.getByPlaceholderText('Tên quà')).toHaveValue('Bút chì');
    expect(screen.getByRole('button', { name: /Cập nhật quà/i })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Tên quà'), { target: { value: 'Bút chì 2B' } });
    fireEvent.click(screen.getByRole('button', { name: /Cập nhật quà/i }));

    await waitFor(() => {
      expect(useGiftShopStore.getState().saveCatalogItem).toHaveBeenCalledWith(expect.objectContaining({
        id: 'gift-1',
        name: 'Bút chì 2B',
      }));
    });

    fireEvent.click(screen.getByRole('button', { name: /^Sửa$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Ngừng$/i }));
    expect(mockedShowConfirm).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Xóa vật phẩm "Bút chì" khỏi danh mục?',
      confirmLabel: 'Xóa',
      destructive: true,
    }));

    const confirmation = mockedShowConfirm.mock.calls.at(-1)?.[0] as { onConfirm: () => Promise<void> };
    await act(async () => confirmation.onConfirm());

    expect(useGiftShopStore.getState().removeCatalogItem).toHaveBeenCalledWith({
      id: 'gift-1',
      actorIsAdmin: true,
      actorUsername: 'admin_01',
    });
    expect(screen.getByRole('button', { name: /^Thêm quà$/i })).toBeInTheDocument();
  });

  it('approves a pending order before a voucher can be issued', async () => {
    const pendingOrder: GiftOrder = { ...managedOrder, status: 'PENDING', voucherCode: '' };
    resetStores({ orders: [pendingOrder] });
    render(<GiftShopTab />);

    fireEvent.click(screen.getByRole('button', { name: /^Duy\u1ec7t \u0111\u01a1n$/i }));

    await waitFor(() => {
      expect(useGiftShopStore.getState().approveOrder).toHaveBeenCalledWith(
        'order-1',
        { username: 'teacher_01', isAdmin: false, teacherClass: '3A' },
        expect.objectContaining({ status: 'PENDING', classId: '3A' }),
      );
    });
  });

  it('lets a teacher close their class shop with a required reason', async () => {
    render(<GiftShopTab />);

    const closeButton = screen.getByRole('button', { name: /T\u1ea1m \u0111\u00f3ng ti\u1ec7m/i });
    expect(closeButton).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/\u0110ang ki\u1ec3m k\u00ea ph\u1ea7n th\u01b0\u1edfng/i), {
      target: { value: '\u0110ang ki\u1ec3m k\u00ea kho qu\u00e0' },
    });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(useGiftShopStore.getState().updateSettings).toHaveBeenCalledWith({
        scopeType: 'CLASS',
        schoolId: undefined,
        classId: undefined,
        isOpen: false,
        closedReason: '\u0110ang ki\u1ec3m k\u00ea kho qu\u00e0',
      });
    });
  });

  it('delivers and cancels an order with the current actor and active query', async () => {
    resetStores({ orders: [managedOrder] });
    render(<GiftShopTab />);

    fireEvent.click(screen.getByRole('button', { name: /Xác nhận đã trao/i }));
    const deliverDialog = screen.getByRole('dialog', { name: /Đã trao quà/i });
    fireEvent.click(within(deliverDialog).getByRole('button', { name: /Xác nhận đã trao/i }));
    await waitFor(() => {
      expect(useGiftShopStore.getState().deliverOrder).toHaveBeenCalledWith(
        'order-1',
        { username: 'teacher_01', isAdmin: false, teacherClass: '3A' },
        expect.objectContaining({ status: 'PENDING', classId: '3A' }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /Hủy và hoàn xu/i }));
    const cancelDialog = screen.getByRole('dialog', { name: /Hủy đơn đổi quà/i });
    expect(within(cancelDialog).getByRole('button', { name: /Hủy đơn và hoàn xu/i })).toBeDisabled();
    fireEvent.change(within(cancelDialog).getByPlaceholderText(/Nhập lý do hủy đơn/i), {
      target: { value: 'Học sinh đổi ý' },
    });
    fireEvent.click(within(cancelDialog).getByRole('button', { name: /Hủy đơn và hoàn xu/i }));
    await waitFor(() => {
      expect(useGiftShopStore.getState().cancelOrder).toHaveBeenCalledWith(
        'order-1',
        { username: 'teacher_01', isAdmin: false, teacherClass: '3A' },
        'Học sinh đổi ý',
        expect.objectContaining({ status: 'PENDING', classId: '3A' }),
      );
    });
  });

  it('dismisses the store error and exposes the loading status', () => {
    resetStores({ error: 'Không tải được dữ liệu', isLoading: true });
    render(<GiftShopTab />);

    expect(screen.getByText('Không tải được dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Đang tải dữ liệu tiệm tạp hóa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo lỗi' }));
    expect(useGiftShopStore.getState().clearError).toHaveBeenCalled();
  });
});

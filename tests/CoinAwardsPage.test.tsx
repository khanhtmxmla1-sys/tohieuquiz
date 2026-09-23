import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoinAwardHistoryPage, CoinAwardReceipt } from '../shared/coin-awards.contract';

const featureFlag = vi.hoisted(() => ({
  useCoinAwardsFeatureFlag: vi.fn(),
}));
const service = vi.hoisted(() => ({
  createAward: vi.fn(),
  previewAward: vi.fn(),
  listAwardHistory: vi.fn(),
  reverseAward: vi.fn(),
  adjustAward: vi.fn(),
  getAwardSettings: vi.fn(),
  updateAwardSettings: vi.fn(),
  listMyAwardHistory: vi.fn(),
}));
const classroomService = vi.hoisted(() => ({
  getClasses: vi.fn(),
}));
const router = vi.hoisted(() => ({
  location: { pathname: '/teacher/coin-awards', state: null as unknown },
}));

vi.mock('../src/features/coin-awards/useCoinAwardsFeatureFlag', () => featureFlag);
vi.mock('../src/features/coin-awards/coinAwardsService', () => service);
vi.mock('../src/services/classroomService', () => classroomService);
vi.mock('react-router', () => ({ useLocation: () => router.location }));

import CoinAwardsPage from '../src/features/coin-awards/CoinAwardsPage';
import { useCoinAwardsStore } from '../src/features/coin-awards/useCoinAwardsStore';
import { useAuthStore } from '../stores/authStore';
import { useClassStore } from '../src/stores/useClassStore';

const receipt: CoinAwardReceipt = {
  batchId: 'batch-1',
  kind: 'AWARD',
  recipientCount: 2,
  coinsPerStudent: 20,
  totalCoins: 40,
  reason: 'Tích cực phát biểu',
  actorUsername: 'teacher-a',
  actorDisplayName: 'Cô A',
  actorRole: 'teacher',
  classId: 'class-1',
  className: 'Lớp 4A',
  createdAt: '2026-09-21T00:00:00.000Z',
  reversalExpiresAt: '2026-09-21T00:15:00.000Z',
  alreadyProcessed: false,
};

const resetStore = () => useCoinAwardsStore.setState({
  view: 'award',
  submitting: false,
  loadingHistory: false,
  loadingSettings: false,
  receipt: null,
  history: [],
  nextCursor: null,
  settings: null,
  error: null,
  idempotencyKey: 'coin-award-test-key',
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe('CoinAwardsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    featureFlag.useCoinAwardsFeatureFlag.mockReturnValue({ enabled: true, ready: true, degraded: false });
    service.createAward.mockResolvedValue(receipt);
    service.previewAward.mockResolvedValue({
      classId: 'class-1', className: 'Lớp 4A', studentIds: ['s-1', 's-2'],
      recipientCount: 2, coinsPerStudent: 20, totalCoins: 40,
      reason: 'Tích cực phát biểu', remainingTeacherDailyCoins: 1960,
    });
    service.listAwardHistory.mockResolvedValue({ items: [], nextCursor: null } satisfies CoinAwardHistoryPage);
    classroomService.getClasses.mockResolvedValue([
      { id: 'school-class-1', name: 'Lớp toàn trường' },
    ]);
    service.getAwardSettings.mockResolvedValue({
      scopeKey: 'school', maxCoinsPerStudent: 100, maxTeacherDailyCoins: 2000,
      reversalWindowMinutes: 15, updatedBy: 'admin', updatedAt: '2026-09-21T00:00:00.000Z',
    });
    resetStore();
    router.location = { pathname: '/teacher/coin-awards', state: null };
    useAuthStore.setState({
      isAdmin: false,
      username: 'teacher-a',
      teacherClasses: [{ id: 'class-1', name: 'Lớp 4A' }],
    });
    useClassStore.setState({ classes: [], isLoading: false, error: null, lastUpdatedAt: null });
  });

  it('consumes a matching roster prefill exactly once and preserves SELECTED for one student', async () => {
    useCoinAwardsStore.setState({
      awardPrefill: {
        token: 'prefill-token-1',
        actorUsername: 'teacher-a',
        classId: 'class-1',
        studentIds: ['s-1'],
        selectionMode: 'SELECTED',
      },
    });
    router.location = {
      pathname: '/teacher/coin-awards',
      state: { coinAwardPrefillToken: 'prefill-token-1' },
    };

    const { rerender } = render(<React.StrictMode><CoinAwardsPage /></React.StrictMode>);
    await screen.findByLabelText('Lý do');

    expect(screen.getByLabelText('Kiểu người nhận')).toHaveValue('SELECTED');
    expect(screen.getByLabelText('Mã học sinh')).toHaveValue('s-1');
    expect(useCoinAwardsStore.getState().awardPrefill).toBeNull();

    rerender(<React.StrictMode><CoinAwardsPage /></React.StrictMode>);
    expect(screen.getByLabelText('Mã học sinh')).toHaveValue('s-1');
    expect(useCoinAwardsStore.getState().awardPrefill).toBeNull();
  });

  it('syncs the roster selection mode when settings are already cached before the prefill arrives', async () => {
    useCoinAwardsStore.setState({
      settings: {
        scopeKey: 'school', maxCoinsPerStudent: 100, maxTeacherDailyCoins: 2000,
        reversalWindowMinutes: 15, updatedBy: 'admin', updatedAt: '2026-09-21T00:00:00.000Z',
      },
      awardPrefill: {
        token: 'prefill-token-cached-settings',
        actorUsername: 'teacher-a',
        classId: 'class-1',
        studentIds: ['s-1'],
        selectionMode: 'SELECTED',
      },
    });
    router.location = {
      pathname: '/teacher/coin-awards',
      state: { coinAwardPrefillToken: 'prefill-token-cached-settings' },
    };

    render(<CoinAwardsPage initialClassId="class-1" initialStudentIds={['legacy-student']} />);
    await screen.findByLabelText('Lý do');

    expect(screen.getByLabelText('Kiểu người nhận')).toHaveValue('SELECTED');
    expect(screen.getByLabelText('Mã học sinh')).toHaveValue('s-1');
  });

  it('discards a mismatched actor prefill and never exposes its student ids', async () => {
    useCoinAwardsStore.setState({
      awardPrefill: {
        token: 'prefill-token-actor',
        actorUsername: 'teacher-b',
        classId: 'class-1',
        studentIds: ['s-1'],
        selectionMode: 'SELECTED',
      },
    });
    router.location = {
      pathname: '/teacher/coin-awards',
      state: { coinAwardPrefillToken: 'prefill-token-actor' },
    };

    render(<CoinAwardsPage />);
    await screen.findByLabelText('Lý do');

    expect(screen.getByLabelText('Mã học sinh')).toHaveValue('');
    expect(useCoinAwardsStore.getState().awardPrefill).toBeNull();
  });

  it('clears an unconsumed prefill on a manual visit without navigation token', async () => {
    useCoinAwardsStore.setState({
      awardPrefill: {
        token: 'prefill-token-manual',
        actorUsername: 'teacher-a',
        classId: 'class-1',
        studentIds: ['s-1'],
        selectionMode: 'SELECTED',
      },
    });

    render(<CoinAwardsPage />);
    await screen.findByLabelText('Lý do');

    expect(screen.getByLabelText('Mã học sinh')).toHaveValue('');
    expect(useCoinAwardsStore.getState().awardPrefill).toBeNull();
  });

  it('shows presets and a normalized selected-recipient summary', async () => {
    render(<CoinAwardsPage initialClassId="class-1" initialStudentIds={['s-1', 's-2']} />);
    await screen.findByLabelText('Lý do');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '+20' }));
    });
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Tích cực phát biểu' } });

    expect(screen.getByText('40 xu cho 2 học sinh')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xác nhận thưởng xu' })).toBeEnabled();
  });

  it('enforces the 3-200 reason contract and offers suggested reasons', async () => {
    render(<CoinAwardsPage initialClassId="class-1" initialStudentIds={['s-1']} />);
    await screen.findByLabelText('Lý do');
    fireEvent.click(screen.getByRole('button', { name: 'Gợi ý: Tích cực phát biểu' }));
    expect(screen.getByLabelText('Lý do')).toHaveValue('Tích cực phát biểu');

    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thưởng xu' }));
    expect(screen.getByRole('alert')).toHaveTextContent('3 đến 200');
    expect(service.createAward).not.toHaveBeenCalled();
  });

  it('requires a second confirmation for all-class awards and preserves the key when closed', async () => {
    render(<CoinAwardsPage initialClassId="class-1" initialStudentIds={['s-1', 's-2']} />);
    await screen.findByLabelText('Lý do');
    fireEvent.change(screen.getByLabelText('Kiểu người nhận'), { target: { value: 'CLASS' } });
    fireEvent.click(screen.getByRole('button', { name: '+20' }));
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Cả lớp tiến bộ' } });

    const keyBefore = useCoinAwardsStore.getState().idempotencyKey;
    const trigger = screen.getByRole('button', { name: 'Xác nhận thưởng xu' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Xác nhận thưởng cho cả lớp' });
    expect(dialog).toHaveTextContent('Lớp 4A');
    expect(screen.getByRole('dialog')).toHaveTextContent('2 học sinh');
    expect(screen.getByRole('dialog')).toHaveTextContent('20 xu/người');
    expect(screen.getByRole('dialog')).toHaveTextContent('40 xu');
    const closeButton = screen.getByRole('button', { name: 'Đóng' });
    const confirmButton = screen.getByRole('button', { name: 'Xác nhận cộng xu' });
    await waitFor(() => expect(document.activeElement).toBe(closeButton));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirmButton);
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(closeButton);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(useCoinAwardsStore.getState().idempotencyKey).toBe(keyBefore);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
    expect(service.createAward).not.toHaveBeenCalled();
  });

  it('does not open or submit all-class confirmation when preview is unavailable', async () => {
    service.previewAward.mockResolvedValue(null);
    render(<CoinAwardsPage initialClassId="class-1" initialStudentIds={['s-1', 's-2']} />);
    await screen.findByLabelText('Lý do');
    fireEvent.change(screen.getByLabelText('Kiểu người nhận'), { target: { value: 'CLASS' } });
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Cả lớp tiến bộ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thưởng xu' }));

    await waitFor(() => expect(service.previewAward).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(service.createAward).not.toHaveBeenCalled();
  });

  it('freezes the all-class draft and preview details until confirmation', async () => {
    render(<CoinAwardsPage initialClassId="class-1" initialStudentIds={['s-1', 's-2']} />);
    await screen.findByLabelText('Lý do');
    fireEvent.change(screen.getByLabelText('Kiểu người nhận'), { target: { value: 'CLASS' } });
    fireEvent.click(screen.getByRole('button', { name: '+20' }));
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Cả lớp tiến bộ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thưởng xu' }));

    const dialog = await screen.findByRole('dialog', { name: 'Xác nhận thưởng cho cả lớp' });
    expect(dialog).toHaveTextContent('Còn lại trong ngày1960 xu');
    await waitFor(() => expect(document.activeElement).toHaveAttribute('aria-label', 'Đóng'));
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Nội dung đã đổi sau preview' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận cộng xu' }));

    await waitFor(() => expect(service.createAward).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'Cả lớp tiến bộ', coinsPerStudent: 20, studentIds: ['s-1', 's-2'],
    })));
  });

  it('submits a selected award and renders the receipt', async () => {
    render(<CoinAwardsPage initialClassId="class-1" initialStudentIds={['s-1', 's-2']} />);
    await screen.findByLabelText('Lý do');
    fireEvent.click(screen.getByRole('button', { name: '+20' }));
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Tích cực phát biểu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thưởng xu' }));

    expect(await screen.findByRole('dialog', { name: 'Xác nhận thưởng' })).toHaveTextContent('Còn lại trong ngày1960 xu');
    expect(service.createAward).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận cộng xu' }));

    await waitFor(() => expect(service.createAward).toHaveBeenCalledWith(expect.objectContaining({
      classId: 'class-1', studentIds: ['s-1', 's-2'], selectionMode: 'SELECTED',
      coinsPerStudent: 20, reason: 'Tích cực phát biểu', idempotencyKey: 'coin-award-test-key',
    })));
    expect(await screen.findByText('Đã cộng +40 xu')).toBeInTheDocument();
  });

  it('formats history and receipt timestamps in Hanoi time across a UTC date boundary', async () => {
    const boundaryReceipt = { ...receipt, createdAt: '2026-09-20T23:30:00.000Z' };
    useCoinAwardsStore.setState({ view: 'history', receipt: boundaryReceipt });
    service.listAwardHistory.mockResolvedValue({ items: [boundaryReceipt], nextCursor: null });

    render(<CoinAwardsPage />);

    expect(await screen.findByText('Lớp 4A · 21/09/2026 06:30')).toBeInTheDocument();
    expect(screen.getByText('Thời gian: 21/09/2026 06:30')).toBeInTheDocument();
  });

  it('previews a single student award before mutation and shows the remaining allowance', async () => {
    render(<CoinAwardsPage initialClassId="class-1" initialStudentIds={['s-1']} />);
    await screen.findByLabelText('Lý do');
    fireEvent.click(screen.getByRole('button', { name: 'Gợi ý: Tích cực phát biểu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thưởng xu' }));

    await waitFor(() => expect(service.previewAward).toHaveBeenCalledWith(expect.objectContaining({
      selectionMode: 'STUDENT', studentIds: ['s-1'], idempotencyKey: 'coin-award-test-key',
    })));
    expect(await screen.findByRole('dialog', { name: 'Xác nhận thưởng' })).toHaveTextContent('Còn lại trong ngày1960 xu');
    expect(service.createAward).not.toHaveBeenCalled();
  });

  it('does not duplicate a preview or mutation while either request is pending', async () => {
    const previewRequest = deferred<NonNullable<Awaited<ReturnType<typeof service.previewAward>>>>();
    service.previewAward.mockReturnValue(previewRequest.promise);
    render(<CoinAwardsPage initialClassId="class-1" initialStudentIds={['s-1']} />);
    await screen.findByLabelText('Lý do');
    fireEvent.click(screen.getByRole('button', { name: 'Gợi ý: Tích cực phát biểu' }));
    const trigger = screen.getByRole('button', { name: 'Xác nhận thưởng xu' });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(service.previewAward).toHaveBeenCalledTimes(1);

    previewRequest.resolve({
      classId: 'class-1', className: 'Lớp 4A', studentIds: ['s-1'], recipientCount: 1,
      coinsPerStudent: 10, totalCoins: 10, reason: 'Tích cực phát biểu', remainingTeacherDailyCoins: 1990,
    });
    await screen.findByRole('dialog', { name: 'Xác nhận thưởng' });
    const confirm = screen.getByRole('button', { name: 'Xác nhận cộng xu' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(service.createAward).toHaveBeenCalledTimes(1));
  });

  it('renders a non-mutating disabled notice without mounting the composer', () => {
    featureFlag.useCoinAwardsFeatureFlag.mockReturnValue({ enabled: false, ready: true, degraded: false });
    render(<CoinAwardsPage initialClassId="class-1" initialStudentIds={['s-1']} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Tính năng thưởng xu hiện đang tắt');
    expect(screen.queryByLabelText('Lý do')).not.toBeInTheDocument();
    expect(service.createAward).not.toHaveBeenCalled();
    expect(service.getAwardSettings).not.toHaveBeenCalled();
  });

  it('fails closed while award settings are loading and avoids concurrent loads', async () => {
    const settingsRequest = deferred<{
      scopeKey: string; maxCoinsPerStudent: number; maxTeacherDailyCoins: number;
      reversalWindowMinutes: number; updatedBy: string; updatedAt: string;
    }>();
    service.getAwardSettings.mockReturnValueOnce(settingsRequest.promise);
    render(<CoinAwardsPage initialClassId="class-1" initialStudentIds={['s-1']} />);

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải cấu hình giới hạn thưởng xu');
    expect(screen.queryByLabelText('Lý do')).not.toBeInTheDocument();
    await waitFor(() => expect(service.getAwardSettings).toHaveBeenCalledTimes(1));
    act(() => useCoinAwardsStore.getState().setView('history'));
    act(() => useCoinAwardsStore.getState().setView('award'));
    expect(service.getAwardSettings).toHaveBeenCalledTimes(1);

    settingsRequest.resolve({
      scopeKey: 'school', maxCoinsPerStudent: 50, maxTeacherDailyCoins: 2000,
      reversalWindowMinutes: 15, updatedBy: 'admin', updatedAt: '2026-09-21T00:00:00.000Z',
    });
    expect(await screen.findByLabelText('Lý do')).toBeInTheDocument();
  });

  it('shows a dedicated retry state after settings fail and mounts the composer after retry', async () => {
    service.getAwardSettings.mockRejectedValueOnce(new Error('Không thể tải cấu hình'));
    render(<CoinAwardsPage initialClassId="class-1" initialStudentIds={['s-1']} />);

    const retry = await screen.findByRole('button', { name: 'Thử lại' });
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể tải cấu hình thưởng xu');
    expect(screen.queryAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByLabelText('Lý do')).not.toBeInTheDocument();
    expect(service.previewAward).not.toHaveBeenCalled();
    expect(service.createAward).not.toHaveBeenCalled();

    service.getAwardSettings.mockResolvedValueOnce({
      scopeKey: 'school', maxCoinsPerStudent: 50, maxTeacherDailyCoins: 2000,
      reversalWindowMinutes: 15, updatedBy: 'admin', updatedAt: '2026-09-21T00:00:00.000Z',
    });
    fireEvent.click(retry);

    expect(await screen.findByLabelText('Lý do')).toBeInTheDocument();
    expect(service.getAwardSettings).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Số xu tùy chỉnh')).toHaveAttribute('max', '50');
    fireEvent.click(screen.getByRole('button', { name: 'Gợi ý: Tích cực phát biểu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thưởng xu' }));
    await waitFor(() => expect(service.previewAward).toHaveBeenCalledTimes(1));
  });

  it('fails closed for null settings and mounts award composer only after a valid retry', async () => {
    service.getAwardSettings.mockResolvedValueOnce(null);
    render(<CoinAwardsPage initialClassId="class-1" initialStudentIds={['s-1']} />);

    const retry = await screen.findByRole('button', { name: 'Thử lại' });
    expect(screen.queryByLabelText('Lý do')).not.toBeInTheDocument();
    expect(service.previewAward).not.toHaveBeenCalled();
    expect(service.createAward).not.toHaveBeenCalled();

    service.getAwardSettings.mockResolvedValueOnce({
      scopeKey: 'school', maxCoinsPerStudent: 50, maxTeacherDailyCoins: 2000,
      reversalWindowMinutes: 15, updatedBy: 'admin', updatedAt: '2026-09-21T00:00:00.000Z',
    });
    fireEvent.click(retry);

    expect(await screen.findByLabelText('Lý do')).toBeInTheDocument();
    expect(screen.getByLabelText('Số xu tùy chỉnh')).toHaveAttribute('max', '50');
    expect(service.getAwardSettings).toHaveBeenCalledTimes(2);
  });

  it('keeps the admin settings retry state across history navigation and never submits an empty settings version', async () => {
    useAuthStore.setState({ isAdmin: true });
    useCoinAwardsStore.setState({ view: 'settings' });
    service.getAwardSettings.mockRejectedValueOnce(new Error('Không thể tải cấu hình'));
    render(<CoinAwardsPage />);

    await screen.findByRole('button', { name: 'Thử lại' });
    expect(screen.queryByLabelText('Tối đa mỗi học sinh')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Lịch sử' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Cài đặt' }));
    const retry = await screen.findByRole('button', { name: 'Thử lại' });
    expect(service.getAwardSettings).toHaveBeenCalledTimes(1);

    service.getAwardSettings.mockResolvedValueOnce({
      scopeKey: 'school', maxCoinsPerStudent: 50, maxTeacherDailyCoins: 2000,
      reversalWindowMinutes: 15, updatedBy: 'admin', updatedAt: '2026-09-21T00:00:00.000Z',
    });
    fireEvent.click(retry);

    expect(await screen.findByLabelText('Tối đa mỗi học sinh')).toHaveValue(50);
    fireEvent.change(screen.getByLabelText('Lý do thay đổi'), { target: { value: 'Cập nhật giới hạn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thiết lập' }));
    await waitFor(() => expect(service.updateAwardSettings).toHaveBeenCalledTimes(1));
    expect(service.updateAwardSettings).toHaveBeenCalledWith(expect.objectContaining({
      expectedUpdatedAt: '2026-09-21T00:00:00.000Z',
    }));
    expect(service.updateAwardSettings.mock.calls.some(([input]) => input.expectedUpdatedAt === '')).toBe(false);
  });

  it('loads the configured award limit for the award view and rejects amounts above it', async () => {
    service.getAwardSettings.mockResolvedValueOnce({
      scopeKey: 'school', maxCoinsPerStudent: 50, maxTeacherDailyCoins: 2000,
      reversalWindowMinutes: 15, updatedBy: 'admin', updatedAt: '2026-09-21T00:00:00.000Z',
    });
    render(<CoinAwardsPage initialClassId="class-1" initialStudentIds={['s-1']} />);

    await waitFor(() => expect(service.getAwardSettings).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Số xu tùy chỉnh')).toHaveAttribute('max', '50');
    fireEvent.click(screen.getByRole('button', { name: 'Gợi ý: Tích cực phát biểu' }));
    fireEvent.change(screen.getByLabelText('Số xu tùy chỉnh'), { target: { value: '51' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thưởng xu' }));

    expect(screen.getByRole('alert')).toHaveTextContent('1 đến 50');
    expect(service.previewAward).not.toHaveBeenCalled();
    expect(service.getAwardSettings).toHaveBeenCalledTimes(1);
  });

  it('only exposes settings to administrators', async () => {
    useAuthStore.setState({ isAdmin: true });
    render(<CoinAwardsPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Cài đặt' }));

    expect(await screen.findByRole('heading', { name: 'Thiết lập thưởng xu' })).toBeInTheDocument();
    expect(screen.getByLabelText('Lý do thay đổi')).toBeInTheDocument();
  });

  it('enforces the settings reason length before calling the update service', async () => {
    useAuthStore.setState({ isAdmin: true });
    render(<CoinAwardsPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Cài đặt' }));
    await screen.findByRole('heading', { name: 'Thiết lập thưởng xu' });

    const reason = screen.getByLabelText('Lý do thay đổi');
    fireEvent.change(reason, { target: { value: 'x' } });
    expect(screen.getByRole('button', { name: 'Lưu thiết lập' })).toBeDisabled();
    fireEvent.change(reason, { target: { value: 'Cập nhật giới hạn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thiết lập' }));
    await waitFor(() => expect(service.updateAwardSettings).toHaveBeenCalledWith(expect.objectContaining({ reason: 'Cập nhật giới hạn' })));
  });

  it('loads all-school classes for administrators but keeps teacher class scope', async () => {
    useAuthStore.setState({ isAdmin: true, teacherClasses: [{ id: 'teacher-class', name: 'Lớp riêng' }] });
    const adminRender = render(<CoinAwardsPage />);

    await waitFor(() => expect(classroomService.getClasses).toHaveBeenCalledWith(undefined));
    expect(await screen.findByRole('option', { name: 'Lớp toàn trường' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Lớp riêng' })).not.toBeInTheDocument();

    classroomService.getClasses.mockClear();
    adminRender.unmount();
    useAuthStore.setState({ isAdmin: false, teacherClasses: [{ id: 'teacher-class', name: 'Lớp riêng' }] });
    const { unmount } = render(<CoinAwardsPage />);
    expect(screen.getByRole('option', { name: 'Lớp riêng' })).toBeInTheDocument();
    expect(classroomService.getClasses).not.toHaveBeenCalled();
    unmount();
  });

  it('lets administrators adjust a parent batch with a stable retry key', async () => {
    useAuthStore.setState({ isAdmin: true });
    useCoinAwardsStore.setState({
      view: 'history',
      history: [{ ...receipt, batchId: 'parent-batch' }],
    });
    service.listAwardHistory.mockResolvedValue({
      items: [{ ...receipt, batchId: 'parent-batch' }],
      nextCursor: null,
    });
    service.adjustAward.mockRejectedValueOnce(new Error('Tạm thời lỗi mạng')).mockResolvedValueOnce(receipt);
    render(<CoinAwardsPage />);

    expect(await screen.findByRole('button', { name: 'Điều chỉnh batch parent-batch' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Điều chỉnh batch parent-batch' }));
    expect(document.activeElement).toHaveAttribute('aria-label', 'Đóng');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Điều chỉnh batch parent-batch' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Điều chỉnh batch parent-batch' }));
    fireEvent.change(screen.getByLabelText('Mã học sinh điều chỉnh'), { target: { value: 's-1, s-2' } });
    fireEvent.change(screen.getByLabelText('Lý do điều chỉnh'), { target: { value: 'Điều chỉnh điểm danh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận điều chỉnh' }));

    await waitFor(() => expect(service.adjustAward).toHaveBeenCalledTimes(1));
    const firstInput = service.adjustAward.mock.calls[0][1];
    expect(firstInput).toMatchObject({ studentIds: ['s-1', 's-2'], reason: 'Điều chỉnh điểm danh' });
    expect(screen.getByRole('dialog', { name: 'Điều chỉnh batch parent-batch' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận điều chỉnh' }));
    await waitFor(() => expect(service.adjustAward).toHaveBeenCalledTimes(2));
    expect(service.adjustAward.mock.calls[1][1].idempotencyKey).toBe(firstInput.idempotencyKey);
  });

  it('keeps a pending adjustment modal mounted, retries the same key after failure, and restores focus after success', async () => {
    useAuthStore.setState({ isAdmin: true });
    useCoinAwardsStore.setState({
      view: 'history',
      history: [{ ...receipt, batchId: 'parent-batch' }],
    });
    service.listAwardHistory.mockResolvedValue({
      items: [{ ...receipt, batchId: 'parent-batch' }],
      nextCursor: null,
    });
    const adjustmentReceipt = { ...receipt, batchId: 'adjustment-1', kind: 'ADJUSTMENT' as const, totalCoins: -40, reversalExpiresAt: null };
    const firstRequest = deferred<CoinAwardReceipt>();
    service.adjustAward.mockReturnValueOnce(firstRequest.promise).mockResolvedValueOnce(adjustmentReceipt).mockResolvedValue(adjustmentReceipt);
    render(<CoinAwardsPage />);

    const trigger = await screen.findByRole('button', { name: 'Điều chỉnh batch parent-batch' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Điều chỉnh batch parent-batch' });
    const closeButton = screen.getByRole('button', { name: 'Đóng' });
    const confirmButton = screen.getByRole('button', { name: 'Xác nhận điều chỉnh' });
    await waitFor(() => expect(document.activeElement).toBe(closeButton));
    const firstField = screen.getByLabelText('Mã học sinh điều chỉnh');
    firstField.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirmButton);
    confirmButton.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(firstField);
    fireEvent.change(screen.getByLabelText('Mã học sinh điều chỉnh'), { target: { value: 's-1' } });
    fireEvent.change(screen.getByLabelText('Lý do điều chỉnh'), { target: { value: 'Sửa điểm danh' } });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(service.adjustAward).toHaveBeenCalledTimes(1));
    const firstKey = service.adjustAward.mock.calls[0][1].idempotencyKey;
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeDisabled();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.getByRole('dialog', { name: 'Điều chỉnh batch parent-batch' })).toBeInTheDocument();
    expect(dialog).toContainElement(document.activeElement);
    expect(service.adjustAward).toHaveBeenCalledTimes(1);

    firstRequest.reject(new Error('Mất kết nối'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Xác nhận điều chỉnh' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận điều chỉnh' }));
    await waitFor(() => expect(service.adjustAward).toHaveBeenCalledTimes(2));
    expect(service.adjustAward.mock.calls[1][1].idempotencyKey).toBe(firstKey);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Điều chỉnh batch parent-batch' })).not.toBeInTheDocument());
    const restoredTrigger = screen.getByRole('button', { name: 'Điều chỉnh batch parent-batch' });
    expect(document.activeElement).toBe(restoredTrigger);
    expect(await screen.findByText('Đã điều chỉnh -40 xu')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hoàn tác/ })).not.toBeInTheDocument();
    await waitFor(() => expect(service.listAwardHistory).toHaveBeenCalledTimes(2));

    fireEvent.click(restoredTrigger);
    fireEvent.change(screen.getByLabelText('Mã học sinh điều chỉnh'), { target: { value: 's-1' } });
    fireEvent.change(screen.getByLabelText('Lý do điều chỉnh'), { target: { value: 'Sửa điểm danh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận điều chỉnh' }));
    await waitFor(() => expect(service.adjustAward).toHaveBeenCalledTimes(3));
    expect(service.adjustAward.mock.calls[2][1].idempotencyKey).not.toBe(firstKey);
  });

  it('keeps award confirmation focus inside while the mutation is pending', async () => {
    const awardRequest = deferred<CoinAwardReceipt>();
    service.createAward.mockReturnValue(awardRequest.promise);
    render(<CoinAwardsPage initialClassId="class-1" initialStudentIds={['s-1', 's-2']} />);
    await screen.findByLabelText('Lý do');
    fireEvent.change(screen.getByLabelText('Kiểu người nhận'), { target: { value: 'CLASS' } });
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Cả lớp tiến bộ' } });
    const trigger = screen.getByRole('button', { name: 'Xác nhận thưởng xu' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Xác nhận thưởng cho cả lớp' });
    const confirmButton = screen.getByRole('button', { name: 'Xác nhận cộng xu' });
    fireEvent.click(confirmButton);
    await waitFor(() => expect(service.createAward).toHaveBeenCalledTimes(1));
    expect(confirmButton).toBeDisabled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Xác nhận thưởng cho cả lớp' })).toBeInTheDocument();
    expect(dialog).toContainElement(document.activeElement);

    awardRequest.resolve(receipt);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Xác nhận thưởng cho cả lớp' })).not.toBeInTheDocument());
  });

  it('filters history by search text and kind without dropping pagination', async () => {
    useCoinAwardsStore.setState({
      view: 'history',
      history: [
        { ...receipt, batchId: 'award-1', kind: 'AWARD', reason: 'Phát biểu tốt' },
        { ...receipt, batchId: 'reversal-1', kind: 'REVERSAL', reason: 'Trao nhầm', totalCoins: -40 },
      ],
      nextCursor: 'cursor-2',
    });
    service.listAwardHistory.mockResolvedValue({
      items: [
        { ...receipt, batchId: 'award-1', kind: 'AWARD', reason: 'Phát biểu tốt' },
        { ...receipt, batchId: 'reversal-1', kind: 'REVERSAL', reason: 'Trao nhầm', totalCoins: -40 },
      ],
      nextCursor: 'cursor-2',
    });
    render(<CoinAwardsPage />);

    expect(await screen.findByText('Phát biểu tốt')).toBeInTheDocument();
    expect(screen.getByText('Trao nhầm')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Bộ lọc loại giao dịch'), { target: { value: 'REVERSAL' } });
    expect(screen.queryByText('Phát biểu tốt')).not.toBeInTheDocument();
    expect(screen.getByText('Trao nhầm')).toBeInTheDocument();
    expect(screen.getByText('-40 xu · 2 học sinh')).toBeInTheDocument();
    expect(screen.queryByText('--40 xu · 2 học sinh')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tìm lịch sử thưởng xu'), { target: { value: 'không tồn tại' } });
    expect(screen.getByRole('status')).toHaveTextContent('Không tìm thấy giao dịch phù hợp');
    expect(screen.getByRole('button', { name: 'Xem thêm' })).toBeInTheDocument();
  });

  it('renders signed receipt facts and hides reversal after expiry or non-award kinds', async () => {
    const { rerender } = render(<CoinAwardsPage />);
    act(() => useCoinAwardsStore.setState({ receipt: { ...receipt, kind: 'REVERSAL', totalCoins: -40 } }));
    expect(await screen.findByText('Đã hoàn tác -40 xu')).toBeInTheDocument();
    expect(screen.getByText(/Người thực hiện: Cô A/)).toBeInTheDocument();
    expect(screen.getByText(/21\/09\/2026 07:00/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hoàn tác/ })).not.toBeInTheDocument();
    act(() => useCoinAwardsStore.setState({ receipt: { ...receipt, kind: 'ADJUSTMENT', totalCoins: -40, reversalExpiresAt: null } }));
    expect(await screen.findByText('Đã điều chỉnh -40 xu')).toBeInTheDocument();
    expect(screen.queryByText('Đã điều chỉnh --40 xu')).not.toBeInTheDocument();
    rerender(<CoinAwardsPage />);
  });
});

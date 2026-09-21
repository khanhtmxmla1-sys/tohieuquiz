import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { CoinAwardCreateInput, CoinAwardHistoryPage, CoinAwardReceipt } from '../shared/coin-awards.contract';

const service = vi.hoisted(() => ({
  createAward: vi.fn(),
  listAwardHistory: vi.fn(),
  listMyAwardHistory: vi.fn(),
  reverseAward: vi.fn(),
  adjustAward: vi.fn(),
  getAwardSettings: vi.fn(),
  updateAwardSettings: vi.fn(),
}));
const runtime = vi.hoisted(() => ({ resolveRuntimeFeatureFlag: vi.fn() }));

vi.mock('../src/features/coin-awards/coinAwardsService', () => service);
vi.mock('../src/services/featureRolloutService', () => runtime);

import { useCoinAwardsStore } from '../src/features/coin-awards/useCoinAwardsStore';
import { useCoinAwardsFeatureFlag } from '../src/features/coin-awards/useCoinAwardsFeatureFlag';

const input: Omit<CoinAwardCreateInput, 'idempotencyKey'> = {
  classId: 'class-1',
  studentIds: ['student-1'],
  selectionMode: 'STUDENT',
  coinsPerStudent: 20,
  reason: 'Tiến bộ tốt',
};

const receipt: CoinAwardReceipt = {
  batchId: 'batch-1',
  kind: 'AWARD',
  recipientCount: 1,
  coinsPerStudent: 20,
  totalCoins: 20,
  reason: input.reason,
  actorUsername: 'teacher-a',
  actorDisplayName: 'Cô A',
  actorRole: 'teacher',
  classId: 'class-1',
  className: 'Lớp 1',
  createdAt: '2026-09-21T00:00:00.000Z',
  reversalExpiresAt: null,
  alreadyProcessed: false,
};

const reset = () => {
  useCoinAwardsStore.setState({
    view: 'award',
    submitting: false,
    loadingHistory: false,
    loadingSettings: false,
    receipt: null,
    history: [],
    nextCursor: null,
    settings: null,
    error: null,
    idempotencyKey: 'test-key-1',
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  runtime.resolveRuntimeFeatureFlag.mockReset();
  reset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('useCoinAwardsStore', () => {
  it('locks concurrent submissions and keeps the same key after a failed request', async () => {
    let release: ((value: never) => void) | undefined;
    service.createAward.mockImplementation(() => new Promise((resolve, reject) => {
      release = reject;
      void resolve;
    }));

    const first = useCoinAwardsStore.getState().submitAward(input);
    const second = useCoinAwardsStore.getState().submitAward(input);

    expect(service.createAward).toHaveBeenCalledTimes(1);
    expect(service.createAward).toHaveBeenCalledWith({ ...input, idempotencyKey: 'test-key-1' });
    await expect(second).resolves.toBeNull();
    release?.(new Error('Mất kết nối'));
    await expect(first).resolves.toBeNull();
    expect(useCoinAwardsStore.getState().error).toBe('Mất kết nối');
    expect(useCoinAwardsStore.getState().idempotencyKey).toBe('test-key-1');
  });

  it('stores the receipt and rotates the key after a successful submission', async () => {
    service.createAward.mockResolvedValue(receipt);
    await expect(useCoinAwardsStore.getState().submitAward(input)).resolves.toEqual(receipt);

    expect(useCoinAwardsStore.getState()).toMatchObject({
      submitting: false, receipt, error: null,
    });
    expect(useCoinAwardsStore.getState().idempotencyKey).not.toBe('test-key-1');
  });

  it('does not cancel or rotate the key while a submission is still in flight', async () => {
    let release: ((value: CoinAwardReceipt) => void) | undefined;
    service.createAward.mockImplementation(() => new Promise((resolve) => {
      release = resolve;
    }));

    const first = useCoinAwardsStore.getState().submitAward(input);
    const pendingKey = useCoinAwardsStore.getState().idempotencyKey;
    useCoinAwardsStore.getState().cancelAward();

    expect(useCoinAwardsStore.getState()).toMatchObject({ submitting: true, idempotencyKey: pendingKey });
    await expect(useCoinAwardsStore.getState().submitAward(input)).resolves.toBeNull();
    expect(service.createAward).toHaveBeenCalledTimes(1);

    release?.(receipt);
    await expect(first).resolves.toEqual(receipt);
    expect(useCoinAwardsStore.getState()).toMatchObject({ submitting: false, receipt, error: null });
    expect(useCoinAwardsStore.getState().idempotencyKey).not.toBe(pendingKey);
  });

  it('loads cursor pages, appends subsequent pages, and preserves service errors', async () => {
    const firstPage: CoinAwardHistoryPage = { items: [receipt], nextCursor: 'cursor-2' };
    const secondPage: CoinAwardHistoryPage = {
      items: [{ ...receipt, batchId: 'batch-2' }], nextCursor: null,
    };
    service.listAwardHistory.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage);

    await useCoinAwardsStore.getState().loadHistory();
    await useCoinAwardsStore.getState().loadMoreHistory();
    expect(useCoinAwardsStore.getState().history.map((item) => item.batchId)).toEqual(['batch-1', 'batch-2']);
    expect(useCoinAwardsStore.getState().nextCursor).toBeNull();
    expect(service.listAwardHistory).toHaveBeenNthCalledWith(1, {});
    expect(service.listAwardHistory).toHaveBeenNthCalledWith(2, { cursor: 'cursor-2' });

    service.listAwardHistory.mockRejectedValueOnce(new Error('Không tải được lịch sử'));
    await useCoinAwardsStore.getState().loadHistory();
    expect(useCoinAwardsStore.getState().error).toBe('Không tải được lịch sử');
  });

  it('shares the history loading lock and deduplicates replacement and appended pages by batch id', async () => {
    let release: ((value: CoinAwardHistoryPage) => void) | undefined;
    service.listAwardHistory.mockImplementation(() => new Promise((resolve) => {
      release = resolve;
    }));
    service.listMyAwardHistory.mockResolvedValue({ items: [], nextCursor: null });

    const initial = useCoinAwardsStore.getState().loadHistory();
    const more = useCoinAwardsStore.getState().loadMoreHistory();
    const mine = useCoinAwardsStore.getState().loadMyHistory();
    expect(service.listAwardHistory).toHaveBeenCalledTimes(1);
    expect(service.listMyAwardHistory).not.toHaveBeenCalled();

    release?.({ items: [receipt, receipt], nextCursor: 'cursor-2' });
    await expect(initial).resolves.toBeUndefined();
    await expect(more).resolves.toBeUndefined();
    await expect(mine).resolves.toBeUndefined();
    expect(useCoinAwardsStore.getState().history.map((item) => item.batchId)).toEqual(['batch-1']);

    service.listAwardHistory.mockResolvedValueOnce({
      items: [receipt, { ...receipt, batchId: 'batch-2' }, { ...receipt, batchId: 'batch-2' }],
      nextCursor: null,
    });
    await useCoinAwardsStore.getState().loadMoreHistory();
    expect(useCoinAwardsStore.getState().history.map((item) => item.batchId)).toEqual(['batch-1', 'batch-2']);
  });

  it('rotates the key on explicit cancellation and preserves mutation errors', async () => {
    useCoinAwardsStore.getState().cancelAward();
    expect(useCoinAwardsStore.getState().idempotencyKey).not.toBe('test-key-1');
    expect(useCoinAwardsStore.getState().receipt).toBeNull();

    service.reverseAward.mockRejectedValue(new Error('Không thể hoàn tác'));
    await expect(useCoinAwardsStore.getState().reverseBatch('batch-1', 'Hoàn tác')).resolves.toBeNull();
    expect(useCoinAwardsStore.getState().error).toBe('Không thể hoàn tác');
  });

  it('fails closed on runtime flag errors and refreshes for both rollout event names', async () => {
    vi.stubEnv('VITE_FEATURE_STUDENT_COIN_AWARDS_V1', 'true');
    runtime.resolveRuntimeFeatureFlag
      .mockRejectedValueOnce(new Error('rollout unavailable'))
      .mockResolvedValue({ enabled: true });

    const { result } = renderHook(() => useCoinAwardsFeatureFlag());
    await waitFor(() => expect(result.current).toEqual({ enabled: false, ready: true, degraded: true }));

    act(() => window.dispatchEvent(new CustomEvent('tohieuquiz:feature-flag-changed', {
      detail: { key: 'student_coin_awards_v1' },
    })));
    await waitFor(() => expect(result.current).toEqual({ enabled: true, ready: true, degraded: false }));

    act(() => window.dispatchEvent(new CustomEvent('tohieuquiz:feature-flags-updated')));
    await waitFor(() => expect(runtime.resolveRuntimeFeatureFlag).toHaveBeenCalledTimes(3));
  });
});

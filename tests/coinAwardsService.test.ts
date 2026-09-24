import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CoinAwardCreateInput,
  CoinAwardHistoryPage,
  CoinAwardReceipt,
  CoinAwardSettings,
} from '../shared/coin-awards.contract';

const callApiMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/apiAdapter', () => ({
  callApi: callApiMock,
}));

import {
  adjustAward,
  createAward,
  getAwardSettings,
  listAwardHistory,
  listMyAwardHistory,
  previewAward,
  reverseAward,
  updateAwardSettings,
} from '../src/features/coin-awards/coinAwardsService';

const input: CoinAwardCreateInput = {
  classId: 'class-1',
  studentIds: ['student-1'],
  selectionMode: 'STUDENT',
  coinsPerStudent: 20,
  reason: 'Tiến bộ tốt',
  idempotencyKey: 'coin-award-key-1',
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

const settings: CoinAwardSettings = {
  scopeKey: 'school',
  maxCoinsPerStudent: 100,
  maxTeacherDailyCoins: 2000,
  reversalWindowMinutes: 15,
  updatedBy: 'admin-a',
  updatedAt: '2026-09-21T00:00:00.000Z',
};

beforeEach(() => {
  callApiMock.mockReset();
});

describe('coin award service', () => {
  it('maps preview and create calls to the typed API actions and unwraps data', async () => {
    callApiMock
      .mockResolvedValueOnce({ status: 'success', data: { ...receipt, recipientCount: 1 } })
      .mockResolvedValueOnce({ status: 'success', data: receipt });

    await expect(previewAward(input)).resolves.toMatchObject({ recipientCount: 1 });
    await expect(createAward(input)).resolves.toEqual(receipt);
    expect(callApiMock).toHaveBeenNthCalledWith(1, 'preview_coin_award', input);
    expect(callApiMock).toHaveBeenNthCalledWith(2, 'create_coin_award', input);
  });

  it('maps history, reversal, adjustment, and settings calls without leaking path fields', async () => {
    const page: CoinAwardHistoryPage = { items: [receipt], nextCursor: 'next-1' };
    callApiMock
      .mockResolvedValueOnce({ status: 'success', data: page })
      .mockResolvedValueOnce({ status: 'success', data: page })
      .mockResolvedValueOnce({ status: 'success', data: { ...receipt, kind: 'REVERSAL' } })
      .mockResolvedValueOnce({ status: 'success', data: { ...receipt, kind: 'ADJUSTMENT' } })
      .mockResolvedValueOnce({ status: 'success', data: settings })
      .mockResolvedValueOnce({ status: 'success', data: settings });

    await expect(listAwardHistory({ cursor: 'cursor-1', limit: 10 })).resolves.toEqual(page);
    await expect(listMyAwardHistory({ limit: 5 })).resolves.toEqual(page);
    await expect(reverseAward('batch-1', 'Hoàn tác')).resolves.toMatchObject({ kind: 'REVERSAL' });
    await expect(adjustAward('batch-1', {
      studentIds: ['student-1'], reason: 'Điều chỉnh', idempotencyKey: 'adjust-1',
    })).resolves.toMatchObject({ kind: 'ADJUSTMENT' });
    await expect(getAwardSettings()).resolves.toEqual(settings);
    await expect(updateAwardSettings({
      ...settings, expectedUpdatedAt: settings.updatedAt, reason: 'Cập nhật chính sách',
    })).resolves.toEqual(settings);

    expect(callApiMock).toHaveBeenNthCalledWith(1, 'list_coin_award_history', { cursor: 'cursor-1', limit: 10 });
    expect(callApiMock).toHaveBeenNthCalledWith(2, 'list_my_coin_award_history', { limit: 5 });
    expect(callApiMock).toHaveBeenNthCalledWith(3, 'reverse_coin_award', { batchId: 'batch-1', reason: 'Hoàn tác' });
    expect(callApiMock).toHaveBeenNthCalledWith(4, 'adjust_coin_award', {
      parentBatchId: 'batch-1', studentIds: ['student-1'], reason: 'Điều chỉnh', idempotencyKey: 'adjust-1',
    });
    expect(callApiMock).toHaveBeenNthCalledWith(5, 'get_coin_award_settings');
    expect(callApiMock).toHaveBeenNthCalledWith(6, 'update_coin_award_settings', expect.objectContaining({
      expectedUpdatedAt: settings.updatedAt,
    }));
  });

  it('accepts an unwrapped response for compatibility with direct API adapters', async () => {
    callApiMock.mockResolvedValue(receipt);
    await expect(createAward(input)).resolves.toEqual(receipt);
  });
});

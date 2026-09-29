// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ callApi: vi.fn() }));
vi.mock('../src/services/apiAdapter', () => ({ callApi: mocks.callApi }));

import { useAttendanceStatus } from '../src/features/student-dashboard/hooks/useAttendanceStatus';

const statusData = (overrides: Record<string, unknown> = {}) => ({
  enabled: true,
  available: true,
  questionCount: 6,
  claimedToday: false,
  claimDates: [],
  streakDays: 0,
  attendanceDayNumber: 1,
  nextRewardExp: 10,
  nextRewardCoins: 5,
  todayDateKey: '2026-08-15',
  weekStartDateKey: '2026-08-10',
  attempt: null,
  ...overrides,
});

describe('useAttendanceStatus day rollover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T16:59:59.500Z'));
    mocks.callApi.mockReset();
    mocks.callApi
      .mockResolvedValueOnce({
        status: 'success',
        data: statusData({ claimedToday: true, claimDates: ['2026-08-15'] }),
      })
      .mockResolvedValueOnce({
        status: 'success',
        data: statusData({ claimedToday: false, claimDates: ['2026-08-15'], todayDateKey: '2026-08-16' }),
      });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fails closed when attendance status cannot be verified', async () => {
    mocks.callApi.mockReset().mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useAttendanceStatus('student-a'));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.statusAvailable).toBe(false);
    expect(result.current.enabled).toBe(false);
    expect(result.current.available).toBe(false);
    expect(result.current.claimedToday).toBe(false);
  });

  it('keeps enablement and the fixed server-owned reward preview from attendance status', async () => {
    mocks.callApi.mockReset().mockResolvedValueOnce({
      status: 'success',
      data: statusData({
        attendanceDayNumber: 5,
        attempt: {
          attemptId: 'attempt-1',
          status: 'IN_PROGRESS',
          answeredCount: 1,
          correctCount: 0,
          totalQuestions: 2,
        },
      }),
    });
    const { result } = renderHook(() => useAttendanceStatus('student-a'));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.statusAvailable).toBe(true);
    expect(result.current.enabled).toBe(true);
    expect(result.current.available).toBe(true);
    expect(result.current.questionCount).toBe(6);
    expect(result.current.attempt?.answeredCount).toBe(1);
    expect(result.current.rewardPreview).toEqual({
      attendanceDayNumber: 5,
      nextRewardExp: 10,
      nextRewardCoins: 5,
    });
  });

  it('refreshes attendance when the system date rolls past midnight without a reload', async () => {
    const { result } = renderHook(() => useAttendanceStatus('student-a'));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.callApi).toHaveBeenCalledTimes(1);
    expect(result.current.claimedToday).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(mocks.callApi).toHaveBeenCalledTimes(2);
    expect(result.current.claimedToday).toBe(false);
  });
});

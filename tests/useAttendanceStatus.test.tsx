// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ callApi: vi.fn() }));
vi.mock('../src/services/apiAdapter', () => ({ callApi: mocks.callApi }));

import { useAttendanceStatus } from '../src/features/student-dashboard/hooks/useAttendanceStatus';

describe('useAttendanceStatus day rollover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T16:59:59.500Z'));
    mocks.callApi.mockReset();
    mocks.callApi
      .mockResolvedValueOnce({
        status: 'success',
        data: { claimedToday: true, claimDates: ['2026-08-15'] },
      })
      .mockResolvedValueOnce({
        status: 'success',
        data: { claimedToday: false, claimDates: ['2026-08-15'] },
      });
  });

  afterEach(() => {
    vi.useRealTimers();
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

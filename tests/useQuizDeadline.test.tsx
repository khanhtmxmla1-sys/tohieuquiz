import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createQuizDeadline,
  remainingSeconds,
  useQuizDeadline,
} from '../src/features/quiz-player/hooks/useQuizDeadline';

describe('quiz deadline', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('creates an absolute deadline and calculates remaining time from the clock', () => {
    const now = Date.parse('2026-08-04T05:00:00.000Z');
    expect(createQuizDeadline(10, now)).toBe('2026-08-04T05:10:00.000Z');
    expect(remainingSeconds('2026-08-04T05:10:00.000Z', now + 125_000)).toBe(475);
    expect(remainingSeconds('2026-08-04T05:10:00.000Z', now + 700_000)).toBe(0);
  });

  it('recomputes from Date.now after a delayed interval instead of decrementing once', () => {
    vi.setSystemTime('2026-08-04T05:00:00.000Z');
    const { result } = renderHook(() => useQuizDeadline('2026-08-04T05:10:00.000Z'));
    expect(result.current).toBe(600);

    act(() => {
      vi.setSystemTime('2026-08-04T05:02:05.000Z');
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBe(474);
  });
});

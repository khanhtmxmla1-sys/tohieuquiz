import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePracticeTopics } from '../src/features/student-dashboard/hooks/usePracticeTopics';

const practiceMocks = vi.hoisted(() => ({
  getTopics: vi.fn(),
}));

vi.mock('../src/services/practiceService', () => ({
  practiceService: {
    getTopics: practiceMocks.getTopics,
  },
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('usePracticeTopics', () => {
  beforeEach(() => {
    practiceMocks.getTopics.mockReset();
  });

  it('loads topics and clears the loading state', async () => {
    practiceMocks.getTopics.mockResolvedValueOnce([{ name: '#toan', count: 5 }]);

    const { result } = renderHook(() => usePracticeTopics());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.errorMessage).toBeNull();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.topics).toEqual([{ name: '#toan', count: 5 }]);
  });

  it('shows child-friendly local error copy and retries successfully', async () => {
    practiceMocks.getTopics
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce([{ name: '#coding', count: 8 }]);

    const { result } = renderHook(() => usePracticeTopics());

    await waitFor(() => {
      expect(result.current.errorMessage).toBe('Chưa tải được thư viện luyện tập.');
    });

    await act(async () => {
      await result.current.retry();
    });

    expect(practiceMocks.getTopics).toHaveBeenCalledTimes(2);
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.topics).toEqual([{ name: '#coding', count: 8 }]);
  });

  it('ignores an older response that finishes after a newer retry', async () => {
    const first = deferred<{ name: string; count: number }[]>();
    const second = deferred<{ name: string; count: number }[]>();
    practiceMocks.getTopics
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => usePracticeTopics());

    let retryPromise!: Promise<void>;
    act(() => {
      retryPromise = result.current.retry();
    });

    second.resolve([{ name: '#coding', count: 8 }]);
    await act(async () => {
      await retryPromise;
    });
    expect(result.current.topics).toEqual([{ name: '#coding', count: 8 }]);

    first.resolve([{ name: '#toan', count: 99 }]);
    await act(async () => {
      await first.promise;
    });

    expect(result.current.topics).toEqual([{ name: '#coding', count: 8 }]);
  });
});

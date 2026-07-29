import { describe, expect, it, vi } from 'vitest';
import {
  createIdempotencyKey,
  retryWithBackoff,
} from '../src/utils/boundedRetry';

describe('bounded retry', () => {
  it('retries transient failures with bounded exponential delays', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('temporary-1'))
      .mockRejectedValueOnce(new Error('temporary-2'))
      .mockResolvedValue('ok');
    const delays: number[] = [];

    const result = await retryWithBackoff(operation, {
      maxAttempts: 3,
      baseDelayMs: 200,
      maxDelayMs: 500,
      shouldRetry: () => true,
      sleep: async (delay) => { delays.push(delay); },
      jitterRatio: 0,
    });

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([200, 400]);
  });

  it('does not retry permanent failures and never exceeds max attempts', async () => {
    const permanent = vi.fn().mockRejectedValue(new Error('forbidden'));
    await expect(retryWithBackoff(permanent, {
      maxAttempts: 4,
      shouldRetry: () => false,
      sleep: async () => undefined,
    })).rejects.toThrow('forbidden');
    expect(permanent).toHaveBeenCalledTimes(1);

    const transient = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(retryWithBackoff(transient, {
      maxAttempts: 3,
      shouldRetry: () => true,
      sleep: async () => undefined,
      jitterRatio: 0,
    })).rejects.toThrow('offline');
    expect(transient).toHaveBeenCalledTimes(3);
  });

  it('creates non-empty request keys without exposing payload data', () => {
    const first = createIdempotencyKey('live-exam-submit');
    const second = createIdempotencyKey('live-exam-submit');
    expect(first).toMatch(/^live-exam-submit:[A-Za-z0-9-]+$/);
    expect(second).not.toBe(first);
  });
});

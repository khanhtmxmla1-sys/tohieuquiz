// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  QuizProviderStageError,
  retryTransientProviderOperation,
} from '../workers/src/services/quizGeneration/retryPolicy';

const transient = (status?: number, phase: 'network' | 'upstream' = 'upstream') => (
  new QuizProviderStageError('AI_PROVIDER_UNAVAILABLE', {
    provider: 'gemini',
    phase,
    upstreamStatus: status,
  })
);

describe('server quiz provider retry policy', () => {
  it('retries one transient 503 then returns success', async () => {
    let attempts = 0;
    const sleep = vi.fn(async () => undefined);

    const result = await retryTransientProviderOperation(async () => {
      attempts += 1;
      if (attempts === 1) throw transient(503);
      return 'ok';
    }, { sleep });

    expect(result.value).toBe('ok');
    expect(result.attempts).toBe(2);
    expect(result.lastTransientError).toMatchObject({
      code: 'AI_PROVIDER_UNAVAILABLE',
      upstreamStatus: 503,
      phase: 'upstream',
    });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(500, undefined);
  });

  it('allows at most three attempts for network/503 failures', async () => {
    let attempts = 0;
    const sleep = vi.fn(async () => undefined);

    const result = await retryTransientProviderOperation(async () => {
      attempts += 1;
      if (attempts === 1) throw transient(undefined, 'network');
      if (attempts === 2) throw transient(503);
      return 'ok';
    }, { sleep });

    expect(result.attempts).toBe(3);
    expect(sleep.mock.calls.map(([delay]) => delay)).toEqual([500, 1500]);
  });

  it('reports all attempts when transient failures exhaust the retry budget', async () => {
    let attempts = 0;
    const sleep = vi.fn(async () => undefined);

    await expect(retryTransientProviderOperation(async () => {
      attempts += 1;
      throw transient(503);
    }, { sleep })).rejects.toMatchObject({
      code: 'AI_PROVIDER_UNAVAILABLE',
      upstreamStatus: 503,
      attempts: 3,
    });

    expect(attempts).toBe(3);
    expect(sleep.mock.calls.map(([delay]) => delay)).toEqual([500, 1500]);
  });

  it.each([401, 403, 429])('does not retry upstream %s', async (status) => {
    let attempts = 0;
    const sleep = vi.fn(async () => undefined);

    await expect(retryTransientProviderOperation(async () => {
      attempts += 1;
      throw new QuizProviderStageError('AI_PROVIDER_UNAVAILABLE', {
        provider: 'gemini',
        phase: 'upstream',
        upstreamStatus: status,
      });
    }, { sleep })).rejects.toMatchObject({ upstreamStatus: status });

    expect(attempts).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('does not retry when the caller aborts', async () => {
    const controller = new AbortController();
    let attempts = 0;
    const sleep = vi.fn(async () => undefined);

    await expect(retryTransientProviderOperation(async () => {
      attempts += 1;
      controller.abort();
      throw transient(undefined, 'network');
    }, { signal: controller.signal, sleep })).rejects.toBeInstanceOf(Error);

    expect(attempts).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});

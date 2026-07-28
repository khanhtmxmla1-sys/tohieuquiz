import { describe, expect, it, vi } from 'vitest';
import { runLiveExamPreflight } from '../src/features/live-exam/liveExamPreflight';

const healthyResponse = (timestamp: string) => new Response(JSON.stringify({
  status: 'ok',
  timestamp,
}), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

describe('Live Exam preflight', () => {
  it('passes when online, cookies work, viewport is usable and server clock is close', async () => {
    const now = Date.parse('2026-07-28T12:00:00.000Z');
    const fetchImpl = vi.fn().mockResolvedValue(healthyResponse('2026-07-28T12:00:03.000Z'));

    const result = await runLiveExamPreflight({
      apiBaseUrl: 'https://worker.test',
      fetchImpl,
      now: () => now,
      online: true,
      cookieEnabled: true,
      viewport: { width: 390, height: 720 },
      timeoutMs: 1_000,
    });

    expect(result.ready).toBe(true);
    expect(result.clockDriftMs).toBe(3_000);
    expect(result.checks.every((check) => check.ok)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://worker.test/api/health',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });

  it('fails closed before network access when offline or viewport is too small', async () => {
    const fetchImpl = vi.fn();
    const result = await runLiveExamPreflight({
      apiBaseUrl: '',
      fetchImpl,
      online: false,
      cookieEnabled: true,
      viewport: { width: 250, height: 300 },
      timeoutMs: 100,
    });

    expect(result.ready).toBe(false);
    expect(result.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'online', ok: false }),
      expect.objectContaining({ id: 'viewport', ok: false }),
      expect.objectContaining({ id: 'api-health', ok: false }),
    ]));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('blocks excessive clock drift and health timeouts', async () => {
    const now = Date.parse('2026-07-28T12:00:00.000Z');
    const drifted = await runLiveExamPreflight({
      apiBaseUrl: '',
      fetchImpl: vi.fn().mockResolvedValue(healthyResponse('2026-07-28T12:01:00.000Z')),
      now: () => now,
      online: true,
      cookieEnabled: true,
      viewport: { width: 360, height: 640 },
      maxClockDriftMs: 30_000,
      timeoutMs: 100,
    });
    expect(drifted.ready).toBe(false);
    expect(drifted.checks).toContainEqual(expect.objectContaining({ id: 'clock', ok: false }));

    const timeout = await runLiveExamPreflight({
      apiBaseUrl: '',
      fetchImpl: vi.fn((_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })),
      online: true,
      cookieEnabled: true,
      viewport: { width: 360, height: 640 },
      timeoutMs: 1,
    });
    expect(timeout.ready).toBe(false);
    expect(timeout.checks).toContainEqual(expect.objectContaining({ id: 'api-health', ok: false }));
  });
});

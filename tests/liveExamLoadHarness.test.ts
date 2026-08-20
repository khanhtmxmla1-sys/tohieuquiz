import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateAcceptance,
  normalizeAuthCookie,
  percentile,
  runLiveExamLoadTest,
} from '../scripts/live-exam-load-test';

describe('Live Exam load-test harness', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calculates nearest-rank p95 latency', () => {
    expect(percentile([100, 200, 300, 400], 95)).toBe(400);
    expect(percentile([], 95)).toBe(0);
  });

  it('accepts only runs that satisfy the Live Exam concurrency gates', () => {
    expect(evaluateAcceptance({
      statusP95Ms: 499,
      submitP95Ms: 1_999,
      lostAnswers: 0,
      duplicateFailures: 0,
      d1OverloadErrors: 0,
      app5xx: 0,
    })).toMatchObject({ passed: true, failures: [] });

    const failed = evaluateAcceptance({
      statusP95Ms: 501,
      submitP95Ms: 2_001,
      lostAnswers: 1,
      duplicateFailures: 1,
      d1OverloadErrors: 1,
      app5xx: 1,
    });
    expect(failed.passed).toBe(false);
    expect(failed.failures).toHaveLength(6);
  });

  it('normalizes an auth token into the host-only auth cookie contract', () => {
    expect(normalizeAuthCookie({ authToken: 'abc.def.ghi' })).toBe('auth_token=abc.def.ghi');
    expect(normalizeAuthCookie({ cookie: 'auth_token=ready; other=1' })).toBe('auth_token=ready; other=1');
  });

  it('runs status, autosave verification, submit, and duplicate replay for concurrent fixtures', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'live-exam-load-'));
    const configPath = join(directory, 'config.json');
    await writeFile(configPath, JSON.stringify({
      baseUrl: 'https://load.test',
      sessionId: 'live-1',
      statusRounds: 1,
      warmupRequests: 0,
      students: [
        { name: 's1', cookie: 'auth_token=one', answers: { q1: 'A' } },
        { name: 's2', cookie: 'auth_token=two', answers: { q1: 'B' } },
      ],
    }));

    const snapshots = new Map<string, any>();
    const submittedAt = new Map<string, string>();
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      const headers = init?.headers as Record<string, string> | undefined;
      const cookie = headers?.Cookie || '';
      const json = (body: unknown) => new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      if (url.pathname.endsWith('/status')) {
        return json({ success: true, session: { status: 'active' } });
      }
      if (url.pathname.endsWith('/autosave') && (init?.method || 'GET') === 'GET') {
        return json({ success: true, snapshot: snapshots.get(cookie) || null });
      }
      if (url.pathname.endsWith('/autosave') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body));
        const snapshot = { attemptVersion: body.attemptVersion, answers: body.answers, updatedAt: '2026-08-19T00:00:00.000Z' };
        snapshots.set(cookie, snapshot);
        return json({ success: true, snapshot });
      }
      if (url.pathname.endsWith('/submit') && init?.method === 'POST') {
        const timestamp = submittedAt.get(cookie) || `2026-08-19T00:10:0${submittedAt.size}.000Z`;
        submittedAt.set(cookie, timestamp);
        return json({
          success: true,
          participant: { score: 10, correctCount: 1, wrongCount: 0, submittedAt: timestamp },
        });
      }
      return new Response('not found', { status: 404 });
    }));

    try {
      const result = await runLiveExamLoadTest({ configPath, concurrency: 2 });
      expect(result.acceptance).toMatchObject({ passed: true, failures: [] });
      expect(result.summary).toMatchObject({
        concurrency: 2,
        statusRequests: 2,
        autosaveWrites: 2,
        submitRequests: 2,
        duplicateRequests: 2,
        lostAnswers: 0,
        duplicateFailures: 0,
        app5xx: 0,
        requestErrors: 0,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

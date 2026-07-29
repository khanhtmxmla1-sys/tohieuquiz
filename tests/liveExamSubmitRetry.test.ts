import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('../src/utils/jwtInterceptor', () => ({
  fetchWithJWTInterceptor: fetchMock,
}));

import { submitAnswers } from '../src/services/liveExamService';

const jsonResponse = (status: number, payload: unknown): Response => new Response(JSON.stringify(payload), {
  status,
  headers: { 'content-type': 'application/json' },
});

describe('Live Exam submit retry', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('retries transient failures with the same idempotency key and payload', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, { error: 'busy' }))
      .mockResolvedValueOnce(jsonResponse(200, {
        success: true,
        participant: { score: 10, correctCount: 1, wrongCount: 0, submittedAt: '2026-07-28T00:00:00.000Z' },
      }));

    const result = await submitAnswers('session-1', { q1: 'A' }, {
      idempotencyKey: 'live-exam-submit:attempt-1',
      retry: { sleep: async () => undefined, jitterRatio: 0 },
    });

    expect(result.participant.score).toBe(10);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requests = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)));
    expect(requests).toEqual([
      { answers: { q1: 'A' }, idempotencyKey: 'live-exam-submit:attempt-1' },
      { answers: { q1: 'A' }, idempotencyKey: 'live-exam-submit:attempt-1' },
    ]);
  });

  it('does not retry validation or authorization failures', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, { error: 'Forbidden' }));

    await expect(submitAnswers('session-1', { q1: 'A' }, {
      idempotencyKey: 'live-exam-submit:attempt-2',
      retry: { sleep: async () => undefined },
    })).rejects.toThrow(/forbidden/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createClientErrorRoute } from '../workers/src/routes/clientErrors';

const env = {} as any;

const request = (body: unknown, headers: Record<string, string> = {}) => new Request(
  'https://api.thtohieu.com/api/client-errors',
  {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://www.thtohieu.com',
      ...headers,
    },
    body: JSON.stringify(body),
  },
);

describe('client error ingestion', () => {
  it('accepts only allowlisted fields and logs a redacted structured event', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const route = createClientErrorRoute({ logger });
    const response = await route(request({
      event: 'react_error_boundary',
      name: 'TypeError',
      message: 'Failed for pupil@example.test with Bearer secret-token',
      route: '/teacher/results?studentId=student-123',
      release: 'release-1',
      requestId: 'client-req-1',
      componentStack: 'at Profile (pupil@example.test)',
      time: '2026-07-27T18:00:00.000Z',
      studentId: 'student-123',
      token: 'must-not-leak',
    }, { 'x-request-id': 'edge-req-1' }), env, '/api/client-errors', 'POST');

    expect(response?.status).toBe(202);
    expect(response?.headers.get('x-request-id')).toBe('edge-req-1');
    await expect(response?.json()).resolves.toEqual({
      status: 'accepted',
      requestId: 'edge-req-1',
    });
    expect(logger.warn).toHaveBeenCalledTimes(1);

    const event = JSON.parse(String(logger.warn.mock.calls[0][0]));
    expect(event).toEqual(expect.objectContaining({
      event: 'client_error_reported',
      requestId: 'edge-req-1',
      clientRequestId: 'client-req-1',
      route: '/teacher/results',
      errorName: 'TypeError',
      errorMessage: 'Failed for [REDACTED_EMAIL] with Bearer [REDACTED]',
      release: 'release-1',
    }));
    expect(JSON.stringify(event)).not.toContain('student-123');
    expect(JSON.stringify(event)).not.toContain('must-not-leak');
    expect(JSON.stringify(event)).not.toContain('pupil@example.test');
  });

  it('rejects malformed or oversized reports without logging their body', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const route = createClientErrorRoute({ logger });

    const malformed = await route(request({ event: 'unknown', message: 'bad' }), env, '/api/client-errors', 'POST');
    const oversized = await route(request({
      event: 'react_error_boundary',
      name: 'Error',
      message: 'x'.repeat(9_000),
      route: '/',
      release: 'release-1',
      requestId: 'client-req-2',
      time: '2026-07-27T18:00:00.000Z',
    }), env, '/api/client-errors', 'POST');

    expect(malformed?.status).toBe(400);
    expect(oversized?.status).toBe(413);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});

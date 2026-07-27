import { describe, expect, it, vi } from 'vitest';
import {
  buildClientErrorReport,
  reportClientError,
} from '../src/services/observability/clientErrorReporter';

describe('client error reporter', () => {
  it('builds an allowlisted event and removes sensitive values', () => {
    const error = Object.assign(
      new Error('Request failed for pupil@example.test with Bearer secret-token eyJhbGciOiJIUzI1NiJ9.payload.signature'),
      { studentId: 'student-123', token: 'must-not-leak' },
    );

    const report = buildClientErrorReport(error, {
      event: 'react_error_boundary',
      componentStack: 'at Profile (pupil@example.test) Bearer another-secret',
      route: '/teacher/results?studentId=student-123#answers',
      release: 'release-2026.07.27',
      requestId: 'req-test-1',
      now: () => new Date('2026-07-27T18:00:00.000Z'),
    });

    expect(report).toEqual({
      event: 'react_error_boundary',
      name: 'Error',
      message: 'Request failed for [REDACTED_EMAIL] with Bearer [REDACTED] [REDACTED_JWT]',
      route: '/teacher/results',
      release: 'release-2026.07.27',
      requestId: 'req-test-1',
      componentStack: 'at Profile ([REDACTED_EMAIL]) Bearer [REDACTED]',
      time: '2026-07-27T18:00:00.000Z',
    });
    expect(JSON.stringify(report)).not.toContain('student-123');
    expect(JSON.stringify(report)).not.toContain('must-not-leak');
  });

  it('uses the provided transport and never throws when reporting fails', async () => {
    const transport = vi.fn().mockRejectedValue(new Error('telemetry unavailable'));

    expect(() => reportClientError(new Error('Render failed'), {
      event: 'react_error_boundary',
      endpoint: '/api/client-errors',
      requestId: 'req-test-2',
      transport,
    })).not.toThrow();

    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
    expect(transport).toHaveBeenCalledWith(
      '/api/client-errors',
      expect.objectContaining({
        event: 'react_error_boundary',
        requestId: 'req-test-2',
      }),
    );
  });

  it('truncates unbounded diagnostic text', () => {
    const report = buildClientErrorReport(new Error('x'.repeat(5_000)), {
      event: 'stale_chunk_error',
      componentStack: 'y'.repeat(8_000),
      requestId: 'req-test-3',
    });

    expect(report.message.length).toBeLessThanOrEqual(1_000);
    expect(report.componentStack?.length).toBeLessThanOrEqual(2_000);
  });
});

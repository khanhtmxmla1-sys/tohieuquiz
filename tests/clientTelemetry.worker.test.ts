import { describe, expect, it, vi } from 'vitest';
import { createClientTelemetryRoute } from '../workers/src/routes/clientTelemetry';

const env = {} as any;
const request = (body: unknown) => new Request(
  'https://api.thtohieu.com/api/client-telemetry',
  {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://www.thtohieu.com',
      'x-request-id': 'edge-vital-1',
    },
    body: JSON.stringify(body),
  },
);

describe('client telemetry ingestion', () => {
  it('logs only allowlisted Web Vital fields without URL query or PII', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const route = createClientTelemetryRoute({ logger });
    const response = await route(request({
      kind: 'web_vital',
      name: 'LCP',
      value: 2_400,
      rating: 'good',
      route: '/teacher/results?studentId=student-123',
      release: 'release-1',
      requestId: 'client-vital-1',
      email: 'pupil@example.test',
      answer: 'must-not-leak',
    }), env, '/api/client-telemetry', 'POST');

    expect(response?.status).toBe(202);
    expect(response?.headers.get('x-request-id')).toBe('edge-vital-1');
    const event = JSON.parse(String(logger.info.mock.calls[0][0]));
    expect(event).toEqual(expect.objectContaining({
      event: 'client_web_vital',
      requestId: 'edge-vital-1',
      clientRequestId: 'client-vital-1',
      route: '/teacher/results',
      release: 'release-1',
      metricName: 'LCP',
      metricValue: 2_400,
      metricRating: 'good',
    }));
    expect(JSON.stringify(event)).not.toContain('student-123');
    expect(JSON.stringify(event)).not.toContain('pupil@example.test');
    expect(JSON.stringify(event)).not.toContain('must-not-leak');
  });

  it('rejects unknown metrics and invalid values without logging', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const route = createClientTelemetryRoute({ logger });
    const unknown = await route(request({
      kind: 'web_vital', name: 'EMAIL', value: 1, rating: 'good',
    }), env, '/api/client-telemetry', 'POST');
    const invalid = await route(request({
      kind: 'web_vital', name: 'CLS', value: Number.POSITIVE_INFINITY, rating: 'poor',
    }), env, '/api/client-telemetry', 'POST');

    expect(unknown?.status).toBe(400);
    expect(invalid?.status).toBe(400);
    expect(logger.info).not.toHaveBeenCalled();
  });
});

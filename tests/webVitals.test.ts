import { describe, expect, it, vi } from 'vitest';
import {
  buildWebVitalReport,
  reportWebVital,
  shouldSampleWebVitals,
} from '../src/observability/webVitals';

describe('privacy-safe Web Vitals telemetry', () => {
  it('keeps only the pathname and allowlisted metric fields', () => {
    const report = buildWebVitalReport({
      name: 'LCP',
      value: 2_345.4,
      rating: 'good',
    } as any, {
      route: '/teacher/results?studentId=student-123#answers',
      release: 'release-1',
      requestId: 'client-vital-1',
      now: () => new Date('2026-07-29T08:00:00.000Z'),
    });

    expect(report).toEqual({
      kind: 'web_vital',
      name: 'LCP',
      value: 2_345.4,
      rating: 'good',
      route: '/teacher/results',
      release: 'release-1',
      requestId: 'client-vital-1',
      time: '2026-07-29T08:00:00.000Z',
    });
    expect(JSON.stringify(report)).not.toContain('student-123');
  });

  it('uses deterministic session sampling boundaries', () => {
    expect(shouldSampleWebVitals(0.1, () => 0.099)).toBe(true);
    expect(shouldSampleWebVitals(0.1, () => 0.1)).toBe(false);
    expect(shouldSampleWebVitals(0, () => 0)).toBe(false);
    expect(shouldSampleWebVitals(1, () => 0.099)).toBe(true);
    expect(shouldSampleWebVitals(1, () => 0.1)).toBe(false);
  });

  it('uses the provided transport and never throws on telemetry failure', async () => {
    const transport = vi.fn().mockRejectedValue(new Error('offline'));
    expect(() => reportWebVital({
      name: 'INP',
      value: 180,
      rating: 'good',
    } as any, {
      endpoint: '/api/client-telemetry',
      requestId: 'client-vital-2',
      transport,
    })).not.toThrow();

    await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce());
    expect(transport).toHaveBeenCalledWith(
      '/api/client-telemetry',
      expect.objectContaining({ name: 'INP', requestId: 'client-vital-2' }),
    );
  });
});

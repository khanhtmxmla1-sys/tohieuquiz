import { describe, expect, it } from 'vitest';
import { buildOperationsSnapshot, runOperationsProbe } from '../workers/src/services/operationsService';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, private readonly failCertificates = false) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() {
    if (this.sql.includes('SELECT 1 AS count')) return { count: 1 } as T;
    if (this.sql.includes('FROM d1_migrations')) return { count: 62, latest: '0063_certificate_footer_safe_zone.sql' } as T;
    if (this.sql.includes('FROM certificate_batches')) {
      if (this.failCertificates) throw new Error('sensitive database failure');
      return { pending_count: 1, processing_count: 0, failed_count: 0, stale_processing_count: 0 } as T;
    }
    if (this.sql.includes('FROM ai_generation_actions')) {
      return { total_count: 20, failed_count: 0, reserved_count: 0 } as T;
    }
    return null as T;
  }
  async all<T>() {
    if (this.sql.includes('FROM system_settings')) {
      return { results: [
        { setting_key: 'ai_assistant_enabled', setting_value: 'true' },
        { setting_key: 'unified_notifications_v1', setting_value: 'false' },
      ] as T[] };
    }
    return { results: [] as T[] };
  }
}

const env = (
  options: { r2Fails?: boolean; certificateQueryFails?: boolean } = {},
  prepared: Statement[] = [],
) => ({
  DB: {
    prepare: (sql: string) => {
      const statement = new Statement(sql, options.certificateQueryFails);
      prepared.push(statement);
      return statement;
    },
  },
  CERTIFICATE_QUEUE: { send: async () => undefined },
  CERT_IMAGES: { head: async () => options.r2Fails ? Promise.reject(new Error('bucket-id-secret')) : null },
  OG_IMAGES: { head: async () => null },
  AI_GATEWAY: { fetch: async () => new Response() },
  LAST_D1_BACKUP_AT: '2026-07-29T06:00:00.000Z',
  LAST_D1_RESTORE_DRILL_AT: '2026-07-01T00:00:00.000Z',
  APP_RELEASE: 'release-31',
} as any);

describe('operations snapshot service', () => {
  it('returns every component while isolating a broken R2 dependency', async () => {
    const snapshot = await buildOperationsSnapshot(env({ r2Fails: true }), {
      now: () => new Date('2026-07-29T08:00:00.000Z'),
      timeoutMs: 100,
      requestId: 'req-ops-service',
    });

    expect(snapshot.requestId).toBe('req-ops-service');
    expect(snapshot.components).toHaveLength(10);
    expect(snapshot.overallStatus).toBe('degraded');
    expect(snapshot.components.find((item) => item.id === 'd1')?.status).toBe('healthy');
    expect(snapshot.components.find((item) => item.id === 'migrations')).toMatchObject({
      status: 'healthy',
      metrics: [
        { key: 'appliedCount', value: 62 },
        { key: 'latestIsExpected', value: true },
      ],
    });
    expect(snapshot.components.find((item) => item.id === 'r2')).toMatchObject({
      status: 'unavailable',
      code: 'PROBE_FAILED',
    });
    expect(JSON.stringify(snapshot)).not.toContain('bucket-id-secret');
  });

  it('measures AI health with an absolute rolling 24-hour timestamp window', async () => {
    const prepared: Statement[] = [];
    await buildOperationsSnapshot(env({}, prepared), {
      now: () => new Date('2026-07-29T08:00:00.000Z'),
      timeoutMs: 100,
    });

    const aiQuery = prepared.find((statement) => statement.sql.includes('FROM ai_generation_actions'));
    expect(aiQuery?.sql).toContain('created_at >= ?');
    expect(aiQuery?.bindings).toEqual(['2026-07-28T08:00:00.000Z']);
  });

  it('keeps independent certificate and queue components useful when their query fails', async () => {
    const snapshot = await buildOperationsSnapshot(env({ certificateQueryFails: true }), {
      now: () => new Date('2026-07-29T08:00:00.000Z'),
      timeoutMs: 100,
    });

    expect(snapshot.components.find((item) => item.id === 'api')?.status).toBe('healthy');
    expect(snapshot.components.find((item) => item.id === 'queue')?.status).toBe('unavailable');
    expect(snapshot.components.find((item) => item.id === 'certificates')?.status).toBe('unavailable');
    expect(JSON.stringify(snapshot)).not.toContain('sensitive database failure');
  });

  it('times out one probe without rejecting the snapshot pipeline', async () => {
    const component = await runOperationsProbe(
      'r2',
      'R2',
      '2026-07-29T08:00:00.000Z',
      () => new Promise(() => undefined),
      10,
    );
    expect(component).toMatchObject({ status: 'unavailable', code: 'PROBE_TIMEOUT' });
  });
});

import type {
  OperationsComponent,
  OperationsComponentId,
  OperationsComponentStatus,
  OperationsMetric,
  OperationsSnapshot,
} from '../../../shared/operations.contract';
import type { Env } from '../types';

export const EXPECTED_LATEST_MIGRATION = '0061_assignment_revocation.sql';
const DEFAULT_TIMEOUT_MS = 1_000;
const STALE_CERTIFICATE_MS = 10 * 60 * 1_000;
const BACKUP_STALE_MS = 26 * 60 * 60 * 1_000;
const RESTORE_DRILL_STALE_MS = 100 * 24 * 60 * 60 * 1_000;

interface ProbeResult {
  status: OperationsComponentStatus;
  summary: string;
  code?: string;
  metrics?: OperationsMetric[];
}

interface OperationsServiceOptions {
  now?: () => Date;
  timeoutMs?: number;
  release?: string;
  requestId?: string;
}

interface CountRow {
  count: number;
}

interface MigrationRow {
  count: number;
  latest: string | null;
}

interface CertificateHealthRow {
  pending_count: number;
  processing_count: number;
  failed_count: number;
  stale_processing_count: number;
}

interface AiHealthRow {
  total_count: number;
  failed_count: number;
  reserved_count: number;
}

const safeTimeoutMs = (value: number | undefined): number => {
  if (!Number.isFinite(value)) return DEFAULT_TIMEOUT_MS;
  return Math.min(5_000, Math.max(100, Math.floor(value!)));
};

const timeoutResult = (): ProbeResult => ({
  status: 'unavailable',
  summary: 'Probe timed out before a safe result was available.',
  code: 'PROBE_TIMEOUT',
});

const failedResult = (): ProbeResult => ({
  status: 'unavailable',
  summary: 'Probe failed without exposing dependency details.',
  code: 'PROBE_FAILED',
});

export async function runOperationsProbe(
  id: OperationsComponentId,
  label: string,
  checkedAt: string,
  probe: () => Promise<ProbeResult>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  nowMs: () => number = Date.now,
): Promise<OperationsComponent> {
  const startedAt = nowMs();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      probe(),
      new Promise<ProbeResult>((resolve) => {
        timer = setTimeout(() => resolve(timeoutResult()), safeTimeoutMs(timeoutMs));
      }),
    ]);
    return {
      id,
      label,
      checkedAt,
      latencyMs: Math.max(0, nowMs() - startedAt),
      status: result.status,
      summary: result.summary,
      ...(result.code ? { code: result.code } : {}),
      metrics: result.metrics || [],
    };
  } catch {
    return {
      id,
      label,
      checkedAt,
      latencyMs: Math.max(0, nowMs() - startedAt),
      ...failedResult(),
      metrics: [],
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const numeric = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;

const parseDateAge = (value: string | undefined, now: Date): number | null => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, now.getTime() - timestamp) : null;
};

const overallStatus = (components: OperationsComponent[]): OperationsComponentStatus => {
  const critical = components.filter((component) => component.id === 'api' || component.id === 'd1');
  if (critical.some((component) => component.status === 'unavailable')) return 'unavailable';
  if (components.some((component) => component.status === 'unavailable' || component.status === 'degraded')) {
    return 'degraded';
  }
  if (components.some((component) => component.status === 'unknown')) return 'unknown';
  return 'healthy';
};

const probeD1 = async (env: Env): Promise<ProbeResult> => {
  const row = await env.DB.prepare('SELECT 1 AS count').first<CountRow>();
  return numeric(row?.count) === 1
    ? { status: 'healthy', summary: 'D1 responded to a read-only probe.' }
    : { status: 'degraded', summary: 'D1 responded with an unexpected probe result.', code: 'UNEXPECTED_RESULT' };
};

const probeMigrations = async (env: Env): Promise<ProbeResult> => {
  const row = await env.DB.prepare(`
    SELECT COUNT(*) AS count,
           (SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 1) AS latest
    FROM d1_migrations
  `).first<MigrationRow>();
  const count = numeric(row?.count);
  const latest = row?.latest || null;
  const current = latest === EXPECTED_LATEST_MIGRATION;
  return {
    status: current ? 'healthy' : 'degraded',
    summary: current ? 'Migration registry is current.' : 'Migration registry does not match the expected release.',
    ...(current ? {} : { code: 'MIGRATION_DRIFT' }),
    metrics: [
      { key: 'appliedCount', value: count },
      { key: 'latestIsExpected', value: current },
    ],
  };
};

const loadCertificateHealth = async (env: Env, now: Date): Promise<CertificateHealthRow> => {
  const staleBefore = new Date(now.getTime() - STALE_CERTIFICATE_MS).toISOString();
  const row = await env.DB.prepare(`
    SELECT
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing_count,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
      SUM(CASE WHEN status = 'processing' AND processing_started_at < ? THEN 1 ELSE 0 END) AS stale_processing_count
    FROM certificate_batches
    WHERE created_at >= datetime('now', '-7 days')
  `).bind(staleBefore).first<CertificateHealthRow>();
  return {
    pending_count: numeric(row?.pending_count),
    processing_count: numeric(row?.processing_count),
    failed_count: numeric(row?.failed_count),
    stale_processing_count: numeric(row?.stale_processing_count),
  };
};

const certificateMetrics = (row: CertificateHealthRow): OperationsMetric[] => [
  { key: 'pending7d', value: row.pending_count },
  { key: 'processing7d', value: row.processing_count },
  { key: 'failed7d', value: row.failed_count },
  { key: 'staleProcessing', value: row.stale_processing_count },
];

const probeQueue = async (env: Env, now: Date): Promise<ProbeResult> => {
  if (!env.CERTIFICATE_QUEUE) {
    return { status: 'unavailable', summary: 'Certificate queue binding is not configured.', code: 'QUEUE_NOT_CONFIGURED' };
  }
  const health = await loadCertificateHealth(env, now);
  const degraded = health.stale_processing_count > 0 || health.failed_count > 0;
  return {
    status: degraded ? 'degraded' : 'healthy',
    summary: degraded
      ? 'Queue-derived certificate work contains failed or stale processing records.'
      : 'Queue binding is configured and certificate work has no stale processing records.',
    ...(degraded ? { code: 'QUEUE_WORK_DEGRADED' } : {}),
    metrics: certificateMetrics(health),
  };
};

const probeDlq = async (env: Env): Promise<ProbeResult> => {
  if (!env.CERTIFICATE_DLQ) {
    return {
      status: 'unknown',
      summary: 'No readable DLQ binding is configured for runtime depth checks.',
      code: 'DLQ_DEPTH_UNAVAILABLE',
    };
  }
  return {
    status: 'unknown',
    summary: 'DLQ binding is configured, but Queue bindings do not expose depth to Workers.',
    code: 'DLQ_DEPTH_UNAVAILABLE',
    metrics: [{ key: 'bindingConfigured', value: true }],
  };
};

const probeR2 = async (env: Env): Promise<ProbeResult> => {
  const buckets = [env.CERT_IMAGES, env.OG_IMAGES].filter(Boolean);
  if (buckets.length < 2) {
    return { status: 'unavailable', summary: 'One or more required R2 bindings are not configured.', code: 'R2_NOT_CONFIGURED' };
  }
  await Promise.all(buckets.map((bucket) => bucket.head('__operations_read_probe__')));
  return {
    status: 'healthy',
    summary: 'Required R2 buckets accepted read-only metadata probes.',
    metrics: [{ key: 'probedBuckets', value: buckets.length }],
  };
};

const probeAi = async (env: Env): Promise<ProbeResult> => {
  const row = await env.DB.prepare(`
    SELECT COUNT(*) AS total_count,
           SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
           SUM(CASE WHEN status = 'RESERVED' THEN 1 ELSE 0 END) AS reserved_count
    FROM ai_generation_actions
    WHERE usage_date >= date('now', '-1 day')
  `).first<AiHealthRow>();
  const total = numeric(row?.total_count);
  const failed = numeric(row?.failed_count);
  const reserved = numeric(row?.reserved_count);
  const failureRate = total > 0 ? failed / total : 0;
  const configured = Boolean(env.AI_GATEWAY);
  const degraded = !configured || failureRate > 0.05 || reserved > 20;
  return {
    status: configured ? (degraded ? 'degraded' : 'healthy') : 'unavailable',
    summary: !configured
      ? 'AI gateway binding is not configured.'
      : degraded
        ? 'Recent AI actions exceed the operational failure or reservation threshold.'
        : 'AI gateway is configured and recent action health is within threshold.',
    ...(!configured ? { code: 'AI_NOT_CONFIGURED' } : degraded ? { code: 'AI_ACTIONS_DEGRADED' } : {}),
    metrics: [
      { key: 'actions24h', value: total },
      { key: 'failed24h', value: failed },
      { key: 'reserved24h', value: reserved },
    ],
  };
};

const probeCertificates = async (env: Env, now: Date): Promise<ProbeResult> => {
  const health = await loadCertificateHealth(env, now);
  const degraded = health.failed_count > 0 || health.stale_processing_count > 0;
  return {
    status: degraded ? 'degraded' : 'healthy',
    summary: degraded
      ? 'Certificate processing contains failed or stale batches.'
      : 'Certificate batches are within operational thresholds.',
    ...(degraded ? { code: 'CERTIFICATE_PROCESSING_DEGRADED' } : {}),
    metrics: certificateMetrics(health),
  };
};

const probeBackup = async (env: Env, now: Date): Promise<ProbeResult> => {
  const backupAge = parseDateAge(env.LAST_D1_BACKUP_AT, now);
  const drillAge = parseDateAge(env.LAST_D1_RESTORE_DRILL_AT, now);
  if (backupAge === null || drillAge === null) {
    return {
      status: 'unknown',
      summary: 'Backup or restore-drill evidence has not been published to runtime metadata.',
      code: 'BACKUP_EVIDENCE_MISSING',
      metrics: [
        { key: 'backupEvidencePresent', value: backupAge !== null },
        { key: 'restoreDrillEvidencePresent', value: drillAge !== null },
      ],
    };
  }
  const degraded = backupAge > BACKUP_STALE_MS || drillAge > RESTORE_DRILL_STALE_MS;
  return {
    status: degraded ? 'degraded' : 'healthy',
    summary: degraded ? 'Backup or restore-drill evidence is stale.' : 'Backup and restore-drill evidence is current.',
    ...(degraded ? { code: 'BACKUP_EVIDENCE_STALE' } : {}),
    metrics: [
      { key: 'backupAgeHours', value: Math.round(backupAge / 3_600_000) },
      { key: 'restoreDrillAgeDays', value: Math.round(drillAge / 86_400_000) },
    ],
  };
};

const probeFlags = async (env: Env): Promise<ProbeResult> => {
  const rows = await env.DB.prepare(`
    SELECT setting_key, setting_value
    FROM system_settings
    WHERE setting_key IN ('ai_assistant_enabled', 'unified_notifications_v1')
    ORDER BY setting_key
  `).all<{ setting_key: string; setting_value: string }>();
  const values = new Map((rows.results || []).map((row) => [row.setting_key, row.setting_value]));
  const complete = values.has('ai_assistant_enabled') && values.has('unified_notifications_v1');
  return {
    status: complete ? 'healthy' : 'degraded',
    summary: complete ? 'Operational feature flags were loaded.' : 'One or more operational feature flags are missing.',
    ...(complete ? {} : { code: 'FEATURE_FLAG_MISSING' }),
    metrics: [
      { key: 'aiAssistantEnabled', value: values.get('ai_assistant_enabled') === 'true' },
      { key: 'unifiedNotificationsEnabled', value: values.get('unified_notifications_v1') === 'true' },
    ],
  };
};

export async function buildOperationsSnapshot(
  env: Env,
  options: OperationsServiceOptions = {},
): Promise<OperationsSnapshot> {
  const now = options.now?.() ?? new Date();
  const checkedAt = now.toISOString();
  const timeoutMs = safeTimeoutMs(options.timeoutMs
    ?? Number(env.OPERATIONS_PROBE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const probe = (
    id: OperationsComponentId,
    label: string,
    fn: () => Promise<ProbeResult>,
  ) => runOperationsProbe(id, label, checkedAt, fn, timeoutMs);

  const components = await Promise.all([
    probe('api', 'Worker API', async () => ({ status: 'healthy', summary: 'Operations endpoint is serving requests.' })),
    probe('d1', 'D1 database', () => probeD1(env)),
    probe('migrations', 'D1 migrations', () => probeMigrations(env)),
    probe('queue', 'Certificate queue', () => probeQueue(env, now)),
    probe('dlq', 'Certificate DLQ', () => probeDlq(env)),
    probe('r2', 'R2 storage', () => probeR2(env)),
    probe('ai', 'AI gateway', () => probeAi(env)),
    probe('certificates', 'Certificate processing', () => probeCertificates(env, now)),
    probe('backup', 'D1 backup evidence', () => probeBackup(env, now)),
    probe('feature_flags', 'Feature flags', () => probeFlags(env)),
  ]);

  return {
    overallStatus: overallStatus(components),
    checkedAt,
    requestId: String(options.requestId || 'unknown').slice(0, 128),
    release: String(options.release ?? env.APP_RELEASE ?? 'unknown').slice(0, 100),
    components,
  };
}

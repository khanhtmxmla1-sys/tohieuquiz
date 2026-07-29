import type {
  FeatureAudience,
  FeatureFlagConfig,
  FeatureFlagPatch,
  FeatureFlagResolution,
  FeatureFlagSubject,
  FeatureRolloutStopConditions,
} from '../../../shared/feature-rollout.contract';

interface FeatureFlagRow {
  flag_key: string;
  description: string;
  enabled: number;
  owner: string;
  version: number;
  audience: FeatureAudience;
  percentage: number;
  allow_users_json: string;
  allow_classes_json: string;
  starts_at: string | null;
  ends_at: string | null;
  stop_conditions_json: string;
  reason: string;
  updated_by: string;
  updated_at: string;
}

const FLAG_SELECT = `
  SELECT f.flag_key, f.description, f.enabled, f.owner, f.version,
         r.audience, r.percentage, r.allow_users_json, r.allow_classes_json,
         r.starts_at, r.ends_at, r.stop_conditions_json, r.reason,
         r.updated_by, r.updated_at
  FROM feature_flags f
  JOIN feature_flag_rules r ON r.flag_key = f.flag_key
`;

const safeText = (value: unknown, max = 256): string => (
  String(value ?? '').replace(/[\r\n\t]/g, ' ').trim().slice(0, max)
);

const stringArray = (value: unknown, maxItems = 200): string[] => {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(source.map((item) => safeText(item, 128)).filter(Boolean))].slice(0, maxItems);
};

const parseJson = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const mapRow = (row: FeatureFlagRow): FeatureFlagConfig => ({
  key: row.flag_key,
  description: row.description,
  enabled: row.enabled === 1,
  audience: row.audience,
  percentage: row.percentage,
  allowUsers: stringArray(parseJson(row.allow_users_json, [])),
  allowClasses: stringArray(parseJson(row.allow_classes_json, [])),
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  owner: row.owner,
  reason: row.reason,
  stopConditions: parseJson<FeatureRolloutStopConditions>(row.stop_conditions_json, {}),
  version: row.version,
  updatedBy: row.updated_by,
  updatedAt: row.updated_at,
});

const validDateOrNull = (value: unknown): string | null => {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error('FEATURE_FLAG_INVALID_DATE');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('FEATURE_FLAG_INVALID_DATE');
  return date.toISOString();
};

const normalizeStopConditions = (value: unknown): FeatureRolloutStopConditions => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('FEATURE_FLAG_INVALID_STOP_CONDITIONS');
  }
  const input = value as Record<string, unknown>;
  const output: FeatureRolloutStopConditions = {};
  const limits: Array<[keyof FeatureRolloutStopConditions, number, number]> = [
    ['max5xxRatePercent', 0, 100],
    ['maxClientErrorMultiplier', 1, 100],
    ['maxP95IncreasePercent', 0, 1000],
    ['maxSupportTickets', 0, 1_000_000],
  ];
  for (const [key, min, max] of limits) {
    if (input[key] === undefined || input[key] === null || input[key] === '') continue;
    const number = Number(input[key]);
    if (!Number.isFinite(number) || number < min || number > max) {
      throw new Error('FEATURE_FLAG_INVALID_STOP_CONDITIONS');
    }
    output[key] = number;
  }
  return output;
};

const normalizePatchValue = (patch: FeatureFlagPatch): unknown => {
  switch (patch.field) {
    case 'enabled':
      if (typeof patch.value !== 'boolean') throw new Error('FEATURE_FLAG_INVALID_BOOLEAN');
      return patch.value;
    case 'description':
      return safeText(patch.value, 500);
    case 'audience': {
      const value = safeText(patch.value, 20) as FeatureAudience;
      if (!['all', 'admin', 'teacher', 'student', 'parent'].includes(value)) {
        throw new Error('FEATURE_FLAG_INVALID_AUDIENCE');
      }
      return value;
    }
    case 'percentage': {
      const value = Number(patch.value);
      if (!Number.isInteger(value) || value < 0 || value > 100) {
        throw new Error('FEATURE_FLAG_INVALID_PERCENTAGE');
      }
      return value;
    }
    case 'allowUsers':
    case 'allowClasses':
      if (!Array.isArray(patch.value)) throw new Error('FEATURE_FLAG_INVALID_ALLOWLIST');
      return stringArray(patch.value);
    case 'startsAt':
    case 'endsAt':
      return validDateOrNull(patch.value);
    case 'owner':
      return safeText(patch.value, 128);
    case 'stopConditions':
      return normalizeStopConditions(patch.value);
  }
};

export async function stableFeatureBucket(flagKey: string, subjectKey: string): Promise<number> {
  const bytes = new TextEncoder().encode(`${safeText(flagKey, 128)}:${safeText(subjectKey, 256)}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const integer = new DataView(digest.buffer, digest.byteOffset, digest.byteLength).getUint32(0, false);
  return integer / 0x1_0000_0000 * 100;
}

export async function resolveFeatureFlag(
  config: FeatureFlagConfig,
  subject: FeatureFlagSubject,
  now = new Date(),
): Promise<FeatureFlagResolution> {
  if (!config.enabled) {
    return { key: config.key, enabled: false, reason: 'disabled', bucket: null, version: config.version };
  }
  const timestamp = now.getTime();
  if ((config.startsAt && timestamp < new Date(config.startsAt).getTime())
    || (config.endsAt && timestamp >= new Date(config.endsAt).getTime())) {
    return { key: config.key, enabled: false, reason: 'outside_window', bucket: null, version: config.version };
  }
  const username = safeText(subject.username, 128);
  const classIds = stringArray(subject.classIds || []);
  if ((username && config.allowUsers.includes(username))
    || classIds.some((classId) => config.allowClasses.includes(classId))) {
    return { key: config.key, enabled: true, reason: 'allowlist', bucket: null, version: config.version };
  }
  if (config.audience !== 'all' && config.audience !== subject.role) {
    return { key: config.key, enabled: false, reason: 'audience', bucket: null, version: config.version };
  }
  const subjectKey = username || classIds[0] || `${subject.role}:anonymous`;
  const bucket = await stableFeatureBucket(config.key, subjectKey);
  const enabled = bucket < config.percentage;
  return {
    key: config.key,
    enabled,
    reason: enabled ? 'percentage' : 'excluded',
    bucket,
    version: config.version,
  };
}

export async function listFeatureFlags(db: D1Database): Promise<FeatureFlagConfig[]> {
  const rows = await db.prepare(`${FLAG_SELECT} ORDER BY f.flag_key`).all<FeatureFlagRow>();
  return (rows.results || []).map(mapRow);
}

export async function getFeatureFlag(db: D1Database, key: string): Promise<FeatureFlagConfig | null> {
  const row = await db.prepare(`${FLAG_SELECT} WHERE f.flag_key = ? LIMIT 1`)
    .bind(safeText(key, 128)).first<FeatureFlagRow>();
  return row ? mapRow(row) : null;
}

const updateStatements = (
  db: D1Database,
  key: string,
  field: FeatureFlagPatch['field'],
  value: unknown,
  actor: string,
  reason: string,
  now: string,
): D1PreparedStatement[] => {
  if (field === 'enabled' || field === 'description' || field === 'owner') {
    const column = field === 'enabled' ? 'enabled' : field;
    const stored = field === 'enabled' ? (value ? 1 : 0) : value;
    return [db.prepare(`UPDATE feature_flags SET ${column} = ?, version = version + 1, updated_at = ? WHERE flag_key = ?`)
      .bind(stored, now, key)];
  }
  const column = ({
    audience: 'audience',
    percentage: 'percentage',
    allowUsers: 'allow_users_json',
    allowClasses: 'allow_classes_json',
    startsAt: 'starts_at',
    endsAt: 'ends_at',
    stopConditions: 'stop_conditions_json',
  } as const)[field as Exclude<FeatureFlagPatch['field'], 'enabled' | 'description' | 'owner'>];
  const stored = ['allowUsers', 'allowClasses', 'stopConditions'].includes(field)
    ? JSON.stringify(value)
    : value;
  return [
    db.prepare(`UPDATE feature_flag_rules SET ${column} = ?, reason = ?, updated_by = ?, updated_at = ? WHERE flag_key = ?`)
      .bind(stored, reason, actor, now, key),
    db.prepare('UPDATE feature_flags SET version = version + 1, updated_at = ? WHERE flag_key = ?')
      .bind(now, key),
  ];
};

export async function patchFeatureFlag(
  db: D1Database,
  keyInput: string,
  patch: FeatureFlagPatch,
  actorInput: string,
  requestIdInput: string,
): Promise<FeatureFlagConfig> {
  const key = safeText(keyInput, 128);
  const actor = safeText(actorInput, 128);
  const requestId = safeText(requestIdInput, 128);
  const reason = safeText(patch.reason, 500);
  if (!key || !actor || !requestId || !reason) throw new Error('FEATURE_FLAG_PATCH_METADATA_REQUIRED');
  const before = await getFeatureFlag(db, key);
  if (!before) throw new Error('FEATURE_FLAG_NOT_FOUND');
  const value = normalizePatchValue(patch);
  const now = new Date().toISOString();
  const projected = { ...before, [patch.field]: value, reason, updatedBy: actor, updatedAt: now, version: before.version + 1 };
  await db.batch([
    ...updateStatements(db, key, patch.field, value, actor, reason, now),
    db.prepare(`
      INSERT INTO feature_flag_audit (
        id, flag_key, action, field_name, before_json, after_json,
        actor_username, request_id, reason, created_at
      ) VALUES (?, ?, 'UPDATED', ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `flag-audit-${crypto.randomUUID()}`, key, patch.field,
      JSON.stringify(before), JSON.stringify(projected), actor, requestId, reason, now,
    ),
  ]);
  const after = await getFeatureFlag(db, key);
  if (!after) throw new Error('FEATURE_FLAG_NOT_FOUND');
  return after;
}

export async function rollbackFeatureFlag(
  db: D1Database,
  keyInput: string,
  actorInput: string,
  requestIdInput: string,
  reasonInput: string,
): Promise<FeatureFlagConfig> {
  const key = safeText(keyInput, 128);
  const actor = safeText(actorInput, 128);
  const requestId = safeText(requestIdInput, 128);
  const reason = safeText(reasonInput, 500);
  if (!key || !actor || !requestId || !reason) throw new Error('FEATURE_FLAG_PATCH_METADATA_REQUIRED');
  const audit = await db.prepare(`
    SELECT action, field_name, before_json
    FROM feature_flag_audit
    WHERE flag_key = ?
    ORDER BY created_at DESC, rowid DESC
    LIMIT 1
  `).bind(key).first<{ action: 'UPDATED' | 'ROLLED_BACK'; field_name: FeatureFlagPatch['field']; before_json: string }>();
  if (!audit || audit.action !== 'UPDATED') throw new Error('FEATURE_FLAG_ROLLBACK_NOT_FOUND');
  const current = await getFeatureFlag(db, key);
  if (!current) throw new Error('FEATURE_FLAG_NOT_FOUND');
  const prior = parseJson<FeatureFlagConfig>(audit.before_json, current);
  const value = prior[audit.field_name as keyof FeatureFlagConfig];
  const now = new Date().toISOString();
  const projected = { ...current, [audit.field_name]: value, reason, updatedBy: actor, updatedAt: now, version: current.version + 1 };
  await db.batch([
    ...updateStatements(db, key, audit.field_name, value, actor, reason, now),
    db.prepare(`
      INSERT INTO feature_flag_audit (
        id, flag_key, action, field_name, before_json, after_json,
        actor_username, request_id, reason, created_at
      ) VALUES (?, ?, 'ROLLED_BACK', ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `flag-audit-${crypto.randomUUID()}`, key, audit.field_name,
      JSON.stringify(current), JSON.stringify(projected), actor, requestId, reason, now,
    ),
  ]);
  const after = await getFeatureFlag(db, key);
  if (!after) throw new Error('FEATURE_FLAG_NOT_FOUND');
  return after;
}

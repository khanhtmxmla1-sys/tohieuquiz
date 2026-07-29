import {
  isNotificationPriority,
  isNotificationSeverity,
  isNotificationType,
  isSafeNotificationActionUrl,
  type NotificationPriority,
  type NotificationSeverity,
  type NotificationType,
} from '../../../shared/notifications.contract';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationDedupeKey,
  normalizeNotificationPreferences,
  resolveNotificationDelivery,
  severityFromPriority,
} from './notificationPolicy';

export type NotificationRecipientRole = 'student' | 'teacher' | 'admin';
export type NotificationWriteResult = 'created' | 'duplicate' | 'suppressed' | 'delayed';

export interface CreateNotificationInput {
  id?: string;
  userId: string;
  userRole: NotificationRecipientRole;
  type: NotificationType;
  title: string;
  body?: string | null;
  priority?: NotificationPriority;
  severity?: NotificationSeverity;
  actionUrl?: string | null;
  data?: Record<string, unknown>;
  sourceType?: string | null;
  sourceId?: string | null;
  dedupeWindowMinutes?: number;
  expiresAt?: string | null;
  createdAt?: string;
}

interface NormalizedNotification {
  id: string;
  userId: string;
  userRole: NotificationRecipientRole;
  type: NotificationType;
  title: string;
  body: string | null;
  dataJson: string;
  priority: NotificationPriority;
  severity: NotificationSeverity;
  sourceType: string | null;
  sourceId: string | null;
  dedupeKey: string | null;
  actionUrl: string | null;
  expiresAt: string;
  createdAt: string;
}

type PreferenceRow = {
  action_required_enabled: number;
  informational_enabled: number;
  quiet_hours_enabled: number;
  quiet_start: string;
  quiet_end: string;
  timezone_offset_minutes: number;
  type_preferences_json: string;
};

const RECIPIENT_ROLES = new Set<NotificationRecipientRole>([
  'student',
  'teacher',
  'admin',
]);

function requiredText(value: unknown, field: string, maxLength: number): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${field} must be between 1 and ${maxLength} characters`);
  }
  return normalized;
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requiredText(value, field, maxLength);
}

function validIsoDate(value: string | null, field: string): string | null {
  if (value === null) return null;
  if (Number.isNaN(Date.parse(value))) throw new Error(`${field} must be a valid date`);
  return value;
}

function defaultExpiry(createdAt: string, severity: NotificationSeverity): string {
  const days = severity === 'critical' ? 14 : severity === 'action_required' ? 30 : 14;
  return new Date(new Date(createdAt).getTime() + days * 86_400_000).toISOString();
}

function normalizeInput(input: CreateNotificationInput): NormalizedNotification {
  if (!RECIPIENT_ROLES.has(input.userRole)) throw new Error('userRole is invalid');
  if (!isNotificationType(input.type)) throw new Error('notification type is invalid');

  const priority = input.priority ?? 'INFO';
  if (!isNotificationPriority(priority)) throw new Error('notification priority is invalid');
  const severity = input.severity ?? severityFromPriority(priority);
  if (!isNotificationSeverity(severity)) throw new Error('notification severity is invalid');

  const actionUrl = input.actionUrl ?? null;
  if (actionUrl !== null && !isSafeNotificationActionUrl(actionUrl)) {
    throw new Error('notification action URL is invalid');
  }

  const sourceType = optionalText(input.sourceType, 'sourceType', 100);
  const sourceId = optionalText(input.sourceId, 'sourceId', 200);
  if (Boolean(sourceType) !== Boolean(sourceId)) {
    throw new Error('sourceType and sourceId must be provided together');
  }

  let dataJson: string;
  try {
    dataJson = JSON.stringify(input.data ?? {});
  } catch {
    throw new Error('notification payload must be JSON serializable');
  }
  if (!dataJson || dataJson.length > 32_000) {
    throw new Error('notification payload is invalid or too large');
  }

  const createdAt = validIsoDate(
    optionalText(input.createdAt, 'createdAt', 50) ?? new Date().toISOString(),
    'createdAt',
  ) as string;
  const explicitExpiry = validIsoDate(optionalText(input.expiresAt, 'expiresAt', 50), 'expiresAt');

  return {
    id: optionalText(input.id, 'id', 200) ?? `ntf-${crypto.randomUUID()}`,
    userId: requiredText(input.userId, 'userId', 200),
    userRole: input.userRole,
    type: input.type,
    title: requiredText(input.title, 'title', 240),
    body: optionalText(input.body, 'body', 4_000),
    dataJson,
    priority,
    severity,
    sourceType,
    sourceId,
    dedupeKey: notificationDedupeKey({
      type: input.type,
      sourceType,
      sourceId,
      createdAt,
      windowMinutes: input.dedupeWindowMinutes,
    }),
    actionUrl,
    expiresAt: explicitExpiry ?? defaultExpiry(createdAt, severity),
    createdAt,
  };
}

function parseTypePreferences(value: string): Record<string, boolean> {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function loadPreferences(db: D1Database, item: NormalizedNotification) {
  const statement = db.prepare(`
    SELECT action_required_enabled, informational_enabled, quiet_hours_enabled,
           quiet_start, quiet_end, timezone_offset_minutes, type_preferences_json
    FROM notification_preferences
    WHERE user_id = ? AND user_role = ?
  `).bind(item.userId, item.userRole) as D1PreparedStatement & {
    first?: <T>() => Promise<T | null>;
  };
  if (typeof statement.first !== 'function') return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    const row = await statement.first<PreferenceRow>();
    if (!row) return DEFAULT_NOTIFICATION_PREFERENCES;
    return normalizeNotificationPreferences({
      criticalEnabled: true,
      actionRequiredEnabled: row.action_required_enabled === 1,
      informationalEnabled: row.informational_enabled === 1,
      quietHoursEnabled: row.quiet_hours_enabled === 1,
      quietStart: row.quiet_start,
      quietEnd: row.quiet_end,
      timezoneOffsetMinutes: row.timezone_offset_minutes,
      typePreferences: parseTypePreferences(row.type_preferences_json),
    });
  } catch (error) {
    if (error instanceof Error && /no such table|notification_preferences/i.test(error.message)) {
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }
    throw error;
  }
}

function prepareInsert(
  db: D1Database,
  item: NormalizedNotification,
  availableAt: string,
): D1PreparedStatement {
  return db.prepare(`
    INSERT OR IGNORE INTO notifications (
      id, user_id, user_role, type, title, body, data, priority, severity,
      source_type, source_id, dedupe_key, action_url, available_at, expires_at,
      sent_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    item.id,
    item.userId,
    item.userRole,
    item.type,
    item.title,
    item.body,
    item.dataJson,
    item.priority,
    item.severity,
    item.sourceType,
    item.sourceId,
    item.dedupeKey,
    item.actionUrl,
    availableAt,
    item.expiresAt,
    item.createdAt,
    item.createdAt,
  );
}

async function prepareDelivery(db: D1Database, input: CreateNotificationInput) {
  const item = normalizeInput(input);
  const preferences = await loadPreferences(db, item);
  const decision = resolveNotificationDelivery({
    severity: item.severity,
    type: item.type,
    createdAt: item.createdAt,
    preferences,
  });
  return { item, decision };
}

export async function createNotification(
  db: D1Database,
  input: CreateNotificationInput,
): Promise<NotificationWriteResult> {
  const { item, decision } = await prepareDelivery(db, input);
  if (!decision.deliver) return 'suppressed';
  const result = await prepareInsert(db, item, decision.availableAt).run();
  if (Number(result.meta?.changes || 0) === 0) return 'duplicate';
  return decision.delayed ? 'delayed' : 'created';
}

export async function createNotifications(
  db: D1Database,
  inputs: CreateNotificationInput[],
): Promise<{ created: number; duplicate: number; suppressed: number; delayed: number }> {
  if (inputs.length === 0) return { created: 0, duplicate: 0, suppressed: 0, delayed: 0 };
  const prepared = await Promise.all(inputs.map((input) => prepareDelivery(db, input)));
  const deliverable = prepared.filter(({ decision }) => decision.deliver);
  const statements = deliverable.map(({ item, decision }) => (
    prepareInsert(db, item, decision.availableAt)
  ));
  const results = statements.length > 0 ? await db.batch(statements) : [];
  let created = 0;
  let duplicate = 0;
  let delayed = 0;
  results.forEach((result, index) => {
    if (Number(result.meta?.changes || 0) > 0) {
      created += 1;
      if (deliverable[index].decision.delayed) delayed += 1;
    } else {
      duplicate += 1;
    }
  });
  return {
    created,
    duplicate,
    suppressed: prepared.length - deliverable.length,
    delayed,
  };
}

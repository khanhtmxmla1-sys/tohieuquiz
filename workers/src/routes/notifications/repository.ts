import {
  isNotificationPriority,
  isNotificationSeverity,
  isNotificationType,
  isSafeNotificationActionUrl,
  type InboxNotification,
  type NotificationMetricBucket,
  type NotificationPreferences,
} from '../../../../shared/notifications.contract';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
} from '../../services/notificationPolicy';

export interface NotificationIdentity {
  userId: string;
  role: 'student' | 'teacher' | 'admin';
}

export interface NotificationCursor {
  createdAt: string;
  id: string;
}

export interface NotificationListInput {
  filter: 'all' | 'unread';
  cursor?: string;
  limit: number;
}

type NotificationRow = {
  id: string;
  type: string;
  priority: string | null;
  severity: string | null;
  title: string;
  body: string | null;
  action_url: string | null;
  data: string;
  is_read: number;
  created_at: string;
  available_at: string | null;
  expires_at: string | null;
};

type PreferenceRow = {
  action_required_enabled: number;
  informational_enabled: number;
  quiet_hours_enabled: number;
  quiet_start: string;
  quiet_end: string;
  timezone_offset_minutes: number;
  type_preferences_json: string;
};

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeNotificationCursor(cursor: NotificationCursor): string {
  return encodeBase64Url(JSON.stringify(cursor));
}

export function decodeNotificationCursor(value: string): NotificationCursor {
  try {
    const parsed = JSON.parse(decodeBase64Url(value)) as Partial<NotificationCursor>;
    if (typeof parsed.createdAt !== 'string'
      || Number.isNaN(Date.parse(parsed.createdAt))
      || typeof parsed.id !== 'string'
      || !parsed.id) {
      throw new Error('invalid cursor payload');
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new Error('cursor th?ng b?o kh?ng h?p l?');
  }
}

function parseObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function mapNotification(row: NotificationRow): InboxNotification {
  return {
    id: row.id,
    type: isNotificationType(row.type) ? row.type : 'system',
    priority: isNotificationPriority(row.priority) ? row.priority : 'INFO',
    severity: isNotificationSeverity(row.severity) ? row.severity : 'informational',
    title: row.title,
    body: row.body,
    actionUrl: isSafeNotificationActionUrl(row.action_url) ? row.action_url : null,
    data: parseObject(row.data),
    isRead: row.is_read === 1,
    createdAt: row.created_at,
    availableAt: row.available_at || row.created_at,
    expiresAt: row.expires_at,
  };
}

function visibleClauses(identity: NotificationIdentity, now: string) {
  return {
    clauses: [
      'user_id = ?',
      'user_role = ?',
      '(available_at IS NULL OR available_at <= ?)',
      '(expires_at IS NULL OR expires_at > ?)',
    ],
    bindings: [identity.userId, identity.role, now, now] as unknown[],
  };
}

export async function listNotifications(
  db: D1Database,
  identity: NotificationIdentity,
  input: NotificationListInput,
): Promise<{ items: InboxNotification[]; nextCursor: string | null; unreadCount: number }> {
  const cursor = input.cursor ? decodeNotificationCursor(input.cursor) : null;
  const now = new Date().toISOString();
  const { clauses, bindings } = visibleClauses(identity, now);
  if (input.filter === 'unread') clauses.push('is_read = 0');
  if (cursor) {
    clauses.push('(created_at < ? OR (created_at = ? AND id < ?))');
    bindings.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }

  bindings.push(input.limit + 1);
  const { results } = await db.prepare(`
    SELECT id, type, priority, severity, title, body, action_url, data, is_read,
           created_at, available_at, expires_at
    FROM notifications
    WHERE ${clauses.join('\n      AND ')}
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).bind(...bindings).all<NotificationRow>();

  const unread = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM notifications
    WHERE user_id = ? AND user_role = ? AND is_read = 0
      AND (available_at IS NULL OR available_at <= ?)
      AND (expires_at IS NULL OR expires_at > ?)
  `).bind(identity.userId, identity.role, now, now).first<{ count: number }>();

  const pageRows = (results || []).slice(0, input.limit);
  const last = pageRows.at(-1);
  return {
    items: pageRows.map(mapNotification),
    nextCursor: (results || []).length > input.limit && last
      ? encodeNotificationCursor({ createdAt: last.created_at, id: last.id })
      : null,
    unreadCount: Number(unread?.count || 0),
  };
}

export async function markNotificationRead(
  db: D1Database,
  identity: NotificationIdentity,
  id: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await db.prepare(`
    UPDATE notifications
    SET is_read = 1, read_at = COALESCE(read_at, ?)
    WHERE id = ? AND user_id = ? AND user_role = ?
  `).bind(now, id, identity.userId, identity.role).run();
  return Number(result.meta?.changes || 0) > 0;
}

export async function markNotificationClicked(
  db: D1Database,
  identity: NotificationIdentity,
  id: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await db.prepare(`
    UPDATE notifications
    SET clicked_at = COALESCE(clicked_at, ?)
    WHERE id = ? AND user_id = ? AND user_role = ?
  `).bind(now, id, identity.userId, identity.role).run();
  return Number(result.meta?.changes || 0) > 0;
}

export async function markAllNotificationsRead(
  db: D1Database,
  identity: NotificationIdentity,
): Promise<number> {
  const now = new Date().toISOString();
  const result = await db.prepare(`
    UPDATE notifications
    SET is_read = 1, read_at = COALESCE(read_at, ?)
    WHERE user_id = ? AND user_role = ? AND is_read = 0
      AND (available_at IS NULL OR available_at <= ?)
      AND (expires_at IS NULL OR expires_at > ?)
  `).bind(now, identity.userId, identity.role, now, now).run();
  return Number(result.meta?.changes || 0);
}

export async function getNotificationPreferences(
  db: D1Database,
  identity: NotificationIdentity,
): Promise<NotificationPreferences> {
  const row = await db.prepare(`
    SELECT action_required_enabled, informational_enabled, quiet_hours_enabled,
           quiet_start, quiet_end, timezone_offset_minutes, type_preferences_json
    FROM notification_preferences
    WHERE user_id = ? AND user_role = ?
  `).bind(identity.userId, identity.role).first<PreferenceRow>();
  if (!row) return DEFAULT_NOTIFICATION_PREFERENCES;
  return normalizeNotificationPreferences({
    criticalEnabled: true,
    actionRequiredEnabled: row.action_required_enabled === 1,
    informationalEnabled: row.informational_enabled === 1,
    quietHoursEnabled: row.quiet_hours_enabled === 1,
    quietStart: row.quiet_start,
    quietEnd: row.quiet_end,
    timezoneOffsetMinutes: row.timezone_offset_minutes,
    typePreferences: parseObject(row.type_preferences_json),
  });
}

export async function saveNotificationPreferences(
  db: D1Database,
  identity: NotificationIdentity,
  input: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const preferences = normalizeNotificationPreferences(input);
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO notification_preferences (
      user_id, user_role, action_required_enabled, informational_enabled,
      quiet_hours_enabled, quiet_start, quiet_end, timezone_offset_minutes,
      type_preferences_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, user_role) DO UPDATE SET
      action_required_enabled = excluded.action_required_enabled,
      informational_enabled = excluded.informational_enabled,
      quiet_hours_enabled = excluded.quiet_hours_enabled,
      quiet_start = excluded.quiet_start,
      quiet_end = excluded.quiet_end,
      timezone_offset_minutes = excluded.timezone_offset_minutes,
      type_preferences_json = excluded.type_preferences_json,
      updated_at = excluded.updated_at
  `).bind(
    identity.userId,
    identity.role,
    preferences.actionRequiredEnabled ? 1 : 0,
    preferences.informationalEnabled ? 1 : 0,
    preferences.quietHoursEnabled ? 1 : 0,
    preferences.quietStart,
    preferences.quietEnd,
    preferences.timezoneOffsetMinutes,
    JSON.stringify(preferences.typePreferences),
    now,
  ).run();
  return preferences;
}

export async function aggregateNotificationMetrics(
  db: D1Database,
  from: string,
  to: string,
): Promise<NotificationMetricBucket[]> {
  const { results } = await db.prepare(`
    SELECT severity,
           COUNT(*) AS sent,
           SUM(CASE WHEN read_at IS NOT NULL THEN 1 ELSE 0 END) AS read_count,
           SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) AS click_count
    FROM notifications
    WHERE sent_at >= ? AND sent_at < ?
    GROUP BY severity
    ORDER BY severity
  `).bind(from, to).all<{
    severity: string;
    sent: number;
    read_count: number;
    click_count: number;
  }>();
  return (results || [])
    .filter((row) => isNotificationSeverity(row.severity))
    .map((row) => ({
      severity: row.severity as NotificationMetricBucket['severity'],
      sent: Number(row.sent || 0),
      read: Number(row.read_count || 0),
      clicked: Number(row.click_count || 0),
    }));
}

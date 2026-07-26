import {
  isNotificationPriority,
  isNotificationType,
  isSafeNotificationActionUrl,
  type InboxNotification,
} from '../../../../shared/notifications.contract';

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
  title: string;
  body: string | null;
  action_url: string | null;
  data: string;
  is_read: number;
  created_at: string;
  expires_at: string | null;
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
    throw new Error('cursor thông báo không hợp lệ');
  }
}

function parseData(value: string): Record<string, unknown> {
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
    title: row.title,
    body: row.body,
    actionUrl: isSafeNotificationActionUrl(row.action_url) ? row.action_url : null,
    data: parseData(row.data),
    isRead: row.is_read === 1,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export async function listNotifications(
  db: D1Database,
  identity: NotificationIdentity,
  input: NotificationListInput,
): Promise<{ items: InboxNotification[]; nextCursor: string | null }> {
  const cursor = input.cursor ? decodeNotificationCursor(input.cursor) : null;
  const clauses = [
    'user_id = ?',
    'user_role = ?',
    '(expires_at IS NULL OR expires_at > ?)',
  ];
  const now = new Date().toISOString();
  const bindings: unknown[] = [identity.userId, identity.role, now];

  if (input.filter === 'unread') clauses.push('is_read = 0');
  if (cursor) {
    clauses.push('(created_at < ? OR (created_at = ? AND id < ?))');
    bindings.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }

  const queryLimit = input.limit + 1;
  bindings.push(queryLimit);
  const { results } = await db.prepare(`
    SELECT id, type, priority, title, body, action_url, data, is_read, created_at, expires_at
    FROM notifications
    WHERE ${clauses.join('\n      AND ')}
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).bind(...bindings).all<NotificationRow>();

  const pageRows = (results || []).slice(0, input.limit);
  const last = pageRows.at(-1);
  return {
    items: pageRows.map(mapNotification),
    nextCursor: (results || []).length > input.limit && last
      ? encodeNotificationCursor({ createdAt: last.created_at, id: last.id })
      : null,
  };
}

export async function markNotificationRead(
  db: D1Database,
  identity: NotificationIdentity,
  id: string,
): Promise<boolean> {
  const owned = await db.prepare(`
    SELECT id FROM notifications
    WHERE id = ? AND user_id = ? AND user_role = ?
  `).bind(id, identity.userId, identity.role).first<{ id: string }>();
  if (!owned) return false;

  await db.prepare(`
    UPDATE notifications
    SET is_read = 1
    WHERE id = ? AND user_id = ? AND user_role = ?
  `).bind(id, identity.userId, identity.role).run();
  return true;
}

export async function markAllNotificationsRead(
  db: D1Database,
  identity: NotificationIdentity,
): Promise<number> {
  const result = await db.prepare(`
    UPDATE notifications
    SET is_read = 1
    WHERE user_id = ? AND user_role = ? AND is_read = 0
  `).bind(identity.userId, identity.role).run();
  return Number(result.meta?.changes || 0);
}

import {
  PARENT_NOTIFICATION_KINDS,
  type ParentNotificationItem,
  type ParentNotificationKind,
} from '../../../../shared/parent-portal.contract';
import type { ParentSessionPayload } from '../../parentPortal/types';
import type { Env } from '../../types';
import {
  authenticateParentRoute,
  parentRouteError,
  parentRouteSuccess,
} from './sessionAuth';

export interface ParentNotificationListOptions {
  kind: ParentNotificationKind | null;
  unreadOnly: boolean;
  limit: number;
  cursor: string | null;
}

export interface ParentNotificationListResult {
  items: ParentNotificationItem[];
  nextCursor: string | null;
  unreadCount: number;
}

export interface ParentNotificationRouteRuntime {
  authenticate(request: Request, env: Env): Promise<ParentSessionPayload | Response>;
  list(
    studentId: string,
    options: ParentNotificationListOptions,
    now: Date,
  ): Promise<ParentNotificationListResult>;
  markRead(studentId: string, id: string, readAt: string): Promise<boolean>;
  markAllRead(studentId: string, readAt: string, now: Date): Promise<number>;
  now(): Date;
}

interface CursorPayload { publishedAt: string; id: string }

const encodeCursor = (payload: CursorPayload): string => {
  const json = JSON.stringify(payload);
  let binary = '';
  for (const byte of new TextEncoder().encode(json)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const decodeCursor = (value: string | null): CursorPayload | null => {
  if (!value) return null;
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const parsed = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0))));
    if (!parsed || typeof parsed.publishedAt !== 'string' || typeof parsed.id !== 'string') return null;
    return { publishedAt: parsed.publishedAt, id: parsed.id };
  } catch {
    return null;
  }
};

const parsePayload = (value: unknown): Record<string, unknown> => {
  try { return JSON.parse(String(value || '{}')); } catch { return {}; }
};

const mapNotification = (row: Record<string, unknown>): ParentNotificationItem => ({
  id: String(row.id),
  kind: row.kind as ParentNotificationKind,
  title: String(row.title),
  body: String(row.body || ''),
  payload: parsePayload(row.payload_json),
  isImportant: Number(row.is_important) === 1,
  isRead: Boolean(row.read_at),
  publishedAt: String(row.published_at),
  expiresAt: row.expires_at ? String(row.expires_at) : null,
});

const makeRuntime = (env: Env): ParentNotificationRouteRuntime => ({
  authenticate: authenticateParentRoute,

  async list(studentId, options, now) {
    const where = [
      'student_id = ?',
      'revoked_at IS NULL',
      '(expires_at IS NULL OR expires_at > ?)',
    ];
    const bindings: unknown[] = [studentId, now.toISOString()];
    if (options.kind) {
      where.push('kind = ?');
      bindings.push(options.kind);
    }
    if (options.unreadOnly) where.push('read_at IS NULL');
    const cursor = decodeCursor(options.cursor);
    if (options.cursor && !cursor) throw new Error('Invalid notification cursor');
    if (cursor) {
      where.push('(published_at < ? OR (published_at = ? AND id < ?))');
      bindings.push(cursor.publishedAt, cursor.publishedAt, cursor.id);
    }
    const rows = await env.DB.prepare(`
      SELECT id, kind, title, body, payload_json, is_important,
             published_at, expires_at, read_at
      FROM parent_notifications
      WHERE ${where.join(' AND ')}
      ORDER BY published_at DESC, id DESC
      LIMIT ?
    `).bind(...bindings, options.limit + 1).all<Record<string, unknown>>();
    const hasMore = rows.results.length > options.limit;
    const visible = rows.results.slice(0, options.limit);
    const last = visible[visible.length - 1];
    const unread = await env.DB.prepare(`
      SELECT COUNT(*) AS count FROM parent_notifications
      WHERE student_id = ? AND read_at IS NULL AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > ?)
    `).bind(studentId, now.toISOString()).first<{ count: number }>();
    return {
      items: visible.map(mapNotification),
      nextCursor: hasMore && last ? encodeCursor({
        publishedAt: String(last.published_at),
        id: String(last.id),
      }) : null,
      unreadCount: Number(unread?.count || 0),
    };
  },

  async markRead(studentId, id, readAt) {
    const result = await env.DB.prepare(`
      UPDATE parent_notifications SET read_at = COALESCE(read_at, ?)
      WHERE id = ? AND student_id = ? AND revoked_at IS NULL
    `).bind(readAt, id, studentId).run();
    return Number(result.meta.changes || 0) === 1;
  },

  async markAllRead(studentId, readAt, now) {
    const result = await env.DB.prepare(`
      UPDATE parent_notifications SET read_at = ?
      WHERE student_id = ? AND read_at IS NULL AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > ?)
    `).bind(readAt, studentId, now.toISOString()).run();
    return Number(result.meta.changes || 0);
  },

  now: () => new Date(),
});

export async function handleParentNotificationRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
  injectedRuntime?: ParentNotificationRouteRuntime,
): Promise<Response | null> {
  const isCollection = path === '/api/parent/notifications';
  const readAll = path === '/api/parent/notifications/read-all';
  const readMatch = path.match(/^\/api\/parent\/notifications\/([^/]+)\/read$/);
  if (!isCollection && !readAll && !readMatch) return null;

  const runtime = injectedRuntime || makeRuntime(env);
  const session = await runtime.authenticate(request, env);
  if (session instanceof Response) return session;

  if (isCollection && method === 'GET') {
    const url = new URL(request.url);
    const rawKind = url.searchParams.get('kind')?.trim() || '';
    if (rawKind && !PARENT_NOTIFICATION_KINDS.includes(rawKind as ParentNotificationKind)) {
      return parentRouteError('PARENT_NOTIFICATION_KIND_INVALID', 'Loại thông báo không hợp lệ.', 400);
    }
    const rawLimit = Number(url.searchParams.get('limit') || 20);
    const limit = Number.isInteger(rawLimit) ? Math.min(50, Math.max(1, rawLimit)) : 20;
    try {
      return parentRouteSuccess(await runtime.list(session.studentId, {
        kind: rawKind ? rawKind as ParentNotificationKind : null,
        unreadOnly: url.searchParams.get('unread') === 'true',
        limit,
        cursor: url.searchParams.get('cursor'),
      }, runtime.now()));
    } catch (error) {
      if (error instanceof Error && /cursor/i.test(error.message)) {
        return parentRouteError('PARENT_NOTIFICATION_CURSOR_INVALID', error.message, 400);
      }
      throw error;
    }
  }

  if (readMatch && method === 'PATCH') {
    const readAt = runtime.now().toISOString();
    const updated = await runtime.markRead(session.studentId, readMatch[1], readAt);
    if (!updated) return parentRouteError('PARENT_NOTIFICATION_NOT_FOUND', 'Không tìm thấy thông báo.', 404);
    return parentRouteSuccess({ id: readMatch[1], isRead: true, readAt });
  }

  if (readAll && method === 'POST') {
    const now = runtime.now();
    const updatedCount = await runtime.markAllRead(session.studentId, now.toISOString(), now);
    return parentRouteSuccess({ updatedCount });
  }

  return parentRouteError('PARENT_METHOD_NOT_ALLOWED', 'Phương thức không được hỗ trợ.', 405);
}

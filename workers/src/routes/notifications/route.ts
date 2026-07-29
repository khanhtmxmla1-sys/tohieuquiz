import type { NotificationPreferences } from '../../../../shared/notifications.contract';
import type { Env } from '../../types';
import { verifyJWTMiddleware } from '../../middleware/jwtAuth';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';
import {
  aggregateNotificationMetrics,
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationClicked,
  markNotificationRead,
  saveNotificationPreferences,
  type NotificationIdentity,
} from './repository';

function notificationIdentity(user: {
  id?: string;
  username: string;
  role: 'student' | 'teacher' | 'admin';
}): NotificationIdentity {
  return {
    userId: user.id || user.username,
    role: user.role,
  };
}

function validDateRange(url: URL): { from: string; to: string } | Response {
  const toValue = url.searchParams.get('to');
  const fromValue = url.searchParams.get('from');
  const to = toValue ? new Date(toValue) : new Date();
  const from = fromValue ? new Date(fromValue) : new Date(to.getTime() - 30 * 86_400_000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    return errorResponse('Kho?ng th?i gian th?ng k? kh?ng h?p l?.', 400);
  }
  if (to.getTime() - from.getTime() > 366 * 86_400_000) {
    return errorResponse('Kho?ng th?i gian th?ng k? t?i ?a l? 366 ng?y.', 400);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export async function handleNotificationRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  const identity = notificationIdentity(authResult.user);

  if (path === '/api/admin/notification-metrics' && method === 'GET') {
    if (identity.role !== 'admin') return errorResponse('Forbidden: Admin access required', 403);
    const range = validDateRange(new URL(request.url));
    if (range instanceof Response) return range;
    const buckets = await aggregateNotificationMetrics(env.DB, range.from, range.to);
    return jsonResponse({ status: 'success', data: { ...range, buckets } });
  }

  if (path === '/api/notifications/preferences' && method === 'GET') {
    const preferences = await getNotificationPreferences(env.DB, identity);
    return jsonResponse({ status: 'success', data: preferences });
  }

  if (path === '/api/notifications/preferences' && method === 'PUT') {
    const body = await parseBody(request);
    if (!body) return errorResponse('Invalid JSON body');
    const preferences = await saveNotificationPreferences(
      env.DB,
      identity,
      body as Partial<NotificationPreferences>,
    );
    return jsonResponse({ status: 'success', data: preferences });
  }

  if (path === '/api/notifications' && method === 'GET') {
    const url = new URL(request.url);
    const filter = url.searchParams.get('filter') === 'unread' ? 'unread' : 'all';
    const rawLimit = Number(url.searchParams.get('limit') || 25);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) {
      return errorResponse('Gi?i h?n danh s?ch th?ng b?o ph?i t? 1 ??n 100.', 400);
    }
    try {
      const page = await listNotifications(env.DB, identity, {
        filter,
        cursor: url.searchParams.get('cursor') || undefined,
        limit: rawLimit,
      });
      return jsonResponse({ status: 'success', data: page });
    } catch (error) {
      if (error instanceof Error && error.message.includes('cursor')) {
        return errorResponse(error.message, 400);
      }
      throw error;
    }
  }

  if (path === '/api/notifications/read-all' && method === 'PATCH') {
    const updated = await markAllNotificationsRead(env.DB, identity);
    return jsonResponse({ status: 'success', data: { updated } });
  }

  const readMatch = path.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (readMatch && method === 'PATCH') {
    const id = decodeURIComponent(readMatch[1]);
    const updated = await markNotificationRead(env.DB, identity, id);
    if (!updated) return errorResponse('Kh?ng t?m th?y th?ng b?o.', 404);
    return jsonResponse({ status: 'success', data: { id, isRead: true } });
  }

  const clickMatch = path.match(/^\/api\/notifications\/([^/]+)\/click$/);
  if (clickMatch && method === 'POST') {
    const id = decodeURIComponent(clickMatch[1]);
    const updated = await markNotificationClicked(env.DB, identity, id);
    if (!updated) return errorResponse('Kh?ng t?m th?y th?ng b?o.', 404);
    return jsonResponse({ status: 'success', data: { id, clicked: true } });
  }

  return errorResponse(`Not found: ${path}`, 404);
}

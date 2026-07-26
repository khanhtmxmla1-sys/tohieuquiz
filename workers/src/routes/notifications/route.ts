import type { Env } from '../../types';
import { verifyJWTMiddleware } from '../../middleware/jwtAuth';
import { errorResponse, jsonResponse } from '../../utils/response';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
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

export async function handleNotificationRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  const identity = notificationIdentity(authResult.user);

  if (path === '/api/notifications' && method === 'GET') {
    const url = new URL(request.url);
    const filter = url.searchParams.get('filter') === 'unread' ? 'unread' : 'all';
    const rawLimit = Number(url.searchParams.get('limit') || 20);
    if (!Number.isInteger(rawLimit) || rawLimit < 1) {
      return errorResponse('Giới hạn danh sách thông báo không hợp lệ.', 400);
    }
    const limit = Math.min(rawLimit, 50);
    try {
      const page = await listNotifications(env.DB, identity, {
        filter,
        cursor: url.searchParams.get('cursor') || undefined,
        limit,
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
    if (!updated) return errorResponse('Không tìm thấy thông báo.', 404);
    return jsonResponse({ status: 'success', data: { id, isRead: true } });
  }

  return errorResponse(`Not found: ${path}`, 404);
}

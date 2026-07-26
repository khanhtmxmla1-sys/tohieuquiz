import { verifyJWTMiddleware } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import { certificateError, certificateSuccess } from './responses';
import {
  listNotifications,
  markNotificationRead,
} from '../notifications/repository';

export async function handleGetNotifications(request: Request, env: Env): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;

  const userId = authResult.user.id ?? authResult.user.username;
  const page = await listNotifications(env.DB, {
    userId,
    role: authResult.user.role,
  }, {
    filter: 'all',
    limit: 50,
  });

  return certificateSuccess(page.items.map((notification) => ({
    id: notification.id,
    type: notification.type,
    priority: notification.priority,
    title: notification.title,
    body: notification.body,
    action_url: notification.actionUrl,
    data: notification.data,
    is_read: notification.isRead,
    created_at: notification.createdAt,
    expires_at: notification.expiresAt,
  })));
}

// PATCH /api/certificates/notifications/:id/read
export async function handleMarkNotificationRead(
  request: Request,
  env: Env,
  notificationId: string,
): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;

  const userId = authResult.user.id ?? authResult.user.username;
  const updated = await markNotificationRead(env.DB, {
    userId,
    role: authResult.user.role,
  }, notificationId);
  if (!updated) {
    return certificateError('NOTIFICATION_NOT_FOUND', 'Notification not found', 404);
  }
  return certificateSuccess({ id: notificationId, is_read: true });
}

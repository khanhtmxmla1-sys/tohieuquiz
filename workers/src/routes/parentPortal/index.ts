import type { Env } from '../../types';
import { errorResponse } from '../../utils/response';
import { handleParentAuthRoutes } from './authRoutes';
import { handleParentDashboardRoutes } from './dashboardRoutes';
import { handleParentHistoryRoutes } from './historyRoutes';
import { handleParentNotificationRoutes } from './notificationRoutes';
import { handleTeacherAnnouncementRoutes } from './teacherAnnouncementRoutes';
import { handleTeacherLinkRoutes } from './teacherLinkRoutes';

export async function handleParentPortalRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response> {
  const authResponse = await handleParentAuthRoutes(request, env, path, method);
  if (authResponse) return authResponse;

  const dashboardResponse = await handleParentDashboardRoutes(request, env, path, method);
  if (dashboardResponse) return dashboardResponse;

  const notificationResponse = await handleParentNotificationRoutes(request, env, path, method);
  if (notificationResponse) return notificationResponse;

  const historyResponse = await handleParentHistoryRoutes(request, env, path, method);
  if (historyResponse) return historyResponse;

  const teacherLinkResponse = await handleTeacherLinkRoutes(request, env, path, method);
  if (teacherLinkResponse) return teacherLinkResponse;

  const announcementResponse = await handleTeacherAnnouncementRoutes(request, env, path, method);
  if (announcementResponse) return announcementResponse;

  return errorResponse('Parent Portal route not found', 404);
}

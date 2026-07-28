import type { TeacherActionCenterResponse } from '../../../shared/teacher-action-center.contract';
import { requireAdmin, requireTeacher, verifyJWTMiddleware } from '../middleware/jwtAuth';
import { loadTeacherActionCenter } from '../services/actionCenterService';
import type { Env } from '../types';
import { errorResponse, jsonResponse } from '../utils/response';

const ACTION_CENTER_PATH = '/api/teacher/action-center';

export async function handleActionCenterRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response | null> {
  if (path !== ACTION_CENTER_PATH) return null;
  if (method !== 'GET') return errorResponse(`Method not allowed: ${method}`, 405);

  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  if (!requireTeacher(authResult.user)) {
    return errorResponse('Forbidden: Teacher or admin access required', 403);
  }

  const data = await loadTeacherActionCenter(env.DB, {
    role: requireAdmin(authResult.user) ? 'admin' : 'teacher',
    username: authResult.user.username,
  });
  const response: TeacherActionCenterResponse = { status: 'success', data };
  return jsonResponse(response);
}

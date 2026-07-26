import { errorResponse } from '../../utils/response';
import { parseBody } from '../../utils/helpers';
import type { Env } from '../../types';
import { canAccessTeacherScope } from './auth';
import { handlePublishPhieuBatch } from './phieuMutationService';
import { getPhieuScope } from './scopeRepository';
import type { PhieuScopeUser } from './types';

export async function handlePublishBatchRoute(
  request: Request,
  env: Env,
  user: PhieuScopeUser,
): Promise<Response> {
  const body = await parseBody(request);
  if (!body) return errorResponse('Invalid JSON body');
  const data = body.data || body;
  const phieuIds = Array.isArray(data.phieuIds)
    ? data.phieuIds.map(String).filter(Boolean)
    : [];
  if (phieuIds.length === 0) return errorResponse('Missing phieuIds');

  const scopes = [];
  for (const phieuId of phieuIds) {
    const scope = await getPhieuScope(env.DB, phieuId);
    if (!scope) return errorResponse('Phieu not found', 404);
    if (!canAccessTeacherScope(user, scope.teacher_username)) {
      return errorResponse('Forbidden', 403);
    }
    scopes.push(scope);
  }
  const classIds = new Set(scopes.map((scope) => String(scope.class_id || '')));
  if (classIds.size !== 1) {
    return errorResponse('All phieu records must belong to one class', 400);
  }
  return handlePublishPhieuBatch(env.DB, {
    ...data,
    phieuIds,
    classId: String(scopes[0].class_id || ''),
    teacherId: user.username,
  });
}

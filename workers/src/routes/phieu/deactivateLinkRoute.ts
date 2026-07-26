import { errorResponse } from '../../utils/response';
import type { Env } from '../../types';
import { canAccessTeacherScope } from './auth';
import { handleDeactivatePublicPhieuLink } from './phieuMutationService';
import { getPublicLinkScope } from './scopeRepository';
import type { PhieuScopeUser } from './types';

export async function handleDeactivateLinkRoute(
  env: Env,
  publicToken: string,
  user: PhieuScopeUser,
): Promise<Response> {
  const decodedToken = decodeURIComponent(publicToken);
  const scope = await getPublicLinkScope(env.DB, decodedToken);
  if (!scope) return errorResponse('Public link not found', 404);
  if (!canAccessTeacherScope(user, scope.teacher_username)) {
    return errorResponse('Forbidden', 403);
  }
  return handleDeactivatePublicPhieuLink(env.DB, { publicToken: decodedToken });
}

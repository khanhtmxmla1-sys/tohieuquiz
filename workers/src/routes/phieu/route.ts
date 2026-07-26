import { errorResponse } from '../../utils/response';
import { verifyJWTMiddleware, requireTeacher } from '../../middleware/jwtAuth';
import type { Env } from '../../types';
import { handleDeactivateLinkRoute } from './deactivateLinkRoute';
import { handlePublishBatchRoute } from './publishBatchRoute';
import { handleResultPhieuRoute } from './resultPhieuRoute';
import { handleSubmissionGetRoute } from './submissionGetRoute';
import { handleSubmissionUpsertRoute } from './submissionUpsertRoute';
import type { PhieuScopeUser } from './types';

export async function handlePhieuRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response> {
  const authResult = await verifyJWTMiddleware(request, env);
  if (authResult instanceof Response) return authResult;
  if (!requireTeacher(authResult.user)) {
    return errorResponse('Forbidden: Teacher access required', 403);
  }
  const user = authResult.user as PhieuScopeUser;

  if (path === '/api/phieu' && method === 'POST') {
    return handleSubmissionUpsertRoute(request, env, user);
  }
  const resultMatch = path.match(/^\/api\/phieu\/results\/([^/]+)$/);
  if (resultMatch) {
    return handleResultPhieuRoute(request, env, resultMatch[1], method, user);
  }
  const submissionMatch = path.match(/^\/api\/phieu\/submissions\/([^/]+)$/);
  if (submissionMatch && method === 'GET') {
    return handleSubmissionGetRoute(env, submissionMatch[1], user);
  }
  if (path === '/api/phieu/batches' && method === 'POST') {
    return handlePublishBatchRoute(request, env, user);
  }
  const deactivateMatch = path.match(
    /^\/api\/phieu\/public-links\/([^/]+)\/deactivate$/,
  );
  if (deactivateMatch && method === 'POST') {
    return handleDeactivateLinkRoute(env, deactivateMatch[1], user);
  }
  return errorResponse('Phieu route not found', 404);
}

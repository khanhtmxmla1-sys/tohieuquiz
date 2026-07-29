import type { FeatureFlagPatch, FeatureFlagSubject } from '../../../shared/feature-rollout.contract';
import type { Env } from '../types';
import { requireAdmin, verifyJWTMiddleware } from '../middleware/jwtAuth';
import {
  getFeatureFlag,
  listFeatureFlags,
  patchFeatureFlag,
  resolveFeatureFlag,
  rollbackFeatureFlag,
} from '../services/featureFlagService';
import { parseBody } from '../utils/helpers';
import { errorResponse, jsonResponse } from '../utils/response';
import { authenticateParentRoute } from './parentPortal/sessionAuth';

const PREFIX = '/api/system-settings/feature-flags';
const safeKey = (value: string): string => decodeURIComponent(value).trim().slice(0, 128);
const requestId = (request: Request): string => (
  request.headers.get('x-request-id') || request.headers.get('cf-ray') || crypto.randomUUID()
);

const noStore = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
};

const mapError = (error: unknown): Response => {
  const code = error instanceof Error ? error.message : 'FEATURE_FLAG_ERROR';
  if (code === 'FEATURE_FLAG_NOT_FOUND' || code === 'FEATURE_FLAG_ROLLBACK_NOT_FOUND') {
    return errorResponse('Feature flag not found', 404);
  }
  if (code.startsWith('FEATURE_FLAG_INVALID_') || code === 'FEATURE_FLAG_PATCH_METADATA_REQUIRED') {
    return errorResponse(code, 400);
  }
  throw error;
};

const subjectFromUser = (user: {
  role: 'student' | 'teacher' | 'admin';
  username: string;
  classId?: string;
}): FeatureFlagSubject => ({
  role: user.role,
  username: user.username,
  classIds: user.classId ? [user.classId] : [],
});

export async function handleFeatureFlagRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response | null> {
  if (!path.startsWith(PREFIX)) return null;

  if (path === `${PREFIX}/resolve` && method === 'GET') {
    const key = safeKey(new URL(request.url).searchParams.get('flag') || '');
    if (!key) return errorResponse('flag is required', 400);

    const standardAuth = await verifyJWTMiddleware(request, env);
    let subject: FeatureFlagSubject;
    if (standardAuth instanceof Response) {
      const parentAuth = await authenticateParentRoute(request, env);
      if (parentAuth instanceof Response) return standardAuth;
      subject = {
        role: 'parent',
        username: `parent:${parentAuth.linkId}`,
        classIds: [],
      };
    } else {
      subject = subjectFromUser(standardAuth.user);
    }

    const config = await getFeatureFlag(env.DB, key);
    if (!config) return errorResponse('Feature flag not found', 404);
    return noStore(jsonResponse({
      status: 'success',
      data: await resolveFeatureFlag(config, subject),
    }));
  }

  const auth = await verifyJWTMiddleware(request, env);
  if (auth instanceof Response) return auth;
  if (!requireAdmin(auth.user)) return errorResponse('Forbidden', 403);

  if (path === PREFIX && method === 'GET') {
    return noStore(jsonResponse({ status: 'success', data: await listFeatureFlags(env.DB) }));
  }

  const rollbackMatch = path.match(/^\/api\/system-settings\/feature-flags\/([^/]+)\/rollback$/);
  if (rollbackMatch && method === 'POST') {
    const body = await parseBody(request);
    if (!body || typeof body.reason !== 'string') return errorResponse('reason is required', 400);
    try {
      const data = await rollbackFeatureFlag(
        env.DB,
        safeKey(rollbackMatch[1]),
        auth.user.username,
        requestId(request),
        body.reason,
      );
      return noStore(jsonResponse({ status: 'success', data }));
    } catch (error) {
      return mapError(error);
    }
  }

  const patchMatch = path.match(/^\/api\/system-settings\/feature-flags\/([^/]+)$/);
  if (patchMatch && method === 'PATCH') {
    const body = await parseBody(request);
    if (!body || typeof body.field !== 'string' || typeof body.reason !== 'string') {
      return errorResponse('field and reason are required', 400);
    }
    const patch: FeatureFlagPatch = {
      field: body.field as FeatureFlagPatch['field'],
      value: body.value,
      reason: body.reason,
    };
    try {
      const data = await patchFeatureFlag(
        env.DB,
        safeKey(patchMatch[1]),
        patch,
        auth.user.username,
        requestId(request),
      );
      return noStore(jsonResponse({ status: 'success', data }));
    } catch (error) {
      return mapError(error);
    }
  }

  return errorResponse('Method not allowed', 405);
}

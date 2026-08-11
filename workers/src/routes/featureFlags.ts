import type {
  FeatureFlagBatchPatch,
  FeatureFlagPatch,
  FeatureFlagSubject,
} from '../../../shared/feature-rollout.contract';
import { jsonResponse } from '../utils/response';
import { verifyJWTMiddleware, requireAdmin } from '../middleware/jwtAuth';
import {
  getFeatureFlag,
  listFeatureFlags,
  patchFeatureFlag,
  patchFeatureFlagBatch,
  resolveFeatureFlag,
  rollbackFeatureFlag,
} from '../services/featureFlagService';
import { authenticateParentRoute } from './parentPortal/sessionAuth';

const requestIdOf = (request: Request) => request.headers.get('X-Request-Id') || crypto.randomUUID();

const flagError = (message: string, status: number, code: string): Response => (
  jsonResponse({ status: 'error', message, code }, status)
);

const mapError = (error: unknown): Response => {
  const code = error instanceof Error ? error.message : 'FEATURE_FLAG_ERROR';
  if (code === 'FEATURE_FLAG_NOT_FOUND') return flagError('Feature flag not found', 404, code);
  if (code === 'FEATURE_FLAG_ROLLBACK_NOT_FOUND') return flagError('No rollback mutation found', 409, code);
  if (code === 'FEATURE_FLAG_VERSION_CONFLICT') return flagError('Feature flag version conflict', 409, code);
  if (code.startsWith('FEATURE_FLAG_INVALID_') || code.startsWith('FEATURE_FLAG_BATCH_') || code === 'FEATURE_FLAG_PATCH_METADATA_REQUIRED') {
    return flagError(code, 400, code);
  }
  return flagError('Unable to process feature flag request', 500, 'FEATURE_FLAG_ERROR');
};

const authSubject = async (request: Request, env: { DB: D1Database; JWT_SECRET?: string }) => {
  const auth = await verifyJWTMiddleware(request, env as never);
  if (!(auth instanceof Response)) {
    const role = auth.user.role;
    if (role === 'admin' || role === 'teacher' || role === 'student') {
      const subject: FeatureFlagSubject = {
        role,
        username: auth.user.username,
        classIds: auth.user.classId ? [auth.user.classId] : [],
      };
      return subject;
    }
  }
  const parent = await authenticateParentRoute(request, env as never);
  if (!(parent instanceof Response)) {
    return {
      role: 'parent' as const,
      username: `parent:${parent.linkId}`,
      classIds: [],
    };
  }
  return null;
};

const isValidBatchEnvelope = (body: Record<string, unknown>): body is Record<string, unknown> & FeatureFlagBatchPatch => (
  Array.isArray(body.changes)
  && typeof body.reason === 'string'
  && Boolean(body.reason.trim())
  && Number.isInteger(body.expectedVersion)
);

export async function handleFeatureFlagRoutes(
  request: Request,
  env: { DB: D1Database; JWT_SECRET?: string },
  path: string,
  method: string,
): Promise<Response | null> {
  if (!path.startsWith('/api/system-settings/feature-flags')) return null;

  const resolveMatch = path === '/api/system-settings/feature-flags/resolve';
  if (resolveMatch && method === 'GET') {
    const subject = await authSubject(request, env);
    if (!subject) return flagError('Unauthorized', 401, 'UNAUTHORIZED');
    const url = new URL(request.url);
    const key = (url.searchParams.get('flag') || '').trim();
    if (!key) return flagError('flag is required', 400, 'FEATURE_FLAG_KEY_REQUIRED');
    const flag = await getFeatureFlag(env.DB, key);
    if (!flag) return flagError('Feature flag not found', 404, 'FEATURE_FLAG_NOT_FOUND');
    const resolution = await resolveFeatureFlag(flag, subject);
    const response = jsonResponse({ status: 'success', data: resolution });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }

  const auth = await verifyJWTMiddleware(request, env as never);
  if (auth instanceof Response) return auth;
  if (!requireAdmin(auth.user)) return flagError('Forbidden', 403, 'FORBIDDEN');

  if (path === '/api/system-settings/feature-flags' && method === 'GET') {
    const flags = await listFeatureFlags(env.DB);
    return jsonResponse({ status: 'success', data: flags });
  }

  const batchMatch = path.match(/^\/api\/system-settings\/feature-flags\/([^/]+)\/batch$/);
  if (batchMatch && method === 'PATCH') {
    const key = decodeURIComponent(batchMatch[1]);
    const body: Record<string, unknown> = await request.json<Record<string, unknown>>()
      .catch(() => ({} as Record<string, unknown>));
    if (!Array.isArray(body.changes)) {
      return flagError('changes is required', 400, 'FEATURE_FLAG_BATCH_CHANGES_REQUIRED');
    }
    if (typeof body.reason !== 'string' || !body.reason.trim()) {
      return flagError('reason is required', 400, 'FEATURE_FLAG_REASON_REQUIRED');
    }
    if (!Number.isInteger(body.expectedVersion)) {
      return flagError('expectedVersion is required', 400, 'FEATURE_FLAG_VERSION_REQUIRED');
    }
    if (!isValidBatchEnvelope(body)) {
      return flagError('Invalid batch request', 400, 'FEATURE_FLAG_BATCH_INVALID');
    }
    try {
      const data = await patchFeatureFlagBatch(
        env.DB,
        key,
        body,
        auth.user.username,
        requestIdOf(request),
      );
      return jsonResponse({ status: 'success', data });
    } catch (error) {
      return mapError(error);
    }
  }

  const rollbackMatch = path.match(/^\/api\/system-settings\/feature-flags\/([^/]+)\/rollback$/);
  if (rollbackMatch && method === 'POST') {
    const key = decodeURIComponent(rollbackMatch[1]);
    const body: Record<string, unknown> = await request.json<Record<string, unknown>>()
      .catch(() => ({} as Record<string, unknown>));
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) return flagError('reason is required', 400, 'FEATURE_FLAG_REASON_REQUIRED');
    try {
      const data = await rollbackFeatureFlag(env.DB, key, auth.user.username, requestIdOf(request), reason);
      return jsonResponse({ status: 'success', data });
    } catch (error) {
      return mapError(error);
    }
  }

  const patchMatch = path.match(/^\/api\/system-settings\/feature-flags\/([^/]+)$/);
  if (patchMatch && method === 'PATCH') {
    const key = decodeURIComponent(patchMatch[1]);
    const body: Record<string, unknown> = await request.json<Record<string, unknown>>()
      .catch(() => ({} as Record<string, unknown>));
    if (typeof body.field !== 'string' || typeof body.reason !== 'string' || !body.reason.trim()) {
      return flagError('field, value and reason are required', 400, 'FEATURE_FLAG_PATCH_REQUIRED');
    }
    const patch: FeatureFlagPatch = {
      field: body.field as FeatureFlagPatch['field'],
      value: body.value,
      reason: body.reason,
    };
    try {
      const data = await patchFeatureFlag(env.DB, key, patch, auth.user.username, requestIdOf(request));
      return jsonResponse({ status: 'success', data });
    } catch (error) {
      return mapError(error);
    }
  }

  return flagError('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
}

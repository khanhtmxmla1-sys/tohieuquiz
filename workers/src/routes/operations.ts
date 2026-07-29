import type { Env } from '../types';
import { requireAdmin, verifyJWTMiddleware } from '../middleware/jwtAuth';
import { buildOperationsSnapshot } from '../services/operationsService';
import { errorResponse, jsonResponse } from '../utils/response';

export async function handleOperationsRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response | null> {
  if (path !== '/api/admin/operations') return null;
  if (method !== 'GET') return errorResponse('Method not allowed', 405);

  const auth = await verifyJWTMiddleware(request, env);
  if (auth instanceof Response) return auth;
  if (!requireAdmin(auth.user)) return errorResponse('Forbidden', 403);

  const snapshot = await buildOperationsSnapshot(env, {
    requestId: request.headers.get('x-request-id') || request.headers.get('cf-ray') || crypto.randomUUID(),
  });
  const response = jsonResponse({ status: 'success', data: snapshot }, 200);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
}

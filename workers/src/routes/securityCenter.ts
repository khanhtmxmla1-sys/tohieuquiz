import type { Env } from '../types';
import { verifyJWTMiddleware } from '../middleware/jwtAuth';
import {
  listAuthSessions,
  listSecurityEvents,
  revokeAllAuthSessions,
  revokeAuthSession,
} from '../services/authSessionService';
import { errorResponse, jsonResponse } from '../utils/response';
import { withClearedAuthCookie } from '../utils/authSession';

const noStore = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
};

const requestId = (request: Request): string => (
  request.headers.get('x-request-id')
  || request.headers.get('cf-ray')
  || crypto.randomUUID()
);

export async function handleSecurityCenterRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response | null> {
  const isSecurityRoute = path === '/api/account/sessions'
    || path === '/api/account/sessions/revoke-all'
    || path === '/api/account/logout-all'
    || path === '/api/account/security-events'
    || /^\/api\/account\/sessions\/[^/]+\/revoke$/.test(path);
  if (!isSecurityRoute) return null;

  const auth = await verifyJWTMiddleware(request, env);
  if (auth instanceof Response) return auth;
  const user = auth.user;

  if (path === '/api/account/sessions' && method === 'GET') {
    return noStore(jsonResponse({ status: 'success', data: await listAuthSessions(env.DB, user) }));
  }

  if (path === '/api/account/security-events' && method === 'GET') {
    return noStore(jsonResponse({ status: 'success', data: await listSecurityEvents(env.DB, user) }));
  }

  if ((path === '/api/account/sessions/revoke-all' || path === '/api/account/logout-all') && method === 'POST') {
    const cutoff = new Date();
    const accountTable = user.role === 'student' ? 'students' : 'teachers';
    await env.DB.prepare(`UPDATE ${accountTable} SET token_version = token_version + 1 WHERE username = ?`)
      .bind(user.username).run();
    await revokeAllAuthSessions(env.DB, user, {
      requestId: requestId(request),
      cutoff,
      reason: 'logout_all',
    });
    return withClearedAuthCookie(jsonResponse({ status: 'success' }));
  }

  const match = path.match(/^\/api\/account\/sessions\/([^/]+)\/revoke$/);
  if (match && method === 'POST') {
    const sessionId = decodeURIComponent(match[1]);
    const changed = await revokeAuthSession(env.DB, user, sessionId, {
      requestId: requestId(request),
      reason: sessionId === user.sessionId ? 'current_session_revoked' : 'user_revoked',
    });
    if (!changed) return errorResponse('Session not found', 404);
    const response = jsonResponse({ status: 'success' });
    return sessionId === user.sessionId ? withClearedAuthCookie(response) : response;
  }

  return errorResponse('Method not allowed', 405);
}

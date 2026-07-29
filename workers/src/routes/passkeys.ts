import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import type { Env } from '../types';
import { requireTeacher, verifyJWTMiddleware } from '../middleware/jwtAuth';
import { createAuthSession } from '../services/authSessionService';
import {
  beginPasskeyAuthentication,
  beginPasskeyRegistration,
  finishPasskeyAuthentication,
  finishPasskeyRegistration,
  listPasskeys,
  revokePasskey,
} from '../services/webauthnService';
import { parseBody } from '../utils/helpers';
import { signJWT } from '../utils/jwt';
import { buildAuthSessionData, withAuthCookie } from '../utils/authSession';
import { errorResponse, jsonResponse } from '../utils/response';

interface StaffRow {
  username: string;
  full_name: string;
  role: 'teacher' | 'admin';
  class: string;
  status: 'ACTIVE' | 'DISABLED';
  must_change_password: number;
  token_version: number;
}

const ACCOUNT_PREFIX = '/api/account/passkeys';
const AUTH_PREFIX = '/api/passkeys/authenticate';
const requestId = (request: Request): string => (
  request.headers.get('x-request-id') || request.headers.get('cf-ray') || crypto.randomUUID()
);
const noStore = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
};

const loadStaff = async (db: D1Database, usernameInput: unknown): Promise<StaffRow | null> => {
  const username = String(usernameInput || '').trim().slice(0, 128);
  if (!username) return null;
  return db.prepare(`
    SELECT username, full_name, role, class, status, must_change_password, token_version
    FROM teachers
    WHERE username = ? AND role IN ('teacher', 'admin')
    LIMIT 1
  `).bind(username).first<StaffRow>();
};

const identity = (staff: StaffRow) => ({
  username: staff.username,
  role: staff.role,
  fullName: staff.full_name,
});

const genericPasskeyError = (status = 400): Response => (
  errorResponse('Không thể xác minh passkey. Hãy thử lại hoặc dùng mật khẩu.', status)
);

const logVerificationFailure = (error: unknown, request: Request) => {
  console.warn('[Passkey] verification_failed', {
    requestId: requestId(request),
    reason: error instanceof Error ? error.constructor.name : 'UnknownError',
  });
};

export async function handlePasskeyRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response | null> {
  if (!path.startsWith(ACCOUNT_PREFIX) && !path.startsWith(AUTH_PREFIX)) return null;

  if (path === `${AUTH_PREFIX}/options` && method === 'POST') {
    const body = await parseBody(request);
    const staff = await loadStaff(env.DB, body?.username);
    if (!staff || staff.status !== 'ACTIVE' || staff.must_change_password === 1) {
      return genericPasskeyError(401);
    }
    try {
      return noStore(jsonResponse({
        status: 'success',
        data: await beginPasskeyAuthentication(env.DB, identity(staff), requestId(request)),
      }));
    } catch (error) {
      logVerificationFailure(error, request);
      return genericPasskeyError(401);
    }
  }

  if (path === `${AUTH_PREFIX}/verify` && method === 'POST') {
    const body = await parseBody(request);
    const staff = await loadStaff(env.DB, body?.username);
    if (!staff || staff.status !== 'ACTIVE' || staff.must_change_password === 1 || !env.JWT_SECRET) {
      return genericPasskeyError(401);
    }
    if (!body?.challengeId || !body?.response) return genericPasskeyError(400);
    try {
      await finishPasskeyAuthentication(env.DB, env, identity(staff), {
        challengeId: String(body.challengeId),
        response: body.response as AuthenticationResponseJSON,
      });
      const session = await createAuthSession(env.DB, request, {
        username: staff.username,
        role: staff.role,
        tokenVersion: Number(staff.token_version),
      });
      const token = await signJWT({
        id: staff.username,
        username: staff.username,
        role: staff.role,
        fullName: staff.full_name,
        classId: staff.class,
        school_id: staff.username,
        tokenVersion: Number(staff.token_version),
        sessionId: session.id,
        purpose: 'session',
      }, env.JWT_SECRET, '7d');
      await env.DB.prepare('UPDATE teachers SET last_login_at = ?, updated_at = ? WHERE username = ?')
        .bind(new Date().toISOString(), new Date().toISOString(), staff.username).run();
      return withAuthCookie(noStore(jsonResponse({
        status: 'success',
        data: buildAuthSessionData(env, {
          username: staff.username,
          fullName: staff.full_name,
          role: staff.role,
          class: staff.class,
          requiresPasswordChange: false,
        }, token),
      })), token);
    } catch (error) {
      logVerificationFailure(error, request);
      return genericPasskeyError(401);
    }
  }

  const auth = await verifyJWTMiddleware(request, env);
  if (auth instanceof Response) return auth;
  if (!requireTeacher(auth.user) || auth.user.role === 'student') return errorResponse('Forbidden', 403);
  const staff = await loadStaff(env.DB, auth.user.username);
  if (!staff || staff.status !== 'ACTIVE') return errorResponse('Account unavailable', 401);

  if (path === ACCOUNT_PREFIX && method === 'GET') {
    return noStore(jsonResponse({ status: 'success', data: await listPasskeys(env.DB, identity(staff)) }));
  }

  if (path === `${ACCOUNT_PREFIX}/register/options` && method === 'POST') {
    return noStore(jsonResponse({
      status: 'success',
      data: await beginPasskeyRegistration(env.DB, identity(staff), requestId(request)),
    }));
  }

  if (path === `${ACCOUNT_PREFIX}/register/verify` && method === 'POST') {
    const body = await parseBody(request);
    if (!body?.challengeId || !body?.response) return genericPasskeyError(400);
    try {
      const data = await finishPasskeyRegistration(env.DB, env, identity(staff), {
        challengeId: String(body.challengeId),
        response: body.response as RegistrationResponseJSON,
        label: typeof body.label === 'string' ? body.label : undefined,
      }, requestId(request));
      return noStore(jsonResponse({ status: 'success', data }, 201));
    } catch (error) {
      logVerificationFailure(error, request);
      return genericPasskeyError(400);
    }
  }

  const revokeMatch = path.match(/^\/api\/account\/passkeys\/([^/]+)$/);
  if (revokeMatch && method === 'DELETE') {
    const changed = await revokePasskey(
      env.DB,
      identity(staff),
      decodeURIComponent(revokeMatch[1]),
      requestId(request),
    );
    if (!changed) return errorResponse('Passkey not found', 404);
    return noStore(jsonResponse({ status: 'success' }));
  }

  return errorResponse('Method not allowed', 405);
}

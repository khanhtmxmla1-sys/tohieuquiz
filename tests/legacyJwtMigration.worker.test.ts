// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
import { verifyJWTMiddleware } from '../workers/src/middleware/jwtAuth';
import { handleLogoutRoute } from '../workers/src/routes/logout';
import { getAuthTokenTransportMode } from '../workers/src/utils/authSession';
import { JWT_AUDIENCE, JWT_ISSUER, signJWT } from '../workers/src/utils/jwt';

const secret = 'a-test-secret-that-is-long-enough';
const key = new TextEncoder().encode(secret);

const activeTeacherDb = (tokenVersion = 3) => ({
  prepare: vi.fn(() => ({
    bind: vi.fn(() => ({
      first: vi.fn(async () => ({
        status: 'ACTIVE',
        token_version: tokenVersion,
        must_change_password: 0,
      })),
    })),
  })),
});

const env = (mode: 'compat' | 'enforce', tokenVersion = 3) => ({
  DB: activeTeacherDb(tokenVersion),
  JWT_SECRET: secret,
  AUTH_MIGRATION_MODE: mode,
  AUTH_TOKEN_TRANSPORT_MODE: 'cookie',
} as any);

const cookieRequest = (token: string, path = '/api/results') => new Request(`https://test${path}`, {
  headers: { Cookie: `theme=light; auth_token=${token}; locale=vi` },
});

const bearerRequest = (token: string) => new Request('https://test/api/results', {
  headers: { Authorization: `Bearer ${token}`, 'x-request-id': 'req-legacy-1' },
});

async function signedToken(payload: Record<string, unknown>, claims: { issuer?: boolean; audience?: boolean } = {}) {
  let jwt = new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m');
  if (claims.issuer) jwt = jwt.setIssuer(JWT_ISSUER);
  if (claims.audience) jwt = jwt.setAudience(JWT_AUDIENCE);
  return jwt.sign(key);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('JWT migration enforcement', () => {
  it('keeps checked deployment defaults on enforce and cookie-only transport', () => {
    const config = readFileSync('workers/wrangler.toml', 'utf8');
    expect(config).toContain('AUTH_MIGRATION_MODE = "enforce"');
    expect(config).toContain('AUTH_TOKEN_TRANSPORT_MODE = "cookie"');
    expect(getAuthTokenTransportMode({})).toBe('cookie');
  });

  it('rejects browser Bearer transport in enforce mode but accepts the same current token from the cookie', async () => {
    const token = await signJWT({
      username: 'teacher-a', role: 'teacher', tokenVersion: 3, purpose: 'session',
    }, secret);

    const bearerResult = await verifyJWTMiddleware(bearerRequest(token), env('enforce'));
    expect(bearerResult).toBeInstanceOf(Response);
    expect((bearerResult as Response).status).toBe(401);

    const cookieResult = await verifyJWTMiddleware(cookieRequest(token), env('enforce'));
    expect(cookieResult).not.toBeInstanceOf(Response);
    expect(cookieResult).toMatchObject({ user: { username: 'teacher-a', tokenVersion: 3 } });
  });

  it('rejects enforce-mode cookies missing issuer, audience, or tokenVersion', async () => {
    const missingIssuer = await signedToken(
      { username: 'student-a', role: 'student', purpose: 'session', tokenVersion: 0 },
      { audience: true },
    );
    const missingAudience = await signedToken(
      { username: 'student-a', role: 'student', purpose: 'session', tokenVersion: 0 },
      { issuer: true },
    );
    const missingVersion = await signedToken(
      { username: 'student-a', role: 'student', purpose: 'session' },
      { issuer: true, audience: true },
    );

    for (const token of [missingIssuer, missingAudience, missingVersion]) {
      const result = await verifyJWTMiddleware(cookieRequest(token), env('enforce'));
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
    }
  });

  it('accepts a compat legacy Bearer session and emits only safe migration metadata', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const legacy = await signedToken({ username: 'teacher-a', role: 'teacher' });

    const result = await verifyJWTMiddleware(bearerRequest(legacy), env('compat'));
    expect(result).not.toBeInstanceOf(Response);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(String(infoSpy.mock.calls[0][0]));
    expect(logged).toEqual({
      event: 'auth_legacy_session_accepted',
      requestId: 'req-legacy-1',
      route: '/api/results',
      method: 'GET',
      transport: 'bearer',
      legacyClaims: true,
      missingTokenVersion: true,
      role: 'teacher',
    });
    expect(JSON.stringify(logged)).not.toContain('teacher-a');
    expect(JSON.stringify(logged)).not.toContain(legacy);
  });

  it('supports cookie restore and clears the cookie on logout without returning a readable token', async () => {
    const token = await signJWT({
      id: 'student-a', username: 'student-a', role: 'student', tokenVersion: 0,
    }, secret);
    const restored = await verifyJWTMiddleware(cookieRequest(token, '/api/student-profile'), env('enforce'));
    expect(restored).toMatchObject({ user: { id: 'student-a', role: 'student', tokenVersion: 0 } });

    const logout = await handleLogoutRoute(
      new Request('https://test/api/logout', { method: 'POST', headers: { Cookie: `auth_token=${token}` } }),
      env('enforce'),
    );
    expect(logout.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect(logout.headers.get('Cache-Control')).toBe('no-store');
    expect(await logout.json()).not.toHaveProperty('token');
  });
});

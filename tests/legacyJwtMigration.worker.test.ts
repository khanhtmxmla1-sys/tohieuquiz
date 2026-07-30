// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
import { verifyJWTMiddleware } from '../workers/src/middleware/jwtAuth';
import { handleLogoutRoute } from '../workers/src/routes/logout';
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

const env = (tokenVersion = 3, overrides: Record<string, unknown> = {}) => ({
  DB: activeTeacherDb(tokenVersion),
  JWT_SECRET: secret,
  ...overrides,
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

describe('JWT cookie enforcement after compatibility removal', () => {
  it('removes migration and token transport compatibility flags from deployment config', () => {
    const config = readFileSync('workers/wrangler.toml', 'utf8');
    expect(config).not.toContain('AUTH_MIGRATION_MODE');
    expect(config).not.toContain('AUTH_TOKEN_TRANSPORT_MODE');
  });

  it('rejects browser Bearer transport but accepts the same current token from the cookie', async () => {
    const token = await signJWT({
      username: 'teacher-a', role: 'teacher', tokenVersion: 3, purpose: 'session',
    }, secret);

    const bearerResult = await verifyJWTMiddleware(bearerRequest(token), env());
    expect(bearerResult).toBeInstanceOf(Response);
    expect((bearerResult as Response).status).toBe(401);

    const cookieResult = await verifyJWTMiddleware(cookieRequest(token), env());
    expect(cookieResult).not.toBeInstanceOf(Response);
    expect(cookieResult).toMatchObject({ user: { username: 'teacher-a', tokenVersion: 3 } });
  });

  it('rejects cookies missing issuer, audience, or tokenVersion', async () => {
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
      const result = await verifyJWTMiddleware(cookieRequest(token), env());
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
    }
  });

  it('cannot re-enable Bearer or legacy claims with obsolete compatibility flags', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const current = await signJWT({
      username: 'teacher-a', role: 'teacher', tokenVersion: 3, purpose: 'session',
    }, secret);
    const legacy = await signedToken({ username: 'teacher-a', role: 'teacher' });
    const obsoleteCompatEnv = env(3, {
      AUTH_MIGRATION_MODE: 'compat',
      AUTH_TOKEN_TRANSPORT_MODE: 'compat',
    });

    for (const request of [bearerRequest(current), cookieRequest(legacy)]) {
      const result = await verifyJWTMiddleware(request, obsoleteCompatEnv);
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(401);
    }
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('supports cookie restore and clears the cookie on logout without returning a readable token', async () => {
    const token = await signJWT({
      id: 'student-a', username: 'student-a', role: 'student', tokenVersion: 0,
    }, secret);
    const restored = await verifyJWTMiddleware(cookieRequest(token, '/api/student-profile'), env());
    expect(restored).toMatchObject({ user: { id: 'student-a', role: 'student', tokenVersion: 0 } });

    const logout = await handleLogoutRoute(
      new Request('https://test/api/logout', { method: 'POST', headers: { Cookie: `auth_token=${token}` } }),
      env(),
    );
    expect(logout.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect(logout.headers.get('Cache-Control')).toBe('no-store');
    expect(await logout.json()).not.toHaveProperty('token');
  });
});

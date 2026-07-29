// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verify: vi.fn(), requireTeacher: vi.fn(), beginAuth: vi.fn(), finishAuth: vi.fn(),
  beginRegistration: vi.fn(), finishRegistration: vi.fn(), list: vi.fn(), revoke: vi.fn(),
  createSession: vi.fn(), sign: vi.fn(), withCookie: vi.fn(), buildData: vi.fn(),
}));
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: mocks.verify,
  requireTeacher: mocks.requireTeacher,
}));
vi.mock('../workers/src/services/webauthnService', () => ({
  beginPasskeyAuthentication: mocks.beginAuth,
  finishPasskeyAuthentication: mocks.finishAuth,
  beginPasskeyRegistration: mocks.beginRegistration,
  finishPasskeyRegistration: mocks.finishRegistration,
  listPasskeys: mocks.list,
  revokePasskey: mocks.revoke,
}));
vi.mock('../workers/src/services/authSessionService', () => ({ createAuthSession: mocks.createSession }));
vi.mock('../workers/src/utils/jwt', () => ({ signJWT: mocks.sign }));
vi.mock('../workers/src/utils/authSession', () => ({
  buildAuthSessionData: mocks.buildData,
  withAuthCookie: mocks.withCookie,
}));

import { handlePasskeyRoutes } from '../workers/src/routes/passkeys';

const staff = {
  username: 'teacher-a', full_name: 'Teacher A', role: 'teacher', class: '4A',
  status: 'ACTIVE', must_change_password: 0, token_version: 2,
};
const statement = {
  bind: vi.fn(function bind() { return this; }),
  first: vi.fn(async () => staff),
  run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
};
const db = { prepare: vi.fn(() => statement) } as any;
const env = { DB: db, JWT_SECRET: 'test-secret', ENVIRONMENT: 'test' } as any;

beforeEach(() => {
  vi.clearAllMocks();
  statement.bind.mockImplementation(function bind() { return this; });
  statement.first.mockResolvedValue(staff);
  statement.run.mockResolvedValue({ success: true, meta: { changes: 1 } });
  mocks.verify.mockResolvedValue({ user: { username: 'teacher-a', role: 'teacher' } });
  mocks.requireTeacher.mockReturnValue(true);
  mocks.beginAuth.mockResolvedValue({ challengeId: 'challenge-1', options: { challenge: 'abc' } });
  mocks.finishAuth.mockResolvedValue(undefined);
  mocks.beginRegistration.mockResolvedValue({ challengeId: 'challenge-r', options: { challenge: 'reg' } });
  mocks.finishRegistration.mockResolvedValue({ id: 'credential-1', label: 'Laptop' });
  mocks.list.mockResolvedValue([{ id: 'credential-1', label: 'Laptop' }]);
  mocks.revoke.mockResolvedValue(true);
  mocks.createSession.mockResolvedValue({ id: 'session-passkey' });
  mocks.sign.mockResolvedValue('signed-passkey-token');
  mocks.buildData.mockImplementation((_env: unknown, profile: any) => profile);
  mocks.withCookie.mockImplementation((response: Response) => response);
});

describe('passkey routes', () => {
  it('lists passkeys only for an authenticated staff account', async () => {
    const response = await handlePasskeyRoutes(
      new Request('https://api.test/api/account/passkeys'), env,
      '/api/account/passkeys', 'GET',
    );
    expect(response?.status).toBe(200);
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.list).toHaveBeenCalledWith(db, expect.objectContaining({ username: 'teacher-a', role: 'teacher' }));

    mocks.requireTeacher.mockReturnValueOnce(false);
    const denied = await handlePasskeyRoutes(
      new Request('https://api.test/api/account/passkeys'), env,
      '/api/account/passkeys', 'GET',
    );
    expect(denied?.status).toBe(403);
  });

  it('issues the same server session, JWT claims, and auth cookie after verified passkey authentication', async () => {
    const request = new Request('https://api.test/api/passkeys/authenticate/verify', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': 'req-passkey-login' },
      body: JSON.stringify({ username: 'teacher-a', challengeId: 'challenge-1', response: { id: 'credential-1' } }),
    });
    const response = await handlePasskeyRoutes(
      request, env, '/api/passkeys/authenticate/verify', 'POST',
    );
    expect(response?.status).toBe(200);
    expect(mocks.finishAuth).toHaveBeenCalledWith(
      db, env, expect.objectContaining({ username: 'teacher-a', role: 'teacher' }),
      { challengeId: 'challenge-1', response: { id: 'credential-1' } },
    );
    expect(mocks.createSession).toHaveBeenCalledWith(db, request, {
      username: 'teacher-a', role: 'teacher', tokenVersion: 2,
    });
    expect(mocks.sign).toHaveBeenCalledWith(expect.objectContaining({
      username: 'teacher-a', role: 'teacher', tokenVersion: 2,
      sessionId: 'session-passkey', purpose: 'session',
    }), 'test-secret', '7d');
    expect(mocks.withCookie).toHaveBeenCalledWith(expect.any(Response), 'signed-passkey-token');
  });

  it('uses a generic response when passkey authentication is unavailable', async () => {
    statement.first.mockResolvedValueOnce(null);
    const response = await handlePasskeyRoutes(
      new Request('https://api.test/api/passkeys/authenticate/options', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'missing' }),
      }), env, '/api/passkeys/authenticate/options', 'POST',
    );
    expect(response?.status).toBe(401);
    expect(await response?.text()).not.toMatch(/missing|credential|challenge/i);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

const state = vi.hoisted(() => ({
  user: { username: 'teacher-a', role: 'teacher', sessionId: 'current' } as JWTPayload,
  listAuthSessions: vi.fn(),
  listSecurityEvents: vi.fn(),
  revokeAuthSession: vi.fn(),
  revokeAllAuthSessions: vi.fn(),
}));

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({ user: state.user })),
}));
vi.mock('../workers/src/services/authSessionService', () => ({
  listAuthSessions: state.listAuthSessions,
  listSecurityEvents: state.listSecurityEvents,
  revokeAuthSession: state.revokeAuthSession,
  revokeAllAuthSessions: state.revokeAllAuthSessions,
}));

import { handleSecurityCenterRoutes } from '../workers/src/routes/securityCenter';

class Statement {
  bindings: unknown[] = [];
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async run() { return { success: true, meta: { changes: 1 } }; }
}

const env = { DB: { prepare: vi.fn(() => new Statement()) } } as any;

beforeEach(() => {
  state.listAuthSessions.mockReset().mockResolvedValue([
    { id: 'current', current: true, userAgentFamily: 'Chrome', createdAt: '2026-07-29T08:00:00Z', lastSeenAt: '2026-07-29T09:00:00Z', expiresAt: '2026-08-05T08:00:00Z' },
  ]);
  state.listSecurityEvents.mockReset().mockResolvedValue([]);
  state.revokeAuthSession.mockReset().mockResolvedValue(true);
  state.revokeAllAuthSessions.mockReset().mockResolvedValue(2);
});

describe('Security Center routes', () => {
  it('returns owner-scoped sessions with no-store caching', async () => {
    const response = await handleSecurityCenterRoutes(
      new Request('https://api.test/api/account/sessions'), env,
      '/api/account/sessions', 'GET',
    );
    const payload = await response?.json() as any;
    expect(response?.status).toBe(200);
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
    expect(state.listAuthSessions).toHaveBeenCalledWith(env.DB, state.user);
    expect(payload.data[0]).toMatchObject({ id: 'current', userAgentFamily: 'Chrome' });
    expect(JSON.stringify(payload)).not.toMatch(/ip_address|192\.168\./i);
  });

  it('revokes only the requested owned session', async () => {
    const response = await handleSecurityCenterRoutes(
      new Request('https://api.test/api/account/sessions/other/revoke', {
        method: 'POST', headers: { 'x-request-id': 'req-revoke-route' },
      }), env,
      '/api/account/sessions/other/revoke', 'POST',
    );
    expect(response?.status).toBe(200);
    expect(state.revokeAuthSession).toHaveBeenCalledWith(
      env.DB, state.user, 'other',
      expect.objectContaining({ requestId: 'req-revoke-route', reason: 'user_revoked' }),
    );
  });

  it('increments account version before cutoff-based logout all', async () => {
    const response = await handleSecurityCenterRoutes(
      new Request('https://api.test/api/account/sessions/revoke-all', {
        method: 'POST', headers: { 'x-request-id': 'req-all' },
      }), env,
      '/api/account/sessions/revoke-all', 'POST',
    );
    expect(response?.status).toBe(200);
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE teachers'));
    expect(state.revokeAllAuthSessions).toHaveBeenCalledWith(
      env.DB, state.user,
      expect.objectContaining({ requestId: 'req-all', reason: 'logout_all', cutoff: expect.any(Date) }),
    );
    expect(response?.headers.get('Set-Cookie')).toContain('auth_token=');
  });
});

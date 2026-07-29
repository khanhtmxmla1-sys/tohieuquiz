// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verify: vi.fn(), requireAdmin: vi.fn(), parentAuth: vi.fn(), list: vi.fn(), get: vi.fn(), patch: vi.fn(), resolve: vi.fn(), rollback: vi.fn(),
}));
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: mocks.verify,
  requireAdmin: mocks.requireAdmin,
}));
vi.mock('../workers/src/routes/parentPortal/sessionAuth', () => ({ authenticateParentRoute: mocks.parentAuth }));
vi.mock('../workers/src/services/featureFlagService', () => ({
  listFeatureFlags: mocks.list,
  getFeatureFlag: mocks.get,
  patchFeatureFlag: mocks.patch,
  resolveFeatureFlag: mocks.resolve,
  rollbackFeatureFlag: mocks.rollback,
}));

import { handleFeatureFlagRoutes } from '../workers/src/routes/featureFlags';

const db = {} as D1Database;
const env = { DB: db } as any;
const flag = {
  key: 'flag-a', description: 'Flag A', enabled: true, audience: 'teacher', percentage: 5,
  allowUsers: [], allowClasses: [], startsAt: null, endsAt: null, owner: 'platform', reason: 'pilot',
  stopConditions: {}, version: 1, updatedBy: 'admin', updatedAt: '2026-07-29T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue({ user: { username: 'teacher-a', role: 'teacher', classId: 'class-4a' } });
  mocks.requireAdmin.mockImplementation((user: any) => user.role === 'admin');
  mocks.parentAuth.mockResolvedValue(new Response('{}', { status: 401 }));
  mocks.list.mockResolvedValue([flag]);
  mocks.get.mockResolvedValue(flag);
  mocks.patch.mockResolvedValue({ ...flag, percentage: 25, version: 2 });
  mocks.rollback.mockResolvedValue({ ...flag, percentage: 100, version: 3 });
  mocks.resolve.mockResolvedValue({ key: 'flag-a', enabled: true, reason: 'percentage', bucket: 2, version: 1 });
});

describe('feature flag routes', () => {
  it('resolves for an authenticated subject derived from the verified session', async () => {
    const request = new Request('https://api.test/api/system-settings/feature-flags/resolve?flag=flag-a');
    const response = await handleFeatureFlagRoutes(request, env, '/api/system-settings/feature-flags/resolve', 'GET');
    expect(response?.status).toBe(200);
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.resolve).toHaveBeenCalledWith(flag, {
      role: 'teacher', username: 'teacher-a', classIds: ['class-4a'],
    });
  });

  it('resolves a parent audience from the verified Parent Portal session instead of client input', async () => {
    mocks.verify.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    mocks.parentAuth.mockResolvedValueOnce({
      linkId: 'parent-link-1', studentId: 'student-1', tokenVersion: 3, purpose: 'parent_session',
    });
    const request = new Request('https://api.test/api/system-settings/feature-flags/resolve?flag=flag-a');
    const response = await handleFeatureFlagRoutes(request, env, '/api/system-settings/feature-flags/resolve', 'GET');
    expect(response?.status).toBe(200);
    expect(mocks.resolve).toHaveBeenCalledWith(flag, {
      role: 'parent', username: 'parent:parent-link-1', classIds: [],
    });
  });

  it('blocks non-admin management and patches exactly one field with actor/request metadata', async () => {
    const denied = await handleFeatureFlagRoutes(
      new Request('https://api.test/api/system-settings/feature-flags'), env,
      '/api/system-settings/feature-flags', 'GET',
    );
    expect(denied?.status).toBe(403);

    mocks.verify.mockResolvedValueOnce({ user: { username: 'admin-a', role: 'admin' } });
    const request = new Request('https://api.test/api/system-settings/feature-flags/flag-a', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-request-id': 'req-flag-route' },
      body: JSON.stringify({ field: 'percentage', value: 25, reason: 'Open pilot' }),
    });
    const response = await handleFeatureFlagRoutes(
      request, env, '/api/system-settings/feature-flags/flag-a', 'PATCH',
    );
    expect(response?.status).toBe(200);
    expect(mocks.patch).toHaveBeenCalledWith(db, 'flag-a', {
      field: 'percentage', value: 25, reason: 'Open pilot',
    }, 'admin-a', 'req-flag-route');
  });

  it('rolls back only through the explicit endpoint with a required reason', async () => {
    mocks.verify.mockResolvedValue({ user: { username: 'admin-a', role: 'admin' } });
    const missing = await handleFeatureFlagRoutes(
      new Request('https://api.test/api/system-settings/feature-flags/flag-a/rollback', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
      }), env, '/api/system-settings/feature-flags/flag-a/rollback', 'POST',
    );
    expect(missing?.status).toBe(400);

    const request = new Request('https://api.test/api/system-settings/feature-flags/flag-a/rollback', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': 'req-rollback' },
      body: JSON.stringify({ reason: 'Stop condition breached' }),
    });
    const response = await handleFeatureFlagRoutes(
      request, env, '/api/system-settings/feature-flags/flag-a/rollback', 'POST',
    );
    expect(response?.status).toBe(200);
    expect(mocks.rollback).toHaveBeenCalledWith(
      db, 'flag-a', 'admin-a', 'req-rollback', 'Stop condition breached',
    );
  });
});

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

const state = vi.hoisted(() => ({
  user: null as JWTPayload | null,
}));
const loadTeacherActionCenterMock = vi.hoisted(() => vi.fn());

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => state.user
    ? { user: state.user }
    : new Response(JSON.stringify({ status: 'error' }), { status: 401 })),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
  requireAdmin: vi.fn((user: JWTPayload) => user.role === 'admin'),
}));

vi.mock('../workers/src/services/actionCenterService', () => ({
  loadTeacherActionCenter: loadTeacherActionCenterMock,
}));

import { handleActionCenterRoutes } from '../workers/src/routes/actionCenter';

const request = (method = 'GET') => new Request('https://test/api/teacher/action-center', { method });
const env = { DB: {} } as any;

describe('teacher action center route', () => {
  beforeEach(() => {
    state.user = null;
    loadTeacherActionCenterMock.mockReset();
    loadTeacherActionCenterMock.mockResolvedValue({
      generatedAt: '2026-07-28T08:00:00.000Z',
      items: [],
    });
  });

  it('requires an authenticated teacher or admin', async () => {
    const unauthorized = await handleActionCenterRoutes(
      request(), env, '/api/teacher/action-center', 'GET',
    );
    expect(unauthorized?.status).toBe(401);

    state.user = { id: 'student-a', username: 'student-a', role: 'student' };
    const forbidden = await handleActionCenterRoutes(
      request(), env, '/api/teacher/action-center', 'GET',
    );
    expect(forbidden?.status).toBe(403);
    expect(loadTeacherActionCenterMock).not.toHaveBeenCalled();
  });

  it('passes only the authenticated teacher identity to the service', async () => {
    state.user = { id: 'teacher-a', username: 'teacher-a', role: 'teacher' };

    const response = await handleActionCenterRoutes(
      request(), env, '/api/teacher/action-center', 'GET',
    );

    expect(response?.status).toBe(200);
    expect(loadTeacherActionCenterMock).toHaveBeenCalledWith(env.DB, {
      role: 'teacher',
      username: 'teacher-a',
    });
  });

  it('uses school-wide scope only for authenticated admins', async () => {
    state.user = { id: 'admin-a', username: 'admin-a', role: 'admin' };

    await handleActionCenterRoutes(
      request(), env, '/api/teacher/action-center', 'GET',
    );

    expect(loadTeacherActionCenterMock).toHaveBeenCalledWith(env.DB, {
      role: 'admin',
      username: 'admin-a',
    });
  });

  it('rejects mutation methods and ignores unrelated paths', async () => {
    expect((await handleActionCenterRoutes(
      request('POST'), env, '/api/teacher/action-center', 'POST',
    ))?.status).toBe(405);
    expect(await handleActionCenterRoutes(
      request(), env, '/api/teacher/other', 'GET',
    )).toBeNull();
  });
});

// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  handleParentNotificationRoutes,
  type ParentNotificationRouteRuntime,
} from '../workers/src/routes/parentPortal/notificationRoutes';

const item = {
  id: 'notification-a', kind: 'quiz_result' as const, title: 'Có kết quả mới', body: '8/10',
  payload: { resultId: 'result-a' }, isImportant: false, isRead: false,
  publishedAt: '2026-07-22T00:00:00.000Z', expiresAt: null,
};

const makeRuntime = (): ParentNotificationRouteRuntime => ({
  authenticate: vi.fn(async () => ({ linkId: 'link-a', studentId: 'student-a', tokenVersion: 1 })),
  list: vi.fn(async () => ({ items: [item], nextCursor: null, unreadCount: 1 })),
  markRead: vi.fn(async (_studentId, id) => id === 'notification-a'),
  markAllRead: vi.fn(async () => 3),
  now: () => new Date('2026-07-22T00:00:00.000Z'),
});

const request = (path: string, method = 'GET') => new Request(
  `https://phuhuynh.thtohieu.com${path}`,
  { method },
);

describe('parent notification feed', () => {
  it('uses the session student and supports canonical filters only', async () => {
    const runtime = makeRuntime();
    const response = await handleParentNotificationRoutes(
      request('/api/parent/notifications?studentId=student-b&kind=quiz_result&unread=true&limit=20'),
      { DB: {} } as any,
      '/api/parent/notifications',
      'GET',
      runtime,
    );

    expect(response?.status).toBe(200);
    expect(runtime.list).toHaveBeenCalledWith('student-a', expect.objectContaining({
      kind: 'quiz_result', unreadOnly: true, limit: 20,
    }), new Date('2026-07-22T00:00:00.000Z'));

    const invalid = await handleParentNotificationRoutes(
      request('/api/parent/notifications?kind=unknown'),
      { DB: {} } as any,
      '/api/parent/notifications',
      'GET',
      runtime,
    );
    expect(invalid?.status).toBe(400);
  });

  it('returns 404 when a notification belongs to another student', async () => {
    const runtime = makeRuntime();
    const response = await handleParentNotificationRoutes(
      request('/api/parent/notifications/notification-b/read', 'PATCH'),
      { DB: {} } as any,
      '/api/parent/notifications/notification-b/read',
      'PATCH',
      runtime,
    );

    expect(response?.status).toBe(404);
    expect(runtime.markRead).toHaveBeenCalledWith('student-a', 'notification-b', expect.any(String));
  });

  it('marks one or all active notifications read', async () => {
    const runtime = makeRuntime();
    const one = await handleParentNotificationRoutes(
      request('/api/parent/notifications/notification-a/read', 'PATCH'),
      { DB: {} } as any,
      '/api/parent/notifications/notification-a/read',
      'PATCH',
      runtime,
    );
    expect(one?.status).toBe(200);

    const all = await handleParentNotificationRoutes(
      request('/api/parent/notifications/read-all', 'POST'),
      { DB: {} } as any,
      '/api/parent/notifications/read-all',
      'POST',
      runtime,
    );
    await expect(all?.json()).resolves.toEqual({ data: { updatedCount: 3 } });
    expect(runtime.markAllRead).toHaveBeenCalledWith('student-a', expect.any(String), expect.any(Date));
  });
});

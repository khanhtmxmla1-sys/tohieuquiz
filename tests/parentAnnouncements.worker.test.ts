// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let authResult: { user: JWTPayload } | Response;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => authResult),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
}));

import {
  handleTeacherAnnouncementRoutes,
  type TeacherAnnouncementRuntime,
} from '../workers/src/routes/parentPortal/teacherAnnouncementRoutes';

const now = new Date('2026-07-22T00:00:00.000Z');
const authorizeClass = vi.fn(async () => ({
  classId: 'class-1', className: '4A9', teacherUsername: 'teacher-a',
}));
const createAnnouncement = vi.fn(async (input) => ({
  announcement: {
    id: input.id,
    classId: input.classId,
    title: input.title,
    body: input.body,
    isImportant: input.isImportant,
    status: 'PUBLISHED' as const,
    createdBy: input.createdBy,
    publishedAt: input.publishedAt,
    expiresAt: input.expiresAt,
    revokedAt: null,
  },
  delivery: { targetCount: 32, createdCount: 32 },
}));
const listAnnouncements = vi.fn(async () => [{
  id: 'pa-1', classId: 'class-1', title: 'Họp phụ huynh', body: 'Thứ Sáu',
  isImportant: true, status: 'PUBLISHED' as const, createdBy: 'teacher-a',
  publishedAt: now.toISOString(), expiresAt: null, revokedAt: null,
  targetCount: 32, readCount: 12, unreadCount: 20,
}]);
const findAnnouncement = vi.fn(async () => ({
  id: 'pa-1', classId: 'class-1', title: 'Họp phụ huynh', body: 'Thứ Sáu',
  isImportant: true, status: 'PUBLISHED' as const, createdBy: 'teacher-a',
  publishedAt: now.toISOString(), expiresAt: null, revokedAt: null,
}));
const revokeAnnouncement = vi.fn(async () => undefined);
const listDelivery = vi.fn(async () => [{
  studentId: 'student-1',
  studentName: 'Nguyễn Văn An',
  parentAccessStatus: 'active' as const,
  unreadCount: 2,
  lastViewedAt: '2026-07-21T12:00:00.000Z',
}]);

const runtime = (): TeacherAnnouncementRuntime => ({
  authorizeClass,
  createAnnouncement,
  listAnnouncements,
  findAnnouncement,
  revokeAnnouncement,
  listDelivery,
  now: () => now,
});

const request = (path: string, method = 'GET', body?: Record<string, unknown>) => new Request(
  `https://phuhuynh.thtohieu.com${path}`,
  {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  },
);

describe('teacher parent announcements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authResult = { user: { username: 'teacher-a', role: 'teacher' } as JWTPayload };
    authorizeClass.mockResolvedValue({
      classId: 'class-1', className: '4A9', teacherUsername: 'teacher-a',
    });
  });

  it('rejects another teacher and archived classes through the class scope guard', async () => {
    authorizeClass.mockResolvedValueOnce(new Response('{}', { status: 403 }) as any);
    const forbidden = await handleTeacherAnnouncementRoutes(
      request('/api/parent-announcements', 'POST', {
        classId: 'class-1', title: 'Tin mới', body: 'Nội dung', isImportant: false,
      }),
      { DB: {} } as any,
      '/api/parent-announcements',
      'POST',
      runtime(),
    );
    expect(forbidden?.status).toBe(403);

    authorizeClass.mockResolvedValueOnce(new Response('{}', { status: 404 }) as any);
    const archived = await handleTeacherAnnouncementRoutes(
      request('/api/parent-announcements?classId=class-1'),
      { DB: {} } as any,
      '/api/parent-announcements',
      'GET',
      runtime(),
    );
    expect(archived?.status).toBe(404);
  });

  it('validates title, body, and future expiry', async () => {
    const invalidTitle = await handleTeacherAnnouncementRoutes(
      request('/api/parent-announcements', 'POST', {
        classId: 'class-1', title: '', body: 'Nội dung', isImportant: false,
      }),
      { DB: {} } as any,
      '/api/parent-announcements',
      'POST',
      runtime(),
    );
    expect(invalidTitle?.status).toBe(400);

    const expired = await handleTeacherAnnouncementRoutes(
      request('/api/parent-announcements', 'POST', {
        classId: 'class-1', title: 'Tin mới', body: 'Nội dung',
        isImportant: false, expiresAt: '2026-07-21T00:00:00.000Z',
      }),
      { DB: {} } as any,
      '/api/parent-announcements',
      'POST',
      runtime(),
    );
    expect(expired?.status).toBe(400);
    expect(createAnnouncement).not.toHaveBeenCalled();
  });

  it('creates a text-only announcement and returns fan-out counts', async () => {
    const response = await handleTeacherAnnouncementRoutes(
      request('/api/parent-announcements', 'POST', {
        classId: 'class-1',
        title: '  Họp phụ huynh  ',
        body: '  <b>Không render HTML</b>  ',
        isImportant: true,
        expiresAt: '2026-07-29T00:00:00.000Z',
      }),
      { DB: {} } as any,
      '/api/parent-announcements',
      'POST',
      runtime(),
    );
    const payload = await response!.json() as any;

    expect(response?.status).toBe(201);
    expect(payload.data.delivery).toEqual({ targetCount: 32, createdCount: 32 });
    expect(createAnnouncement).toHaveBeenCalledWith(expect.objectContaining({
      classId: 'class-1',
      title: 'Họp phụ huynh',
      body: '<b>Không render HTML</b>',
      isImportant: true,
    }));
  });

  it('lists read metrics and revokes both announcement and source notifications', async () => {
    const listed = await handleTeacherAnnouncementRoutes(
      request('/api/parent-announcements?classId=class-1'),
      { DB: {} } as any,
      '/api/parent-announcements',
      'GET',
      runtime(),
    );
    await expect(listed?.json()).resolves.toMatchObject({
      data: { items: [{ targetCount: 32, readCount: 12, unreadCount: 20 }] },
    });

    const revoked = await handleTeacherAnnouncementRoutes(
      request('/api/parent-announcements/pa-1/revoke', 'POST'),
      { DB: {} } as any,
      '/api/parent-announcements/pa-1/revoke',
      'POST',
      runtime(),
    );
    expect(revoked?.status).toBe(200);
    expect(revokeAnnouncement).toHaveBeenCalledWith('pa-1', now.toISOString());
  });

  it('returns only teacher-safe delivery fields', async () => {
    const response = await handleTeacherAnnouncementRoutes(
      request('/api/parent-delivery?classId=class-1&kind=quiz_result'),
      { DB: {} } as any,
      '/api/parent-delivery',
      'GET',
      runtime(),
    );
    const payload = await response!.json() as any;

    expect(response?.status).toBe(200);
    expect(payload.data.items[0]).toEqual({
      studentId: 'student-1',
      studentName: 'Nguyễn Văn An',
      parentAccessStatus: 'active',
      unreadCount: 2,
      lastViewedAt: '2026-07-21T12:00:00.000Z',
    });
    expect(JSON.stringify(payload)).not.toMatch(/pin|accessCode|access_code|parentPhone|parent_phone/i);
    expect(listDelivery).toHaveBeenCalledWith('class-1', 'quiz_result');
  });
});

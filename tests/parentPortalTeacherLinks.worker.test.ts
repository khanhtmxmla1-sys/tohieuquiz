// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';
import type { ParentLinkRecord, ParentLinkRepository } from '../workers/src/parentPortal/types';

let authResult: { user: JWTPayload } | Response;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => authResult),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
}));

import { handleTeacherLinkRoutes } from '../workers/src/routes/parentPortal/teacherLinkRoutes';

const fixedNow = new Date('2026-07-22T00:00:00.000Z');

const existingLink = (overrides: Partial<ParentLinkRecord> = {}): ParentLinkRecord => ({
  id: 'pl-existing',
  studentId: 'student-1',
  accessCode: 'ABCDEFG234',
  pinHash: 'pbkdf2_sha256$100000$salt$hash',
  status: 'ACTIVE',
  tokenVersion: 2,
  createdBy: 'teacher-a',
  createdAt: '2026-07-20T00:00:00.000Z',
  activatedAt: '2026-07-20T01:00:00.000Z',
  revokedAt: null,
  lastAccessedAt: null,
  ...overrides,
});

const repository = (): ParentLinkRepository & {
  createLink: ReturnType<typeof vi.fn>;
  reissueLink: ReturnType<typeof vi.fn>;
  revokeLink: ReturnType<typeof vi.fn>;
} => ({
  findById: vi.fn(async () => existingLink()),
  findActiveByStudentId: vi.fn(async () => null),
  findByAccessCode: vi.fn(async () => null),
  findActivationByHash: vi.fn(async () => null),
  createLink: vi.fn(async (input) => existingLink({
    id: input.id,
    studentId: input.studentId,
    accessCode: input.accessCode,
    pinHash: null,
    status: 'PENDING',
    tokenVersion: 1,
    createdAt: input.createdAt,
  })),
  reissueLink: vi.fn(async (_linkId, _activation, now) => existingLink({
    pinHash: null,
    status: 'PENDING',
    tokenVersion: 3,
    activatedAt: null,
    createdAt: now,
  })),
  activateLink: vi.fn(async () => undefined),
  revokeLink: vi.fn(async () => undefined),
  touchLastAccessed: vi.fn(async () => undefined),
  loadProfile: vi.fn(async () => null),
});

const authorize = vi.fn(async () => ({
  studentId: 'student-1', classId: 'class-1', className: '4A9', fullName: 'Nguyễn Văn An',
}));
const audit = vi.fn(async () => undefined);

const request = (path: string, method: string, body?: Record<string, unknown>) => new Request(
  `https://phuhuynh.thtohieu.com${path}`,
  {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  },
);

const runtime = (repo = repository()) => ({
  repository: repo,
  authorize,
  audit,
  now: () => fixedNow,
});

describe('teacher parent-link lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authResult = { user: { username: 'teacher-a', role: 'teacher' } as JWTPayload };
    authorize.mockResolvedValue({
      studentId: 'student-1', classId: 'class-1', className: '4A9', fullName: 'Nguyễn Văn An',
    });
  });

  it('rejects unauthenticated requests before touching the repository', async () => {
    const repo = repository();
    authResult = new Response('{}', { status: 401 });

    const response = await handleTeacherLinkRoutes(
      request('/api/parent-links', 'POST', { studentId: 'student-1' }),
      { DB: {} } as any,
      '/api/parent-links',
      'POST',
      runtime(repo),
    );

    expect(response?.status).toBe(401);
    expect(repo.createLink).not.toHaveBeenCalled();
  });

  it('rejects another teacher and an archived student', async () => {
    authorize.mockResolvedValueOnce(new Response('{}', { status: 403 }) as any);
    const forbidden = await handleTeacherLinkRoutes(
      request('/api/parent-links', 'POST', { studentId: 'student-1' }),
      { DB: {} } as any,
      '/api/parent-links',
      'POST',
      runtime(),
    );
    expect(forbidden?.status).toBe(403);

    authorize.mockResolvedValueOnce(new Response('{}', { status: 404 }) as any);
    const missing = await handleTeacherLinkRoutes(
      request('/api/parent-links', 'POST', { studentId: 'student-1' }),
      { DB: {} } as any,
      '/api/parent-links',
      'POST',
      runtime(),
    );
    expect(missing?.status).toBe(404);
  });

  it.each([
    ['teacher', 201],
    ['admin', 201],
  ] as const)('creates a one-time activation for an authorized %s', async (role, status) => {
    authResult = { user: { username: `${role}-a`, role } as JWTPayload };
    const repo = repository();

    const response = await handleTeacherLinkRoutes(
      request('/api/parent-links', 'POST', { studentId: 'student-1' }),
      { DB: {} } as any,
      '/api/parent-links',
      'POST',
      runtime(repo),
    );
    const payload = await response!.json() as any;

    expect(response?.status).toBe(status);
    expect(payload.data.activationUrl).toMatch(/^https:\/\/phuhuynh\.thtohieu\.com\/activate\?token=[A-Za-z0-9_-]{43}$/);
    expect(payload.data.link).not.toHaveProperty('pinHash');
    expect(repo.createLink).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'PARENT_LINK_CREATED' }));
  });

  it('returns existing safe metadata instead of creating a duplicate active link', async () => {
    const repo = repository();
    vi.mocked(repo.findActiveByStudentId).mockResolvedValue(existingLink());

    const response = await handleTeacherLinkRoutes(
      request('/api/parent-links', 'POST', { studentId: 'student-1' }),
      { DB: {} } as any,
      '/api/parent-links',
      'POST',
      runtime(repo),
    );
    const payload = await response!.json() as any;

    expect(response?.status).toBe(200);
    expect(repo.createLink).not.toHaveBeenCalled();
    expect(JSON.stringify(payload)).not.toMatch(/pinHash|pin_hash|tokenHash|token_hash|activationToken/i);
    expect(payload.data).not.toHaveProperty('activationUrl');
  });

  it('lists safe metadata without hashes or raw tokens', async () => {
    const repo = repository();
    vi.mocked(repo.findActiveByStudentId).mockResolvedValue(existingLink());

    const response = await handleTeacherLinkRoutes(
      request('/api/parent-links?studentId=student-1', 'GET'),
      { DB: {} } as any,
      '/api/parent-links',
      'GET',
      runtime(repo),
    );
    const payload = await response!.json();

    expect(response?.status).toBe(200);
    expect(JSON.stringify(payload)).not.toMatch(/pinHash|pin_hash|tokenHash|token_hash|activationToken/i);
  });

  it('reissues and revokes a link with immediate token-version invalidation', async () => {
    const repo = repository();

    const reissued = await handleTeacherLinkRoutes(
      request('/api/parent-links/pl-existing/reissue', 'POST'),
      { DB: {} } as any,
      '/api/parent-links/pl-existing/reissue',
      'POST',
      runtime(repo),
    );
    const reissuedPayload = await reissued!.json() as any;
    expect(reissued?.status).toBe(200);
    expect(reissuedPayload.data.activationUrl).toContain('phuhuynh.thtohieu.com/activate?token=');
    expect(repo.reissueLink).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'PARENT_LINK_REISSUED' }));

    const revoked = await handleTeacherLinkRoutes(
      request('/api/parent-links/pl-existing', 'DELETE'),
      { DB: {} } as any,
      '/api/parent-links/pl-existing',
      'DELETE',
      runtime(repo),
    );
    expect(revoked?.status).toBe(200);
    expect(repo.revokeLink).toHaveBeenCalledWith('pl-existing', fixedNow.toISOString());
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'PARENT_LINK_REVOKED' }));
  });
});

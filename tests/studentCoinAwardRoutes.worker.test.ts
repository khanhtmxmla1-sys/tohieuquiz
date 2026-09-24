// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  requireTeacher: vi.fn(),
  requireAdmin: vi.fn(),
  getFeatureFlag: vi.fn(),
  resolveFeatureFlag: vi.fn(),
  preview: vi.fn(),
  create: vi.fn(),
  listStaff: vi.fn(),
  reverse: vi.fn(),
  adjust: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  listStudent: vi.fn(),
}));

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: mocks.verify,
  requireTeacher: mocks.requireTeacher,
  requireAdmin: mocks.requireAdmin,
}));

vi.mock('../workers/src/services/featureFlagService', () => ({
  getFeatureFlag: mocks.getFeatureFlag,
  resolveFeatureFlag: mocks.resolveFeatureFlag,
}));

vi.mock('../workers/src/coinAwards/service', () => ({
  previewCoinAward: mocks.preview,
  createCoinAward: mocks.create,
  listStaffCoinAwardHistory: mocks.listStaff,
  reverseCoinAwardBatch: mocks.reverse,
  adjustCoinAwardBatch: mocks.adjust,
  getCoinAwardSettings: mocks.getSettings,
  updateCoinAwardSettings: mocks.updateSettings,
  listStudentCoinAwardHistory: mocks.listStudent,
  CoinAwardDomainError: class CoinAwardDomainError extends Error {
    code: string;
    studentIds?: string[];
    constructor(code: string, message = code, studentIds?: string[]) {
      super(message);
      this.code = code;
      this.studentIds = studentIds;
    }
  },
}));

import { handleCoinAwardRoutes } from '../workers/src/routes/coinAwards';

const db = {} as D1Database;
const env = { DB: db, JWT_SECRET: 'test-secret' } as any;

const request = (path: string, method = 'GET', body?: unknown, requestId = 'req-coin-route') => new Request(
  `https://test${path}`,
  {
    method,
    headers: {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  },
);

const teacher: JWTPayload = {
  id: 'teacher-id', username: 'teacher-a', fullName: 'Cô A', role: 'teacher', classId: 'class-a',
};
const admin: JWTPayload = {
  id: 'admin-id', username: 'admin-a', fullName: 'Quản trị viên', role: 'admin',
};
const student: JWTPayload = {
  id: 'student-a', username: 'student-a', fullName: 'Học sinh A', role: 'student', classId: 'class-a',
};

const enabledFlag = {
  key: 'student_coin_awards_v1', enabled: true, audience: 'teacher', percentage: 100,
  allowUsers: [], allowClasses: [], startsAt: null, endsAt: null, version: 1,
};

const receipt = {
  batchId: 'coin-award-1', kind: 'AWARD', recipientCount: 1, coinsPerStudent: 20,
  totalCoins: 20, reason: 'Tiến bộ tốt', actorUsername: 'teacher-a', actorDisplayName: 'Cô A',
  actorRole: 'teacher', classId: 'class-a', className: 'Lớp A',
  createdAt: '2026-09-21T04:00:00.000Z', reversalExpiresAt: null, alreadyProcessed: false,
};

const page = { items: [], nextCursor: null };

const responseJson = async (response: Response) => await response.json() as Record<string, any>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue({ user: teacher });
  mocks.requireTeacher.mockImplementation((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin');
  mocks.requireAdmin.mockImplementation((user: JWTPayload) => user.role === 'admin');
  mocks.getFeatureFlag.mockResolvedValue(enabledFlag);
  mocks.resolveFeatureFlag.mockResolvedValue({ key: 'student_coin_awards_v1', enabled: true, reason: 'percentage', bucket: 1, version: 1 });
  mocks.preview.mockResolvedValue({ ...receipt, remainingTeacherDailyCoins: 1980 });
  mocks.create.mockResolvedValue(receipt);
  mocks.listStaff.mockResolvedValue(page);
  mocks.reverse.mockResolvedValue({ ...receipt, kind: 'REVERSAL', totalCoins: -20 });
  mocks.adjust.mockResolvedValue({ ...receipt, kind: 'ADJUSTMENT', totalCoins: -20 });
  mocks.getSettings.mockResolvedValue({
    scopeKey: 'school', maxCoinsPerStudent: 100, maxTeacherDailyCoins: 2000,
    reversalWindowMinutes: 15, updatedBy: 'admin-a', updatedAt: '2026-09-21T04:00:00.000Z',
  });
  mocks.updateSettings.mockResolvedValue({
    scopeKey: 'school', maxCoinsPerStudent: 200, maxTeacherDailyCoins: 2000,
    reversalWindowMinutes: 15, updatedBy: 'admin-a', updatedAt: '2026-09-21T04:00:00.001Z',
  });
  mocks.listStudent.mockResolvedValue(page);
});

describe('student coin award routes', () => {
  it('rejects a student from staff mutation routes before reading the body', async () => {
    mocks.verify.mockResolvedValue({ user: student });
    mocks.requireTeacher.mockReturnValue(false);
    const response = await handleCoinAwardRoutes(
      request('/api/coin-awards/batches', 'POST', { coinsPerStudent: 999, actorRole: 'admin' }),
      env, '/api/coin-awards/batches', 'POST',
    );
    expect(response.status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('derives the actor from the verified session and never trusts actor fields in the body', async () => {
    const body = {
      classId: 'class-a', studentIds: ['student-a'], selectionMode: 'STUDENT',
      coinsPerStudent: 20, reason: 'Tiến bộ tốt', idempotencyKey: 'award-1',
      username: 'attacker', role: 'admin', actorUsername: 'attacker',
    };
    const response = await handleCoinAwardRoutes(
      request('/api/coin-awards/batches', 'POST', body),
      env, '/api/coin-awards/batches', 'POST',
    );
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      db,
      { username: 'teacher-a', displayName: 'Cô A', role: 'teacher' },
      expect.objectContaining({ classId: 'class-a', studentIds: ['student-a'], coinsPerStudent: 20 }),
    );
    expect(mocks.create.mock.calls[0][1]).not.toMatchObject({ username: 'attacker', role: 'admin' });
    expect(mocks.resolveFeatureFlag).toHaveBeenCalledWith(enabledFlag, {
      role: 'teacher', username: 'teacher-a', classIds: ['class-a'],
    });
  });

  it('fails closed when the enabled flag excludes the verified rollout subject', async () => {
    mocks.resolveFeatureFlag.mockResolvedValueOnce({
      key: 'student_coin_awards_v1', enabled: false, reason: 'excluded', bucket: 75, version: 1,
    });
    const response = await handleCoinAwardRoutes(
      request('/api/coin-awards/preview', 'POST', {
        classId: 'class-a', studentIds: ['student-a'], selectionMode: 'STUDENT',
        coinsPerStudent: 20, reason: 'Tiến bộ tốt', idempotencyKey: 'award-rollout-off',
      }),
      env, '/api/coin-awards/preview', 'POST',
    );
    expect(response.status).toBe(404);
    expect(await responseJson(response)).toMatchObject({ code: 'FEATURE_DISABLED' });
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it('blocks teacher settings writes while allowing an admin settings write', async () => {
    mocks.verify.mockResolvedValueOnce({ user: teacher });
    mocks.requireAdmin.mockReturnValueOnce(false);
    const denied = await handleCoinAwardRoutes(
      request('/api/coin-awards/settings', 'PUT', { maxCoinsPerStudent: 200 }),
      env, '/api/coin-awards/settings', 'PUT',
    );
    expect(denied.status).toBe(403);

    mocks.verify.mockResolvedValueOnce({ user: admin });
    mocks.requireTeacher.mockReturnValueOnce(true);
    mocks.requireAdmin.mockReturnValueOnce(true);
    const allowed = await handleCoinAwardRoutes(
      request('/api/coin-awards/settings', 'PUT', {
        maxCoinsPerStudent: 200, maxTeacherDailyCoins: 2000, reversalWindowMinutes: 15,
        expectedUpdatedAt: '2026-09-21T04:00:00.000Z', reason: 'Điều chỉnh chính sách',
      }),
      env, '/api/coin-awards/settings', 'PUT',
    );
    expect(allowed.status).toBe(200);
    expect(mocks.updateSettings).toHaveBeenCalledWith(
      db,
      { username: 'admin-a', displayName: 'Quản trị viên', role: 'admin' },
      expect.objectContaining({ maxCoinsPerStudent: 200, reason: 'Điều chỉnh chính sách' }),
    );
  });

  it('restricts reversal to the original teacher role and adjustment to administrators', async () => {
    mocks.verify.mockResolvedValueOnce({ user: admin });
    const adminReverse = await handleCoinAwardRoutes(
      request('/api/coin-awards/batches/batch-1/reverse', 'POST', { reason: 'Hoàn tác' }),
      env, '/api/coin-awards/batches/batch-1/reverse', 'POST',
    );
    expect(adminReverse.status).toBe(403);
    expect(mocks.reverse).not.toHaveBeenCalled();

    mocks.verify.mockResolvedValueOnce({ user: teacher });
    mocks.requireAdmin.mockReturnValueOnce(false);
    const teacherAdjustment = await handleCoinAwardRoutes(
      request('/api/coin-awards/batches/batch-1/adjustments', 'POST', {
        studentIds: ['student-a'], reason: 'Điều chỉnh', idempotencyKey: 'adjust-1',
      }),
      env, '/api/coin-awards/batches/batch-1/adjustments', 'POST',
    );
    expect(teacherAdjustment.status).toBe(403);
    expect(mocks.adjust).not.toHaveBeenCalled();
  });

  it('returns only the authenticated student history', async () => {
    mocks.verify.mockResolvedValue({ user: student });
    const response = await handleCoinAwardRoutes(
      request('/api/student/coin-awards/history?limit=10&studentId=other-student'),
      env, '/api/student/coin-awards/history', 'GET',
    );
    expect(response.status).toBe(200);
    expect(mocks.listStudent).toHaveBeenCalledWith(db, 'student-a', expect.objectContaining({ limit: 10 }));
    expect(mocks.listStudent.mock.calls[0][1]).not.toBe('other-student');
  });

  it('rejects staff access to the student-owned history route', async () => {
    mocks.verify.mockResolvedValue({ user: teacher });
    const response = await handleCoinAwardRoutes(
      request('/api/student/coin-awards/history'),
      env, '/api/student/coin-awards/history', 'GET',
    );
    expect(response.status).toBe(403);
    expect(mocks.listStudent).not.toHaveBeenCalled();
  });

  it('fails closed with a stable 404 when the server feature flag is disabled, but keeps history readable', async () => {
    mocks.getFeatureFlag.mockResolvedValue({ ...enabledFlag, enabled: false });
    const mutationPaths: Array<[string, string, unknown]> = [
      ['/api/coin-awards/preview', 'POST', {}],
      ['/api/coin-awards/batches', 'POST', {}],
      ['/api/coin-awards/batches/batch-1/reverse', 'POST', {}],
      ['/api/coin-awards/batches/batch-1/adjustments', 'POST', {}],
      ['/api/coin-awards/settings', 'PUT', {}],
    ];
    for (const [path, method, body] of mutationPaths) {
      if (path === '/api/coin-awards/settings' || path.includes('/adjustments')) {
        mocks.verify.mockResolvedValueOnce({ user: admin });
        mocks.requireAdmin.mockReturnValueOnce(true);
      }
      const response = await handleCoinAwardRoutes(request(path, method, body), env, path, method);
      expect(response.status, `${method} ${path}`).toBe(404);
      expect(await responseJson(response), `${method} ${path}`).toMatchObject({ code: 'FEATURE_DISABLED' });
    }
    const history = await handleCoinAwardRoutes(
      request('/api/coin-awards/history'), env, '/api/coin-awards/history', 'GET',
    );
    expect(history.status).toBe(200);
    expect(mocks.listStaff).toHaveBeenCalled();
  });

  it('maps domain errors to safe stable status codes', async () => {
    mocks.create.mockRejectedValueOnce({ code: 'LIMIT_EXCEEDED', message: 'private policy detail' });
    const limited = await handleCoinAwardRoutes(
      request('/api/coin-awards/batches', 'POST', { classId: 'class-a', studentIds: ['student-a'] }),
      env, '/api/coin-awards/batches', 'POST',
    );
    expect(limited.status).toBe(422);
    expect(await responseJson(limited)).toMatchObject({ code: 'LIMIT_EXCEEDED' });

    mocks.reverse.mockRejectedValueOnce({ code: 'REVERSAL_EXPIRED', message: 'internal scope detail' });
    const expired = await handleCoinAwardRoutes(
      request('/api/coin-awards/batches/batch-1/reverse', 'POST', { reason: 'Quá hạn' }),
      env, '/api/coin-awards/batches/batch-1/reverse', 'POST',
    );
    expect(expired.status).toBe(409);
    expect(await responseJson(expired)).toMatchObject({ code: 'REVERSAL_EXPIRED' });
  });

  it('returns a request id for unexpected failures without logging student lists or reasons', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.create.mockRejectedValueOnce(new Error('database failure: student-a secret reason')); 
    const response = await handleCoinAwardRoutes(
      request('/api/coin-awards/batches', 'POST', {
        classId: 'class-a', studentIds: ['student-a'], reason: 'Không được log',
      }, 'req-unexpected'),
      env, '/api/coin-awards/batches', 'POST',
    );
    expect(response.status).toBe(500);
    expect(response.headers.get('x-request-id')).toBe('req-unexpected');
    expect(await responseJson(response)).toMatchObject({ code: 'COIN_AWARD_FAILED', requestId: 'req-unexpected' });
    expect(log.mock.calls.flat().join(' ')).not.toContain('student-a secret reason');
    expect(log.mock.calls.flat().join(' ')).not.toContain('Không được log');
    log.mockRestore();
  });

  it('returns method not allowed for an unknown coin-award verb', async () => {
    const response = await handleCoinAwardRoutes(
      request('/api/coin-awards/history', 'DELETE'), env, '/api/coin-awards/history', 'DELETE',
    );
    expect(response.status).toBe(405);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload | null = null;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => currentUser
    ? { user: currentUser }
    : new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }), { status: 401 })),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
  isStudent: vi.fn((user: JWTPayload) => user.role === 'student'),
}));

import {
  handleGetMyResultReport,
  handleListMyResultReports,
} from '../workers/src/routes/resultReports/studentReportsHandler';

const studentReport = {
  id: 'phieu-an', resultId: 'result-an', quizId: 'quiz-1', quizTitle: 'Bài 1',
  teacherName: 'Cô Khánh', score: 8, classification: 'Giỏi',
  submittedAt: '2026-07-20T08:00:00.000Z', publishedAt: '2026-07-21T08:00:00.000Z',
  studentName: 'Nguyễn Văn An', classId: 'class-4a9', subject: 'Toán',
  totalQuestions: 10, correctCount: 8, incorrectCount: 2,
  comment: 'Tốt', needsImprovement: 'Đọc kỹ', encouragement: 'Cố gắng',
};

const request = (path: string) => new Request(`https://example.test${path}`, {
  headers: { Authorization: 'Bearer token' },
});

describe('student-owned result report reads', () => {
  beforeEach(() => {
    currentUser = {
      id: 'student-an', username: 'an.4a9', role: 'student', classId: 'class-4a9',
    };
  });

  it('lists reports using the authenticated student id only', async () => {
    const listStudentReports = vi.fn(async () => [studentReport]);
    const response = await handleListMyResultReports(
      request('/api/result-reports/mine'), {} as any,
      { resolveStudentId: vi.fn(async () => 'student-an'), listStudentReports } as any,
    );

    expect(response.status).toBe(200);
    expect(listStudentReports).toHaveBeenCalledWith('student-an');
    expect(await response.json()).toEqual({ data: [studentReport] });
  });

  it('returns only a report owned by the authenticated student', async () => {
    const getStudentReport = vi.fn(async (studentId, phieuId) => (
      studentId === 'student-an' && phieuId === 'phieu-an' ? studentReport : null
    ));
    const response = await handleGetMyResultReport(
      request('/api/result-reports/mine/phieu-an'), {} as any, 'phieu-an',
      { resolveStudentId: vi.fn(async () => 'student-an'), getStudentReport } as any,
    );

    expect(response.status).toBe(200);
    expect(getStudentReport).toHaveBeenCalledWith('student-an', 'phieu-an');
  });

  it('does not reveal whether another student report exists', async () => {
    const response = await handleGetMyResultReport(
      request('/api/result-reports/mine/phieu-other'), {} as any, 'phieu-other',
      { resolveStudentId: vi.fn(async () => 'student-an'), getStudentReport: vi.fn(async () => null) } as any,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'RESULT_REPORT_NOT_FOUND', message: 'Result report not found' },
    });
  });

  it('rejects teacher access to student-owned endpoints', async () => {
    currentUser = { username: 'teacher-a', role: 'teacher' };
    const listStudentReports = vi.fn();
    const response = await handleListMyResultReports(
      request('/api/result-reports/mine'), {} as any,
      { resolveStudentId: vi.fn(), listStudentReports } as any,
    );

    expect(response.status).toBe(403);
    expect(listStudentReports).not.toHaveBeenCalled();
  });
});

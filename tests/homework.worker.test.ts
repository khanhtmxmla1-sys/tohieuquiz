import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectConsoleError, expectConsoleMessage } from './helpers/expectedConsole';
type TestUser = { id?: string; username: string; role: 'student' | 'teacher' | 'admin'; classId?: string };
let currentUser: TestUser;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({ user: currentUser })),
  requireTeacher: vi.fn((user: TestUser) => user.role === 'teacher' || user.role === 'admin'),
  isStudent: vi.fn((user: TestUser) => user.role === 'student'),
}));

import { handleHomeworkRoutes } from '../workers/src/routes/homework';
import { verifyToken } from '../workers/src/middleware/auth';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, readonly db: Database) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { this.db.executed.push(this); return this.db.first(this.sql, this.bindings) as T; }
  async all<T>() { this.db.executed.push(this); return { results: this.db.all(this.sql, this.bindings) as T[] }; }
  async run() {
    this.db.executed.push(this);
    if (this.sql.includes("status='AI_REVIEW'") && this.sql.includes('published_at IS NULL')) {
      const canWriteAiDraft = this.db.gradingSubmission.status !== 'GRADED' && !this.db.gradingSubmission.published_at;
      return { success: true, meta: { changes: canWriteAiDraft ? 1 : 0 } };
    }
    return { success: true, meta: { changes: 1 } };
  }
}

class Database {
  executed: Statement[] = [];
  assignment: any = { id: 'hw-1', title: 'Bài 1', class_id: 'class-a', teacher_username: 'teacher-a', status: 'OPEN', deadline: '2099-01-01T00:00:00.000Z', max_attempts: 2 };
  submission: any = null;
  gradingSubmission: any = {
    assignment_id: 'hw-1',
    student_id: 'student-a',
    file_urls: '["https://res.cloudinary.com/demo/image.png"]',
    rubric_json: '[]',
    source_ocr_text: 'Bài kiểm tra',
    ai_content: '',
    class_id: 'class-a',
    teacher_username: 'teacher-a',
    assignment_title: 'Bài 1',
    subject: 'Toán',
    status: 'SUBMITTED',
    score: 0,
    published_at: null,
    grading_breakdown_json: '[]',
  };
  prepare(sql: string) { return new Statement(sql, this); }
  first(sql: string, bindings: unknown[]) {
    if (sql.includes('FROM hw_assignments ha') && sql.includes('WHERE ha.id')) return this.assignment;
    if (sql.includes('SELECT hs.*') && sql.includes('WHERE hs.id')) return {
      ...this.gradingSubmission,
      id: bindings[0],
    };
    if (sql.includes('FROM classes WHERE id')) return { id: bindings[0], name: '4A9', teacher_username: bindings[0] === 'class-b' ? 'teacher-b' : 'teacher-a' };
    if (sql.includes('FROM students WHERE id')) return { id: 'student-a', full_name: 'Học sinh A', class_id: 'class-a' };
    if (sql.includes('student_id=? AND idempotency_key=?')) return this.submission;
    if (sql.includes('COUNT(*) AS count')) return { count: this.submission ? 1 : 0 };
    if (sql.includes('COUNT(*) AS total')) return { total: 11 };
    return null;
  }
  all(sql: string, _bindings: unknown[]) {
    if (sql.includes('FROM hw_assignments ha') && sql.includes('ORDER BY')) return [];
    return [];
  }
}

const aiResponse = (result: Record<string, unknown>) => new Response(JSON.stringify({
  choices: [{ message: { content: JSON.stringify(result) } }],
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

const env = (db: Database) => ({ DB: db, JWT_SECRET: 'test' } as any);

describe('canonical homework authorization and deadlines', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  beforeEach(() => { currentUser = { username: 'teacher-a', role: 'teacher' }; });

  it('scopes the teacher assignment list by JWT username', async () => {
    const db = new Database();
    const response = await handleHomeworkRoutes(new Request('https://test/api/homework/assignments'), env(db), '/api/homework/assignments', 'GET');
    expect(response.status).toBe(200);
    expect(db.executed[0].sql).toContain('c.teacher_username = ?');
    expect(db.executed[0].bindings).toEqual(['teacher-a']);
  });

  it('lets homework JWT reach the route-level authorization middleware', () => {
    const request = new Request('https://test/api/homework/assignments', { headers: { Authorization: 'Bearer jwt-token' } });
    expect(verifyToken(request, {} as any)).toBeNull();
  });

  it('rejects a teacher updating another teacher assignment', async () => {
    const db = new Database();
    db.assignment.teacher_username = 'teacher-b';
    const response = await handleHomeworkRoutes(new Request('https://test/api/homework/assignments/hw-1', { method: 'PATCH', body: '{}' }), env(db), '/api/homework/assignments/hw-1', 'PATCH');
    expect(response.status).toBe(403);
  });

  it('rejects student submission after the deadline', async () => {
    currentUser = { id: 'student-a', username: 'student-a', role: 'student', classId: 'class-a' };
    const db = new Database();
    db.assignment.deadline = '2020-01-01T00:00:00.000Z';
    const response = await handleHomeworkRoutes(new Request('https://test/api/homework/assignments/hw-1/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileUrls: ['https://res.cloudinary.com/demo/image.png'], idempotencyKey: 'request-1' }) }), env(db), '/api/homework/assignments/hw-1/submissions', 'POST');
    expect(response.status).toBe(409);
  });

  it('accepts new R2 asset URLs for student homework submissions', async () => {
    currentUser = { id: 'student-a', username: 'student-a', role: 'student', classId: 'class-a' };
    const db = new Database();
    const response = await handleHomeworkRoutes(new Request('https://test/api/homework/assignments/hw-1/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileUrls: ['https://assets.thtohieu.com/media/homework-submission/student/2026/07/file.png'],
        idempotencyKey: 'r2-request-1',
      }),
    }), env(db), '/api/homework/assignments/hw-1/submissions', 'POST');

    expect(response.status).toBe(201);
    const insert = db.executed.find(statement => statement.sql.includes('INSERT INTO hw_submissions'));
    expect(insert?.bindings).toContain(JSON.stringify([
      'https://assets.thtohieu.com/media/homework-submission/student/2026/07/file.png',
    ]));
  });

  it('returns the existing row for an idempotent retry', async () => {
    currentUser = { id: 'student-a', username: 'student-a', role: 'student', classId: 'class-a' };
    const db = new Database();
    db.submission = { id: 'sub-1', assignment_id: 'hw-1', student_id: 'student-a', file_urls: '[]', analytics_json: '[]', grading_breakdown_json: '[]', attempt_no: 1 };
    const response = await handleHomeworkRoutes(new Request('https://test/api/homework/assignments/hw-1/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileUrls: ['https://res.cloudinary.com/demo/image.png'], idempotencyKey: 'request-1' }) }), env(db), '/api/homework/assignments/hw-1/submissions', 'POST');
    const payload = await response.json() as any;
    expect(response.status).toBe(200);
    expect(payload.idempotent).toBe(true);
    expect(payload.data.id).toBe('sub-1');
  });


  it('analytics selects only the latest attempt per student', async () => {
    const db = new Database();
    const response = await handleHomeworkRoutes(new Request('https://test/api/homework/assignments/hw-1/analytics'), env(db), '/api/homework/assignments/hw-1/analytics', 'GET');
    expect(response.status).toBe(200);
    const analyticsQuery = db.executed.find(statement => statement.sql.includes('MAX(attempt_no)'));
    expect(analyticsQuery?.sql).toContain('GROUP BY student_id');
    expect(analyticsQuery?.bindings).toEqual(['hw-1', 'hw-1']);
  });

  it('does not request or write an AI draft for a published grade', async () => {
    const db = new Database();
    db.gradingSubmission.status = 'GRADED';
    db.gradingSubmission.published_at = '2026-08-14T12:00:00.000Z';
    const fetchSpy = vi.fn(async () => aiResponse({
      score: 9,
      confidence: 0.9,
      feedback: 'Tốt',
      criteriaBreakdown: [{ questionId: '1', label: 'Câu 1', score: 9, maxScore: 10, comment: '' }],
      flaggedReason: null,
    }));
    vi.stubGlobal('fetch', fetchSpy);

    const response = await handleHomeworkRoutes(new Request('https://test/api/homework/submissions/sub-1/ai-suggestion', { method: 'POST' }), {
      ...env(db), CLIPROXY_API: 'https://ai.test/v1', CLIPROXY_TOKEN: 'secret',
    }, '/api/homework/submissions/sub-1/ai-suggestion', 'POST');

    expect(response.status).toBe(409);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(db.executed.some(statement => statement.sql.includes("status='AI_REVIEW'"))).toBe(false);
  });

  it('does not overwrite a grade published while the AI request is in flight', async () => {
    const db = new Database();
    vi.stubGlobal('fetch', vi.fn(async () => {
      db.gradingSubmission.status = 'GRADED';
      db.gradingSubmission.published_at = '2026-08-14T12:00:00.000Z';
      return aiResponse({
        score: 9,
        confidence: 0.9,
        feedback: 'Tốt',
        criteriaBreakdown: [{ questionId: '1', label: 'Câu 1', score: 9, maxScore: 10, comment: '' }],
        flaggedReason: null,
      });
    }));

    const response = await handleHomeworkRoutes(new Request('https://test/api/homework/submissions/sub-1/ai-suggestion', { method: 'POST' }), {
      ...env(db), CLIPROXY_API: 'https://ai.test/v1', CLIPROXY_TOKEN: 'secret',
    }, '/api/homework/submissions/sub-1/ai-suggestion', 'POST');

    expect(response.status).toBe(409);
    const update = db.executed.find(statement => statement.sql.includes("status='AI_REVIEW'"));
    expect(update?.sql).toContain('published_at IS NULL');
  });

  it.each([
    {
      name: 'criterion score exceeds its maximum',
      result: { score: 10, confidence: 0.9, feedback: 'Sai breakdown', criteriaBreakdown: [{ questionId: '1', label: 'Câu 1', score: 2, maxScore: 1, comment: '' }] },
    },
    {
      name: 'total score disagrees with the criteria ratio',
      result: { score: 10, confidence: 0.9, feedback: 'Sai tổng', criteriaBreakdown: [{ questionId: '1', label: 'Câu 1', score: 5, maxScore: 10, comment: '' }] },
    },
  ])('rejects an AI draft when $name', async ({ result }) => {
    const db = new Database();
    vi.stubGlobal('fetch', vi.fn(async () => aiResponse(result)));

    const response = await handleHomeworkRoutes(new Request('https://test/api/homework/submissions/sub-1/ai-suggestion', { method: 'POST' }), {
      ...env(db), CLIPROXY_API: 'https://ai.test/v1', CLIPROXY_TOKEN: 'secret',
    }, '/api/homework/submissions/sub-1/ai-suggestion', 'POST');

    expect(response.status).toBe(422);
    expect(db.executed.some(statement => statement.sql.includes("status='AI_REVIEW'"))).toBe(false);
    expect(db.executed.some(statement => statement.sql.includes("status='NEEDS_REVIEW'"))).toBe(false);
  });

  it('rejects a published breakdown whose total disagrees with the teacher score', async () => {
    const db = new Database();
    const response = await handleHomeworkRoutes(new Request('https://test/api/homework/submissions/sub-1/grade', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score: 8,
        feedback: 'Đã duyệt',
        gradingBreakdown: [{ questionId: '1', label: 'Câu 1', score: 5, maxScore: 10, comment: '' }],
      }),
    }), env(db), '/api/homework/submissions/sub-1/grade', 'PATCH');

    expect(response.status).toBe(400);
    expect(db.executed.some(statement => statement.sql.includes("status='GRADED'"))).toBe(false);
  });

  it('publishes a distinct parent notification when a teacher revises a grade', async () => {
    const db = new Database();
    db.gradingSubmission.status = 'GRADED';
    db.gradingSubmission.score = 7;
    db.gradingSubmission.published_at = '2026-08-14T12:00:00.000Z';

    const response = await handleHomeworkRoutes(new Request('https://test/api/homework/submissions/sub-1/grade', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: 8, feedback: 'Điều chỉnh sau rà soát', gradingBreakdown: [] }),
    }), env(db), '/api/homework/submissions/sub-1/grade', 'PATCH');

    expect(response.status).toBe(200);
    const parentInsert = db.executed.find(statement => statement.sql.includes('INSERT OR IGNORE INTO parent_notifications'));
    expect(parentInsert?.bindings[4]).toMatch(/^sub-1:revision:/);
    expect(parentInsert?.bindings[5]).toBe('Điểm bài tập đã được điều chỉnh');
    expect(parentInsert?.bindings[6]).toContain('7.0/10 → 8.0/10');
  });

  it('shows AI evidence separately from the published teacher score', async () => {
    const submission = {
      id: 'sub-1',
      assignment_id: 'hw-1',
      student_id: 'student-a',
      student_name: 'Học sinh A',
      status: 'GRADED',
      file_urls: ['https://res.cloudinary.com/demo/image.png'],
      student_note: '',
      teacher_feedback: 'Điểm đã chốt',
      ai_evaluation: JSON.stringify({ version: 1, feedback: 'AI nhận xét', flaggedReason: 'Ảnh câu 2 bị mờ' }),
      ai_feedback: 'AI nhận xét',
      ai_score: 8,
      ai_confidence: 0.86,
      score: 7,
      submitted_at: '2026-08-14T10:00:00.000Z',
      gradingBreakdown: [{ questionId: '1', label: 'Câu 1', score: 4, maxScore: 5, comment: 'Đúng ý chính' }],
      published_at: '2026-08-14T12:00:00.000Z',
    };

    vi.doMock('../src/features/homework/stores/useHomeworkStore', () => ({
      useHomeworkStore: () => ({ submissions: [], fetchClassAssignments: vi.fn() }),
    }));
    vi.doMock('../src/stores/useRosterStore', () => ({
      useRosterStore: (selector: (state: any) => unknown) => selector({
        students: { 'class-a': [{ id: 'student-a', username: 'student-a', fullName: 'Học sinh A' }] },
        fetchStudents: vi.fn(async () => undefined),
      }),
    }));
    vi.doMock('../src/features/homework/services/homeworkBackendService', () => ({
      homeworkBackendService: {
        getSubmissions: vi.fn(async () => [submission]),
        getAssignmentAnalytics: vi.fn(async () => ({ submitted: 1, totalStudents: 1, graded: 1, mostMissed: [] })),
        publishGrade: vi.fn(),
      },
    }));
    vi.doMock('../src/features/homework/services/homeworkService', () => ({
      homeworkService: { gradeSubmission: vi.fn() },
    }));
    vi.doMock('../src/features/analytics', () => ({ ClassHeatmap: () => null }));
    vi.doMock('../src/features/homework/components/PhieuBatchPanel', () => ({ PhieuBatchPanel: () => null }));

    const { AssignmentSubmissionsView } = await import('../src/features/homework/components/AssignmentSubmissionsView');
    render(React.createElement(AssignmentSubmissionsView, {
      assignment: {
        id: 'hw-1',
        title: 'Bài 1',
        description: '',
        subject: 'Toán',
        deadline: '2099-01-01T00:00:00.000Z',
        class_id: 'class-a',
        teacher_id: 'teacher-a',
        file_url: '',
        ai_content: '',
        created_at: '2026-08-14T09:00:00.000Z',
        class: { id: 'class-a', name: '4A9' },
      },
      onBack: vi.fn(),
    }));

    fireEvent.click(await screen.findByText('Học sinh A'));
    expect(await screen.findByText('AI nhận xét')).toBeInTheDocument();
    expect(screen.getByText('Độ tin cậy: 86%')).toBeInTheDocument();
    expect(screen.getByText('Ảnh câu 2 bị mờ')).toBeInTheDocument();
    expect(screen.getByText('Câu 1')).toBeInTheDocument();
    expect(screen.getByText('4/5')).toBeInTheDocument();
    expect(screen.getByText('8/10')).toBeInTheDocument();
    expect(screen.getByText('Điểm đã công bố: 7/10')).toBeInTheDocument();
  });

  it('keeps a submission submitted when the AI provider is unavailable', async () => {
    const errorSpy = expectConsoleError();
    const db = new Database();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    const response = await handleHomeworkRoutes(new Request('https://test/api/homework/submissions/sub-1/ai-suggestion', { method: 'POST' }), {
      ...env(db), CLIPROXY_API: 'https://ai.test/v1', CLIPROXY_TOKEN: 'secret',
    }, '/api/homework/submissions/sub-1/ai-suggestion', 'POST');
    expect(response.status).toBe(502);
    expect(db.executed.some(statement => statement.sql.includes("status='NEEDS_REVIEW'"))).toBe(false);
    expectConsoleMessage(errorSpy, 'AI service returned 500');
  });
});

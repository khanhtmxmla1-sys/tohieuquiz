import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  async run() { this.db.executed.push(this); return { success: true }; }
}

class Database {
  executed: Statement[] = [];
  assignment: any = { id: 'hw-1', title: 'Bài 1', class_id: 'class-a', teacher_username: 'teacher-a', status: 'OPEN', deadline: '2099-01-01T00:00:00.000Z', max_attempts: 2 };
  submission: any = null;
  prepare(sql: string) { return new Statement(sql, this); }
  first(sql: string, bindings: unknown[]) {
    if (sql.includes('FROM hw_assignments ha') && sql.includes('WHERE ha.id')) return this.assignment;
    if (sql.includes('SELECT hs.*') && sql.includes('WHERE hs.id')) return {
      id: bindings[0], assignment_id: 'hw-1', student_id: 'student-a', file_urls: '["https://res.cloudinary.com/demo/image.png"]',
      rubric_json: '[]', source_ocr_text: 'Bài kiểm tra', ai_content: '', class_id: 'class-a', teacher_username: 'teacher-a',
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

const env = (db: Database) => ({ DB: db, JWT_SECRET: 'test' } as any);

describe('canonical homework authorization and deadlines', () => {
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

  it('marks a submission for manual review when the AI provider is unavailable', async () => {
    const db = new Database();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    const response = await handleHomeworkRoutes(new Request('https://test/api/homework/submissions/sub-1/ai-suggestion', { method: 'POST' }), {
      ...env(db), CLIPROXY_API: 'https://ai.test/v1', CLIPROXY_TOKEN: 'secret',
    }, '/api/homework/submissions/sub-1/ai-suggestion', 'POST');
    expect(response.status).toBe(502);
    expect(db.executed.some(statement => statement.sql.includes("status='NEEDS_REVIEW'"))).toBe(true);
    vi.unstubAllGlobals();
  });
});

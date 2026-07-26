import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({ user: currentUser })),
  requireAdmin: vi.fn((user: JWTPayload) => user.role === 'admin'),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
  isStudent: vi.fn((user: JWTPayload) => user.role === 'student'),
}));

import { handleResultRoutes } from '../workers/src/routes/results';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, readonly db: FakeDatabase) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { this.db.executed.push(this); return this.db.first(this.sql, this.bindings) as T; }
  async all<T>() { this.db.executed.push(this); return { results: [] as T[] }; }
  async run() { this.db.executed.push(this); return { success: true, meta: { changes: 1, last_row_id: 91 } }; }
}

class FakeDatabase {
  executed: Statement[] = [];
  prepare(sql: string) { return new Statement(sql, this); }
  first(sql: string, bindings: unknown[]) {
    if (sql.includes('FROM students') && sql.includes('WHERE students.username = ?')) {
      return {
        id: 'student-1', username: 'student-1', full_name: 'Nguyen Van A',
        class_id: 'class-4a9', class_name: '4A9',
      };
    }
    if (sql.includes('FROM assignments') && sql.includes('WHERE a.id = ?')) {
      return {
        id: bindings[0], quiz_id: 'quiz-week-30', class_id: 'class-4a9',
        class_name: '4A9', student_id: '', max_attempts: 3,
        status: 'OPEN', deadline: '2099-01-01T00:00:00.000Z',
      };
    }
    if (sql.includes("UPPER(COALESCE(a.status, 'OPEN')) = 'OPEN'")) {
      return {
        id: 'assignment-current-3-attempts', quiz_id: 'quiz-week-30', class_id: 'class-4a9',
        class_name: '4A9', student_id: '', max_attempts: 3,
        status: 'OPEN', deadline: '2099-01-01T00:00:00.000Z',
      };
    }
    if (sql.includes('SELECT max_attempts FROM assignments WHERE quiz_id = ?')) {
      return { max_attempts: 1 };
    }
    if (sql.includes('COUNT(*) as cnt')) return { cnt: 1 };
    return null;
  }
}

const requestBody = {
  assignmentId: 'assignment-current-3-attempts',
  quizId: 'quiz-week-30',
  quizTitle: 'Week 30',
  studentName: 'ignored-client-name',
  className: 'ignored-client-class',
  score: 10,
  correctCount: 1,
  totalQuestions: 1,
  timeTaken: 1,
  answers: { q1: { selectedAnswer: 'B', isCorrect: true } },
};

const makeRequest = (body = requestBody) => new Request('https://example.test/api/results', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('assignment-scoped result attempt limits', () => {
  beforeEach(() => {
    currentUser = {
      id: 'student-1', username: 'student-1', role: 'student', classId: 'class-4a9',
    } as JWTPayload;
  });

  it('uses the submitted assignment id instead of an older assignment for the same quiz and class', async () => {
    const db = new FakeDatabase();

    const response = await handleResultRoutes(
      makeRequest(),
      { DB: db } as any,
      '/api/results',
      'POST',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload).toEqual(expect.objectContaining({ status: 'success', resultId: 91 }));
    expect(db.executed.some((statement) => (
      statement.sql.includes('WHERE a.id = ?')
      && statement.bindings[0] === 'assignment-current-3-attempts'
    ))).toBe(true);

    const attemptCount = db.executed.find(statement => statement.sql.includes('COUNT(*) as cnt'));
    expect(attemptCount?.sql).toContain('assignment_id = ?');
    expect(attemptCount?.sql).toContain('student_id = ?');
    expect(attemptCount?.bindings).toContain('assignment-current-3-attempts');
    expect(attemptCount?.bindings).toContain('student-1');

    const insert = db.executed.find(statement => statement.sql.includes('INSERT INTO results'));
    expect(insert?.sql).toContain('assignment_id');
    expect(insert?.bindings).toContain('assignment-current-3-attempts');
  });

  it('falls back to the newest applicable open assignment for older clients', async () => {
    const db = new FakeDatabase();
    const { assignmentId: _assignmentId, ...legacyBody } = requestBody;

    const response = await handleResultRoutes(
      makeRequest(legacyBody),
      { DB: db } as any,
      '/api/results',
      'POST',
    );

    expect(response.status).toBe(200);
    const fallbackQuery = db.executed.find((statement) => (
      statement.sql.includes("UPPER(COALESCE(a.status, 'OPEN')) = 'OPEN'")
    ));
    expect(fallbackQuery?.sql).toContain('datetime(a.created_at) DESC');
    expect(fallbackQuery?.sql).toContain("COALESCE(a.student_id, '') = '' OR a.student_id = ?");
  });

  it('rejects an assignment id that does not belong to the submitted quiz', async () => {
    const db = new FakeDatabase();
    db.first = (sql: string, bindings: unknown[]) => {
      if (sql.includes('FROM students') && sql.includes('WHERE students.username = ?')) {
        return {
          id: 'student-1', username: 'student-1', full_name: 'Nguyen Van A',
          class_id: 'class-4a9', class_name: '4A9',
        };
      }
      if (sql.includes('FROM assignments') && sql.includes('WHERE a.id = ?')) {
        return {
          id: bindings[0], quiz_id: 'different-quiz', class_id: 'class-4a9',
          class_name: '4A9', student_id: '', max_attempts: 3,
          status: 'OPEN', deadline: '2099-01-01T00:00:00.000Z',
        };
      }
      return null;
    };

    const response = await handleResultRoutes(
      makeRequest(),
      { DB: db } as any,
      '/api/results',
      'POST',
    );

    expect(response.status).toBe(403);
  });
});

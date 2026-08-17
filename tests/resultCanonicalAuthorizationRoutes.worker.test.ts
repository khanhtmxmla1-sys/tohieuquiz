// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({ user: currentUser })),
  requireAdmin: vi.fn((user: JWTPayload) => user.role === 'admin'),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
  isStudent: vi.fn((user: JWTPayload) => user.role === 'student'),
}));
vi.mock('../workers/src/routes/interventions', () => ({
  handleInterventionRoutes: vi.fn(async () => null),
}));

import { handleResultRoutes } from '../workers/src/routes/results';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, private readonly db: FakeDatabase) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { this.db.executed.push(this); return this.db.first(this.sql, this.bindings) as T; }
  async all<T>() { this.db.executed.push(this); return { results: this.db.all(this.sql, this.bindings) as T[] }; }
  async run() { this.db.executed.push(this); return { success: true, meta: { changes: 1 } }; }
}

class FakeDatabase {
  executed: Statement[] = [];
  prepare(sql: string) { return new Statement(sql, this); }
  first(sql: string, bindings: unknown[]) {
    if (sql.includes('SELECT COUNT(*) as total FROM results')) return { total: 1 };
    if (sql.includes('FROM students') && sql.includes('WHERE username = ?')) {
      return { id: 'student-a', class_id: 'class-a' };
    }
    if (sql.includes('FROM results') && sql.includes('WHERE id = ?')) {
      if (bindings[0] === 'result-a') {
        return {
          id: 'result-a', student_id: 'student-a', class_id: 'class-a', assignment_id: 'assignment-a',
          student_name: 'An', class_name: '4A', quiz_id: 'quiz-1', quiz_title: 'Quiz',
          score: 8, correct_count: 8, total_questions: 10, time_taken: 300,
          submitted_at: '2026-08-01T00:00:00Z', grading_version: '2.0.0',
          answers: JSON.stringify({ q1: { selectedAnswer: 'A', isCorrect: true } }),
        };
      }
      return {
        id: 'legacy-unresolved', student_id: null, class_id: null, assignment_id: null,
        student_name: 'An', class_name: '4A', quiz_id: 'quiz-1', answers: '{}',
        submitted_at: '2026-08-01T00:00:00Z',
      };
    }
    return null;
  }
  all(sql: string, _bindings: unknown[]) {
    if (sql.includes('SELECT id') && sql.includes('FROM classes') && sql.includes('teacher_username')) {
      return [{ id: 'class-a' }];
    }
    if (sql.includes('ORDER BY submitted_at DESC')) {
      return [{
        id: 'result-a', student_id: 'student-a', class_id: 'class-a', assignment_id: 'assignment-a',
        student_name: 'An', class_name: '4A', quiz_id: 'quiz-1', quiz_title: 'Quiz',
        score: 0, correct_count: 0, total_questions: 0, time_taken: 0,
        submitted_at: '2026-08-01T00:00:00Z', grading_version: '2.0.0',
      }];
    }
    if (sql.includes('SELECT id, answers FROM results')) {
      return [{ id: 'result-a', answers: '{}' }];
    }
    return [];
  }
}

const getResults = (db: FakeDatabase) => handleResultRoutes(
  new Request('https://example.test/api/results?limit=20'),
  { DB: db } as any,
  '/api/results',
  'GET',
);

describe('canonical result route authorization', () => {
  beforeEach(() => {
    currentUser = { username: 'teacher-a', role: 'teacher' } as JWTPayload;
  });

  it('scopes teacher lists by class_id and returns canonical metadata including zero values', async () => {
    const db = new FakeDatabase();
    const response = await getResults(db);
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    const dataQuery = db.executed.find((statement) => statement.sql.includes('ORDER BY submitted_at DESC'));
    expect(dataQuery?.sql).toContain('class_id IN (?)');
    expect(dataQuery?.sql).not.toMatch(/class_name\s+IN/i);
    expect(dataQuery?.bindings).toContain('class-a');
    expect(payload.data[0]).toMatchObject({
      id: 'result-a',
      classId: 'class-a',
      studentId: 'student-a',
      assignmentId: 'assignment-a',
      gradingVersion: '2.0.0',
      Score: 0,
      correctCount: 0,
      'Total Questions': 0,
    });
  });

  it('scopes student lists only by authenticated student_id', async () => {
    currentUser = { username: 'student-a', role: 'student' } as JWTPayload;
    const db = new FakeDatabase();
    const response = await getResults(db);

    expect(response.status).toBe(200);
    const dataQuery = db.executed.find((statement) => statement.sql.includes('ORDER BY submitted_at DESC'));
    expect(dataQuery?.sql).toContain('student_id = ?');
    expect(dataQuery?.sql.split(' WHERE ')[1]).not.toMatch(/student_name|class_name/i);
    expect(dataQuery?.bindings).toContain('student-a');
  });

  it('scopes teacher bulk answer fetches by canonical class_id', async () => {
    const db = new FakeDatabase();
    const response = await handleResultRoutes(
      new Request('https://example.test/api/results/answers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultIds: ['result-a'] }),
      }),
      { DB: db } as any,
      '/api/results/answers/bulk',
      'POST',
    );

    expect(response.status).toBe(200);
    const query = db.executed.find((statement) => statement.sql.includes('SELECT id, answers FROM results'));
    expect(query?.sql).toContain('class_id IN (?)');
    expect(query?.sql).not.toMatch(/class_name/i);
  });

  it('returns canonical metadata with stored answers for an authorized result detail', async () => {
    const db = new FakeDatabase();
    const response = await handleResultRoutes(
      new Request('https://example.test/api/results/result-a/answers'),
      { DB: db } as any,
      '/api/results/result-a/answers',
      'GET',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.result).toMatchObject({
      id: 'result-a',
      studentId: 'student-a',
      classId: 'class-a',
      assignmentId: 'assignment-a',
      studentName: 'An',
      studentClass: '4A',
      quizId: 'quiz-1',
      quizTitle: 'Quiz',
      score: 8,
      correctCount: 8,
      totalQuestions: 10,
      timeTaken: 300,
      gradingVersion: '2.0.0',
    });
    expect(payload.result.answers).toEqual({ q1: { selectedAnswer: 'A', isCorrect: true } });
  });

  it('denies unresolved detail records to teachers', async () => {
    const db = new FakeDatabase();
    const response = await handleResultRoutes(
      new Request('https://example.test/api/results/legacy-unresolved/answers'),
      { DB: db } as any,
      '/api/results/legacy-unresolved/answers',
      'GET',
    );
    expect(response.status).toBe(403);
  });

  it('allows admin to access unresolved detail records', async () => {
    currentUser = { username: 'admin', role: 'admin' } as JWTPayload;
    const db = new FakeDatabase();
    const response = await handleResultRoutes(
      new Request('https://example.test/api/results/legacy-unresolved/answers'),
      { DB: db } as any,
      '/api/results/legacy-unresolved/answers',
      'GET',
    );
    expect(response.status).toBe(200);
  });
});

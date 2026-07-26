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

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  async first<T>() {
    this.db.executed.push(this);
    return this.db.first(this.sql, this.bindings) as T;
  }

  async all<T>() {
    this.db.executed.push(this);
    return { results: this.db.all(this.sql, this.bindings) as T[] };
  }

  async run() {
    this.db.executed.push(this);
    return { success: true, meta: { changes: 1, last_row_id: 321 } };
  }
}

class FakeDatabase {
  executed: Statement[] = [];
  matchingStudents: Array<{ id: string }> = [{ id: 'student-canonical' }];

  prepare(sql: string) {
    return new Statement(sql, this);
  }

  first(sql: string, _bindings: unknown[]) {
    if (sql.includes('SELECT id FROM classes WHERE name = ? AND teacher_username = ?')) {
      return { id: 'class-4a9' };
    }
    return null;
  }

  all(sql: string, _bindings: unknown[]) {
    if (sql.includes('FROM students s') && sql.includes('JOIN classes c')) {
      return this.matchingStudents;
    }
    return [];
  }
}

const makeRequest = () => new Request('https://example.test/api/results', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quizId: 'quiz-1',
    quizTitle: 'Phép nhân',
    studentName: ' Nguyễn Văn An ',
    className: '4A9',
    score: 8,
    correctCount: 8,
    totalQuestions: 10,
    timeTaken: 300,
    answers: {},
  }),
});

const insertedResult = (db: FakeDatabase) => db.executed.find((statement) => (
  statement.sql.includes('INSERT INTO results')
));

describe('canonical student id on result writes', () => {
  beforeEach(() => {
    currentUser = {
      username: 'teacher-a',
      role: 'teacher',
      fullName: 'Cô A',
    } as JWTPayload;
  });

  it('writes the unique active student id for a teacher submission', async () => {
    const db = new FakeDatabase();

    const response = await handleResultRoutes(
      makeRequest(),
      { DB: db } as any,
      '/api/results',
      'POST',
    );

    expect(response.status).toBe(200);
    const insert = insertedResult(db);
    expect(insert?.sql).toContain('student_id');
    expect(insert?.bindings[0]).toBe('student-canonical');
    expect(insert?.bindings[1]).toBeNull();
    expect(insert?.bindings[2]).toBe(' Nguyễn Văn An ');
  });

  it('stores null instead of guessing when multiple active students match', async () => {
    const db = new FakeDatabase();
    db.matchingStudents = [{ id: 'student-1' }, { id: 'student-2' }];

    const response = await handleResultRoutes(
      makeRequest(),
      { DB: db } as any,
      '/api/results',
      'POST',
    );

    expect(response.status).toBe(200);
    expect(insertedResult(db)?.bindings[0]).toBeNull();
  });
});

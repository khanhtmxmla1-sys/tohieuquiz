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
  async all<T>() {
    this.db.executed.push(this);
    const results = this.sql.includes('FROM questions') ? [{
      id: 'q1', type: 'MCQ', question: '2 + 2?', options: '3|4', correct_answer: 'B',
      items: '', text_field: '', blanks: '', distractors: '', sentence: '', words: '',
      correct_word_indexes: '', image: '', difficulty: 1, answer_schema_version: 1,
    }] : [];
    return { results: results as T[] };
  }
  async run() {
    this.db.executed.push(this);
    return this.db.run(this.sql, this.bindings);
  }
}

class FakeDatabase {
  executed: Statement[] = [];
  batches: Statement[][] = [];
  insertChanges: unknown[] = [];
  insertResultOverrides: Array<Record<string, unknown>> = [];
  insertSuccess = true;
  nextResultId = 91;
  prepare(sql: string) { return new Statement(sql, this); }

  async run(sql: string, _bindings: unknown[] = []) {
    if (sql.includes('INSERT INTO results')) {
      const override = this.insertResultOverrides.shift();
      if (override) return override;
      return {
        success: this.insertSuccess,
        meta: { changes: this.insertChanges.shift() ?? 1, last_row_id: this.nextResultId++ },
      };
    }
    return { success: true, meta: { changes: 1, last_row_id: 0 } };
  }
  async batch(statements: Statement[]) {
    this.batches.push(statements);
    return statements.map(() => ({ success: true, results: [], meta: { changes: 1 } }));
  }
  first(sql: string, bindings: unknown[]) {
    if (sql.includes('SELECT id, class_id FROM students')) {
      return { id: 'student-1', class_id: 'class-4a9' };
    }
    if (sql.includes('FROM students') && sql.includes('WHERE students.username = ?')) {
      return {
        id: 'student-1', username: 'student-1', full_name: 'Nguyen Van A',
        class_id: 'class-4a9', class_name: '4A9',
      };
    }
    if (sql.includes('FROM classes') && sql.includes('WHERE id = ?')) {
      return { id: 'class-4a9', name: '4A9', teacher_username: 'teacher-a' };
    }
    if (sql.includes('FROM assignments') && sql.includes('WHERE a.id = ?')) {
      return {
        id: bindings[0], quiz_id: 'quiz-week-30', class_id: 'class-4a9',
        class_name: '4A9', student_id: '', max_attempts: 3,
        status: 'OPEN', deadline: '2099-01-01T00:00:00.000Z',
      };
    }
    if (sql.includes('FROM assignments') && sql.includes('WHERE id = ?')) {
      return {
        id: bindings[0], quiz_id: 'quiz-week-30', class_id: 'class-4a9',
        student_id: '', status: 'OPEN', deadline: '2099-01-01T00:00:00.000Z',
      };
    }
    if (sql.includes('show_on_home') && sql.includes('require_code') && sql.includes('FROM quizzes')) {
      return {
        id: bindings[0], revision: 1, show_on_home: 'FALSE', require_code: 'FALSE',
        access_code: '', time_limit: 15,
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

const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
};

class ForcedRaceDatabase extends FakeDatabase {
  private insertCalls = 0;
  private countReads = 0;
  private readonly firstInsertReached = deferred();
  private readonly secondInsertReached = deferred();

  first(sql: string, bindings: unknown[]) {
    if (sql.includes('COUNT(*) as cnt')) {
      this.countReads += 1;
      return { cnt: this.countReads <= 2 ? 0 : 1 };
    }
    if (sql.includes('FROM assignments') && sql.includes('WHERE a.id = ?')) {
      return { ...super.first(sql, bindings) as Record<string, unknown>, max_attempts: 1 };
    }
    return super.first(sql, bindings);
  }

  async run(sql: string, bindings: unknown[]) {
    if (sql.includes('INSERT INTO results')) {
      this.insertCalls += 1;
      if (this.insertCalls === 1) {
        this.firstInsertReached.resolve();
        await this.secondInsertReached.promise;
      } else if (this.insertCalls === 2) {
        this.secondInsertReached.resolve();
      }
    }
    return super.run(sql, bindings);
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
    expect(payload).toEqual(expect.objectContaining({
      status: 'success', resultId: 91, assignmentId: 'assignment-current-3-attempts',
    }));
    expect(db.executed.some((statement) => (
      statement.sql.includes('WHERE a.id = ?')
      && statement.bindings[0] === 'assignment-current-3-attempts'
    ))).toBe(true);
    expect(db.executed.some((statement) => statement.sql.includes('SELECT revision FROM quizzes'))).toBe(false);

    const attemptCount = db.executed.find(statement => statement.sql.includes('COUNT(*) as cnt'));
    expect(attemptCount?.sql).toContain('assignment_id = ?');
    expect(attemptCount?.sql).toContain('student_id = ?');
    expect(attemptCount?.bindings).toContain('assignment-current-3-attempts');
    expect(attemptCount?.bindings).toContain('student-1');

    const insert = db.executed.find(statement => statement.sql.includes('INSERT INTO results'));
    expect(insert?.sql).toContain('assignment_id');
    expect(insert?.bindings).toContain('assignment-current-3-attempts');
  });

  it('denies a student submission that omits the exact assignment id', async () => {
    const db = new FakeDatabase();
    const { assignmentId: _assignmentId, ...legacyBody } = requestBody;

    const response = await handleResultRoutes(
      makeRequest(legacyBody),
      { DB: db } as any,
      '/api/results',
      'POST',
    );

    expect(response.status).toBe(403);
    expect(db.executed.some((statement) => (
      statement.sql.includes("UPPER(COALESCE(a.status, 'OPEN')) = 'OPEN'")
    ))).toBe(false);
    expect(db.executed.some((statement) => statement.sql.includes('INSERT INTO results'))).toBe(false);
  });

  it('rejects a stale result submission for a revoked assignment', async () => {
    const db = new FakeDatabase();
    const originalFirst = db.first.bind(db);
    db.first = (sql: string, bindings: unknown[]) => {
      const result = originalFirst(sql, bindings) as any;
      if (sql.includes('FROM assignments') && sql.includes('WHERE a.id = ?') && result) {
        return { ...result, status: 'REVOKED' };
      }
      return result;
    };

    const response = await handleResultRoutes(
      makeRequest(),
      { DB: db } as any,
      '/api/results',
      'POST',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(409);
    expect(payload.code).toBe('ASSIGNMENT_REVOKED');
    expect(db.executed.some(statement => statement.sql.includes('INSERT INTO results'))).toBe(false);
  });

  it('returns a business conflict instead of a permission error when attempts are exhausted', async () => {
    const db = new FakeDatabase();
    const originalFirst = db.first.bind(db);
    db.first = (sql: string, bindings: unknown[]) => {
      if (sql.includes('COUNT(*) as cnt')) return { cnt: 3 };
      return originalFirst(sql, bindings);
    };

    const response = await handleResultRoutes(
      makeRequest(),
      { DB: db } as any,
      '/api/results',
      'POST',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      status: 'error',
      code: 'ASSIGNMENT_ATTEMPTS_EXHAUSTED',
      message: 'Em đã hết lượt làm bài này (3/3).',
      attemptCount: 3,
      maxAttempts: 3,
    });
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
      if (sql.includes('FROM classes') && sql.includes('WHERE id = ?')) {
        return { id: 'class-4a9', name: '4A9', teacher_username: 'teacher-a' };
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

  it('rejects the competing submission when the atomic result write reports no changed row', async () => {
    const db = new ForcedRaceDatabase();
    db.insertChanges = [1, 0];

    const responses = await Promise.all([
      handleResultRoutes(makeRequest(), { DB: db } as any, '/api/results', 'POST'),
      handleResultRoutes(makeRequest(), { DB: db } as any, '/api/results', 'POST'),
    ]);
    const payloads = await Promise.all(responses.map((response) => response.json() as Promise<any>));

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(payloads.find((payload) => payload.code === 'ASSIGNMENT_ATTEMPTS_EXHAUSTED')).toMatchObject({
      attemptCount: 1,
      maxAttempts: 1,
    });
    expect(db.executed.filter((statement) => statement.sql.includes('INSERT OR IGNORE INTO parent_notifications'))).toHaveLength(1);
    expect(db.batches).toHaveLength(1);
    expect(db.batches[0]?.[0]?.bindings[0]).toBe('91');
  });

  it.each([
    ['success false', { success: false, meta: { changes: 1, last_row_id: 91 } }],
    ['missing changes', { success: true, meta: { last_row_id: 91 } }],
    ['null changes', { success: true, meta: { changes: null, last_row_id: 91 } }],
    ['string changes', { success: true, meta: { changes: '1', last_row_id: 91 } }],
    ['NaN changes', { success: true, meta: { changes: Number.NaN, last_row_id: 91 } }],
  ])('propagates an assignment insert failure for %s instead of returning a quota response', async (_case, insertResult) => {
    const db = new FakeDatabase();
    db.insertResultOverrides = [insertResult];

    await expect(handleResultRoutes(
      makeRequest(),
      { DB: db } as any,
      '/api/results',
      'POST',
    )).rejects.toThrow('ASSIGNMENT_RESULT_INSERT_FAILED');

    expect(db.executed.filter((statement) => statement.sql.includes('INSERT OR IGNORE INTO parent_notifications'))).toHaveLength(0);
  });
});

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
  classes = [{ id: 'class-4a9', name: '4A9', teacher_username: 'teacher-a' }];

  prepare(sql: string) {
    return new Statement(sql, this);
  }

  first(sql: string, bindings: unknown[]) {
    if (sql.includes('FROM classes') && sql.includes('WHERE id = ?')) {
      return this.classes.find((row) => row.id === bindings[0]) || null;
    }
    return null;
  }

  all(sql: string, bindings: unknown[]) {
    if (sql.includes('FROM classes') && sql.includes('LOWER(TRIM(name))')) {
      const normalized = String(bindings[0] || '').trim().toLowerCase();
      return this.classes.filter((row) => row.name.trim().toLowerCase() === normalized);
    }
    if (sql.includes('FROM students s') && sql.includes('s.class_id = ?')) {
      return this.matchingStudents;
    }
    if (sql.includes('FROM questions')) {
      return [{
        id: 'q1', type: 'MCQ', question: '2 + 2?', options: '4|5', correct_answer: 'A',
        items: '', text_field: '', blanks: '', distractors: '', sentence: '', words: '',
        correct_word_indexes: '', image: '', difficulty: 1, answer_schema_version: 1,
      }];
    }
    return [];
  }
}

const makeRequest = (overrides: Record<string, unknown> = {}) => new Request('https://example.test/api/results', {
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
    ...overrides,
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
    const payload = await response.json() as any;
    expect(payload.reviewDetails).toEqual([expect.objectContaining({
      questionId: 'q1',
      status: 'skipped',
      studentAnswer: { kind: 'empty', lines: [{ value: 'Chưa trả lời' }] },
      correctAnswer: { kind: 'text', lines: [{ value: '4' }] },
    })]);
    const insert = insertedResult(db);
    expect(insert?.sql).toContain('student_id');
    expect(insert?.bindings[0]).toBe('student-canonical');
    expect(insert?.bindings[1]).toBeNull();
    expect(insert?.bindings[2]).toBe('class-4a9');
    expect(insert?.bindings[3]).toBe(' Nguyễn Văn An ');
    expect(payload.classId).toBe('class-4a9');
  });

  it('rejects a forged classId outside the teacher scope', async () => {
    const db = new FakeDatabase();
    db.classes.push({ id: 'class-other', name: '4A9', teacher_username: 'teacher-b' });

    const response = await handleResultRoutes(
      makeRequest({ classId: 'class-other' }),
      { DB: db } as any,
      '/api/results',
      'POST',
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'RESULT_CLASS_FORBIDDEN' });
    expect(insertedResult(db)).toBeUndefined();
  });

  it('rejects a classId and className mismatch', async () => {
    const db = new FakeDatabase();

    const response = await handleResultRoutes(
      makeRequest({ classId: 'class-4a9', className: '5A' }),
      { DB: db } as any,
      '/api/results',
      'POST',
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'RESULT_CLASS_AMBIGUOUS' });
    expect(insertedResult(db)).toBeUndefined();
  });

  it('rejects a legacy className when multiple owned classes have the same name', async () => {
    const db = new FakeDatabase();
    db.classes.push({ id: 'class-duplicate', name: '4A9', teacher_username: 'teacher-a' });

    const response = await handleResultRoutes(
      makeRequest(),
      { DB: db } as any,
      '/api/results',
      'POST',
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'RESULT_CLASS_AMBIGUOUS' });
    expect(insertedResult(db)).toBeUndefined();
  });

  it('rejects ambiguous student identity instead of creating a newly unresolved result', async () => {
    const db = new FakeDatabase();
    db.matchingStudents = [{ id: 'student-1' }, { id: 'student-2' }];

    const response = await handleResultRoutes(
      makeRequest(),
      { DB: db } as any,
      '/api/results',
      'POST',
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'RESULT_STUDENT_AMBIGUOUS' });
    expect(insertedResult(db)).toBeUndefined();
  });
});

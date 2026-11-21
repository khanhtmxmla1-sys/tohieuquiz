import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';
import {
  deriveStudentQuizDtoKey,
  deriveStudentQuizDtoScope,
  toStudentQuestionDto,
} from '../workers/src/services/studentQuizQuestionDto';
const verifyQuizAccessGrantMock = vi.hoisted(() => vi.fn());
vi.mock('../workers/src/services/quizAccessGrant', async () => {
  const actual = await vi.importActual<typeof import('../workers/src/services/quizAccessGrant')>(
    '../workers/src/services/quizAccessGrant',
  );
  return { ...actual, verifyQuizAccessGrant: verifyQuizAccessGrantMock };
});

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
  constructor(readonly sql: string, readonly db: Database) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { this.db.executed.push(this); return this.db.first(this.sql) as T; }
  async all<T>() { this.db.executed.push(this); return { results: this.db.all(this.sql) as T[] }; }
  async run() { this.db.executed.push(this); return { success: true, meta: { changes: 1, last_row_id: 777 } }; }
}

class Database {
  executed: Statement[] = [];
  prepare(sql: string) { return new Statement(sql, this); }
  first(sql: string) {
    if (sql.includes('SELECT id FROM classes WHERE name = ? AND teacher_username = ?')) return { id: 'class-a' };
    return null;
  }
  all(sql: string) {
    if (sql.includes('FROM classes') && sql.includes('LOWER(TRIM(name))')) return [{ id: 'class-a', name: '4A', teacher_username: 'teacher-a' }];
    if (sql.includes('FROM students s')) return [{ id: 'student-a' }];
    if (sql.includes('FROM questions')) return [{
      id: 'q1', type: 'MCQ', question: '2 + 2?', options: '4|5', correct_answer: 'A',
      items: '', text_field: '', blanks: '', distractors: '', sentence: '', words: '',
      correct_word_indexes: '', image: '', difficulty: 1, answer_schema_version: 1,
    }];
    return [];
  }
}

class StudentStatement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, readonly db: StudentDatabase) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { return this.db.first(this.sql, this.bindings) as T; }
  async all<T>() { return { results: this.db.all(this.sql, this.bindings) as T[] }; }
  async run() {
    if (this.sql.includes('INSERT INTO results')) this.db.insertCount += 1;
    return { success: true, meta: { changes: 1, last_row_id: 778 } };
  }
}

class StudentDatabase {
  requireCode = false;
  publicPractice = true;
  protectedWorkflow = false;
  gradingQueryCount = 0;
  insertCount = 0;
  assignmentId: string | null = null;
  prepare(sql: string) { return new StudentStatement(sql, this); }
  first(sql: string, bindings: unknown[] = []) {
    if (sql.includes('FROM assignments a') && this.assignmentId && bindings[0] === this.assignmentId) {
      return {
        id: this.assignmentId,
        quiz_id: 'quiz-a',
        class_id: 'class-a',
        student_id: 'student-a',
        max_attempts: 3,
        status: 'OPEN',
        deadline: '',
        class_name: '4A',
      };
    }
    if (sql.includes('FROM students')) {
      return { id: 'student-a', username: 'student-a', full_name: 'An', class_id: 'class-a', class_name: '4A' };
    }
    if (sql.includes('FROM classes') && sql.includes('WHERE id = ?')) {
      return { id: 'class-a', name: '4A', teacher_username: 'teacher-a' };
    }
    if (sql.includes('SELECT revision FROM quizzes')) return { revision: 7 };
    if (sql.includes('show_on_home') && sql.includes('require_code') && sql.includes('FROM quizzes')) {
      return { id: 'quiz-a', revision: 7, require_code: this.requireCode ? 'TRUE' : 'FALSE', access_code: 'CODE', show_on_home: 'TRUE', time_limit: 15 };
    }
    if (sql.includes('AS protected_workflow')) return this.protectedWorkflow ? { '1': 1 } : null;
    if (sql.includes('protected_practice_quizzes')) {
      return this.publicPractice && !this.protectedWorkflow ? { '1': 1 } : null;
    }
    if (sql.includes('SELECT 1') && sql.includes('public_quiz.id')) return this.publicPractice ? { '1': 1 } : null;
    if (sql.includes('SELECT category FROM quizzes')) return { category: 'math' };
    return null;
  }
  all(sql: string) {
    if (!sql.includes('FROM questions')) return [];
    this.gradingQueryCount += 1;
    return [
      {
        id: 'match', type: 'MATCHING', question: 'Nối', options: '', correct_answer: '',
        items: JSON.stringify([{ left: 'A', right: '1' }, { left: 'B', right: '2' }]),
        text_field: '', blanks: '', distractors: '', sentence: '', words: '',
        correct_word_indexes: '', image: '', difficulty: 1, answer_schema_version: 1,
      },
      {
        id: 'drag', type: 'DRAG_DROP', question: 'Điền', options: '', correct_answer: '',
        items: '', text_field: 'Chọn [1]',
        blanks: JSON.stringify([{ id: 'drag-a', correctAnswer: 'X' }]),
        distractors: JSON.stringify(['Y']), sentence: '', words: '',
        correct_word_indexes: '', image: '', difficulty: 1, answer_schema_version: 1,
      },
    ];
  }
}

describe('POST /api/results authoritative scoring', () => {
  beforeEach(() => {
    verifyQuizAccessGrantMock.mockReset();
    currentUser = { username: 'teacher-a', role: 'teacher', fullName: 'Cô A' } as JWTPayload;
  });

  it('ignores client score and correctness metadata', async () => {
    const db = new Database();
    const response = await handleResultRoutes(new Request('https://test/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: 'quiz-a', quizTitle: 'Toán', studentName: 'An', className: '4A',
        score: 10, correctCount: 99, totalQuestions: 99, timeTaken: 10,
        answers: { q1: { selectedAnswer: 'B', isCorrect: true, questionSnapshot: { correctAnswer: 'B' } } },
      }),
    }), { DB: db } as any, '/api/results', 'POST');

    const payload = await response.json() as any;
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: 'success', resultId: 777, score: 0, correctCount: 0, totalQuestions: 1,
      gradingVersion: '2.0.0',
    });
    expect(payload.answers.q1).toMatchObject({ selectedAnswer: 'B', isCorrect: false, gradingVersion: '2.0.0' });
    expect(JSON.stringify(payload.answers.q1)).not.toContain('correctAnswer');
    expect(payload.answers._reviewDetails).toMatchObject({
      schemaVersion: 1,
      source: 'submission',
      details: [expect.objectContaining({
        questionId: 'q1',
        presentation: expect.objectContaining({
          schemaVersion: 1,
          source: 'submission',
          type: 'MCQ',
        }),
      })],
    });
    expect(payload.reviewDetails[0].presentation.source).toBe('submission');

    const insert = db.executed.find((statement) => statement.sql.includes('INSERT INTO results'));
    expect(insert?.sql).toContain('grading_version');
    expect(insert?.bindings[2]).toBe('class-a');
    expect(insert?.bindings[7]).toBe(0);
    expect(insert?.bindings[8]).toBe(0);
    expect(insert?.bindings[9]).toBe(1);
    expect(insert?.bindings[10]).toBe(10);
    expect(insert?.bindings[13]).toBe('2.0.0');
    expect(insert?.bindings).not.toContain(99);
  });

  it('decodes opaque student answers and persists canonical IDs in the result', async () => {
    currentUser = { id: 'student-a', username: 'student-a', role: 'student', fullName: 'An' } as JWTPayload;
    const db = new StudentDatabase();
    const context = {
      quizId: 'quiz-a',
      revision: 7,
      scope: deriveStudentQuizDtoScope({ quizId: 'quiz-a', actor: currentUser }),
      key: await deriveStudentQuizDtoKey('test-secret'),
    };
    const dto = await toStudentQuestionDto({
      id: 'match',
      type: 'MATCHING',
      question: 'Nối',
      items: JSON.stringify([{ left: 'A', right: '1' }, { left: 'B', right: '2' }]),
    }, context);
    const dragDto = await toStudentQuestionDto({
      id: 'drag', type: 'DRAG_DROP', question: 'Điền', text: 'Chọn [1]',
      blanks: [{ id: 'drag-a', correctAnswer: 'X' }], distractors: ['Y'],
    }, context);
    const leftItems = dto.leftItems as Array<{ id: string; content: string }>;
    const rightItems = dto.rightItems as Array<{ id: string; content: string }>;
    const opaquePairs = Object.fromEntries(leftItems.map((left) => [
      left.id,
      rightItems.find((right) => right.content === (left.content === 'A' ? '1' : '2'))?.id,
    ]));
    const dragBlankId = (dragDto.blanks as Array<{ id: string }>)[0].id;

    const response = await handleResultRoutes(new Request('https://test/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: 'quiz-a', quizTitle: 'Nối', className: '4A', timeTaken: 10,
        answers: {
          _questionOrder: ['match', 'drag'],
          match: {
            selectedAnswer: { type: 'MATCHING', pairs: opaquePairs },
            isCorrect: false,
            status: 'wrong',
            gradingVersion: 'client-forged',
            questionSnapshot: { correctAnswer: 'client-forged' },
          },
          drag: {
            selectedAnswer: { type: 'DRAG_DROP', values: { [dragBlankId]: 'X' } },
            isCorrect: false,
            status: 'wrong',
            questionSnapshot: { correctAnswer: 'client-forged' },
          },
        },
      }),
    }), { DB: db, JWT_SECRET: 'test-secret' } as any, '/api/results', 'POST');

    const payload = await response.json() as any;
    expect(response.status).toBe(200);
    expect(payload.score).toBe(10);
    expect(payload.answers.match.selectedAnswer).toEqual({
      type: 'MATCHING',
      pairs: { 'left-0': 'right-0', 'left-1': 'right-1' },
    });
    expect(payload.answers.drag.selectedAnswer).toEqual({
      type: 'DRAG_DROP',
      values: { 'drag-a': 'X' },
    });
    expect(JSON.stringify(payload.answers)).not.toContain('sq1_');

    const legacyResponse = await handleResultRoutes(new Request('https://test/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: 'quiz-a', quizTitle: 'Nối', className: '4A', timeTaken: 10,
        // Existing player submissions are direct ID maps, not a client-selected contract.
        answers: {
          match: { 'left-0': 'right-0', 'left-1': 'right-1' },
          drag: { 'drag-a': 'X' },
        },
      }),
    }), { DB: db, JWT_SECRET: 'test-secret' } as any, '/api/results', 'POST');
    const legacyPayload = await legacyResponse.json() as any;
    expect(legacyResponse.status).toBe(200);
    expect(legacyPayload.score).toBe(10);
    expect(legacyPayload.answers.match.selectedAnswer).toEqual({ 'left-0': 'right-0', 'left-1': 'right-1' });
    expect(legacyPayload.answers.drag.selectedAnswer).toEqual({ 'drag-a': 'X' });
  });

  it('rejects a code-protected student submission without an access grant', async () => {
    currentUser = { id: 'student-a', username: 'student-a', role: 'student', fullName: 'An' } as JWTPayload;
    const db = new StudentDatabase();
    db.requireCode = true;
    const response = await handleResultRoutes(new Request('https://test/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: 'quiz-a', quizTitle: 'Nối', className: '4A', timeTaken: 10,
        answers: { match: { selectedAnswer: {} } },
      }),
    }), { DB: db, JWT_SECRET: 'test-secret' } as any, '/api/results', 'POST');

    expect(response.status).toBe(403);
    expect((await response.json()) as any).toMatchObject({ message: 'Forbidden: Quiz access required' });
  });

  it('accepts a code-protected student submission with a matching in-memory grant', async () => {
    currentUser = { id: 'student-a', username: 'student-a', role: 'student', fullName: 'An' } as JWTPayload;
    const db = new StudentDatabase();
    db.requireCode = true;
    verifyQuizAccessGrantMock.mockResolvedValue({
      quizId: 'quiz-a', revision: 7, purpose: 'quiz_access_grant', sub: 'student-a',
    });
    const response = await handleResultRoutes(new Request('https://test/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: 'quiz-a', quizTitle: 'Nối', className: '4A', timeTaken: 10, accessGrant: 'valid-grant',
        answers: {
          match: { selectedAnswer: { type: 'MATCHING', pairs: { 'left-0': 'right-0', 'left-1': 'right-1' } } },
          drag: { selectedAnswer: { type: 'DRAG_DROP', values: { 'drag-a': 'X' } } },
        },
      }),
    }), { DB: db, JWT_SECRET: 'test-secret' } as any, '/api/results', 'POST');

    expect(response.status).toBe(200);
    expect((await response.json()) as any).toMatchObject({ status: 'success', score: 10 });
    expect(verifyQuizAccessGrantMock).toHaveBeenCalled();
    expect(verifyQuizAccessGrantMock.mock.calls[0][1]).toMatchObject({
      quizId: 'quiz-a', revision: 7, subject: 'student-a', accessCode: 'CODE',
    });
  });

  it('rejects a code-protected reused quiz with a grant when assignmentId is omitted', async () => {
    currentUser = { id: 'student-a', username: 'student-a', role: 'student', fullName: 'An' } as JWTPayload;
    const db = new StudentDatabase();
    db.requireCode = true;
    db.protectedWorkflow = true;
    verifyQuizAccessGrantMock.mockResolvedValue({
      quizId: 'quiz-a', revision: 7, purpose: 'quiz_access_grant', sub: 'student-a',
    });
    const response = await handleResultRoutes(new Request('https://test/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: 'quiz-a', quizTitle: 'Nối', className: '4A', timeTaken: 10, accessGrant: 'valid-grant',
        answers: { match: { selectedAnswer: {} } },
      }),
    }), { DB: db, JWT_SECRET: 'test-secret' } as any, '/api/results', 'POST');

    expect(response.status).toBe(403);
    expect(db.gradingQueryCount).toBe(0);
    expect(db.insertCount).toBe(0);
  });

  it('rejects a wrong or stale access grant before grading', async () => {
    currentUser = { id: 'student-a', username: 'student-a', role: 'student', fullName: 'An' } as JWTPayload;
    const db = new StudentDatabase();
    db.requireCode = true;
    verifyQuizAccessGrantMock.mockResolvedValue(null);
    const response = await handleResultRoutes(new Request('https://test/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: 'quiz-a', quizTitle: 'Nối', className: '4A', timeTaken: 10, accessGrant: 'stale-grant',
        answers: { match: { selectedAnswer: {} } },
      }),
    }), { DB: db, JWT_SECRET: 'test-secret' } as any, '/api/results', 'POST');

    expect(response.status).toBe(403);
    expect((await response.json()) as any).toMatchObject({ message: 'Forbidden: Quiz access required' });
  });

  it('rejects an unlocked public submission when the quiz belongs to a protected workflow', async () => {
    currentUser = { id: 'student-a', username: 'student-a', role: 'student', fullName: 'An' } as JWTPayload;
    const db = new StudentDatabase();
    db.publicPractice = false;
    const response = await handleResultRoutes(new Request('https://test/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: 'quiz-a', quizTitle: 'Nối', className: '4A', timeTaken: 10,
        answers: { match: { selectedAnswer: {} } },
      }),
    }), { DB: db, JWT_SECRET: 'test-secret' } as any, '/api/results', 'POST');

    expect(response.status).toBe(403);
    expect((await response.json()) as any).toMatchObject({ message: 'Forbidden: Quiz access required' });
  });

  it('binds a grant to the exact assignment scope before grading', async () => {
    currentUser = { id: 'student-a', username: 'student-a', role: 'student', fullName: 'An' } as JWTPayload;
    const db = new StudentDatabase();
    db.requireCode = true;
    db.assignmentId = 'assignment-a';
    verifyQuizAccessGrantMock.mockResolvedValue(null);
    const response = await handleResultRoutes(new Request('https://test/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: 'quiz-a', assignmentId: 'assignment-a', quizTitle: 'Nối', className: '4A',
        accessGrant: 'grant-for-another-assignment', answers: { match: { selectedAnswer: {} } },
      }),
    }), { DB: db, JWT_SECRET: 'test-secret' } as any, '/api/results', 'POST');

    expect(response.status).toBe(403);
    expect(verifyQuizAccessGrantMock.mock.calls[0][1]).toMatchObject({ assignmentId: 'assignment-a' });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';
import { handleValidateAnswers } from '../workers/src/utils/helpers';

let currentUser: JWTPayload | null = null;

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => currentUser
    ? { user: currentUser }
    : new Response(JSON.stringify({ status: 'error' }), { status: 401 })),
  requireAdmin: vi.fn((user: JWTPayload) => user.role === 'admin'),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
  isStudent: vi.fn((user: JWTPayload) => user.role === 'student'),
}));

import { handleResultRoutes } from '../workers/src/routes/results';

class Statement {
  constructor(private readonly rows: unknown[]) {}
  bind() { return this; }
  async first<T>() { return null as T | null; }
  async all<T>() { return { results: this.rows as T[] }; }
}

class Database {
  prepare(sql: string) {
    if (sql.includes('FROM questions')) {
      return new Statement([
        {
          id: 'q1', type: 'MCQ', question: '2 + 2?', options: '3|4', correct_answer: 'B',
          items: '', text_field: '', blanks: '', distractors: '', sentence: '', words: '',
          correct_word_indexes: '', image: '', difficulty: 1, answer_schema_version: 1,
        },
        {
          id: 'broken', type: 'SHORT_ANSWER', question: 'Điền', options: '', correct_answer: '',
          items: '', text_field: '', blanks: '', distractors: '', sentence: '', words: '',
          correct_word_indexes: '', image: '', difficulty: 1, answer_schema_version: 1,
        },
      ]);
    }
    return new Statement([]);
  }
}

class RouteStatement {
  bindings: unknown[] = [];

  constructor(readonly sql: string, readonly db: RouteDatabase) {}

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
}

class RouteDatabase {
  executed: RouteStatement[] = [];
  gradingQueryCount = 0;
  quizAOwner = 'teacher-a';
  teacherFullNameCount = 1;

  prepare(sql: string) {
    return new RouteStatement(sql, this);
  }

  first(sql: string, bindings: unknown[]) {
    if (sql.includes('FROM teachers t')) {
      return { username: 'teacher-a', full_name: 'Cô A', full_name_count: this.teacherFullNameCount };
    }
    if (sql.includes('SELECT created_by FROM quizzes')) {
      const quizId = String(bindings[0] || '');
      if (quizId === 'quiz-a') return { created_by: this.quizAOwner };
      if (quizId === 'quiz-b') return { created_by: 'teacher-b' };
      return null;
    }
    if (sql.includes('FROM feature_flags f')) return null;
    return null;
  }

  all(sql: string) {
    if (!sql.includes('FROM questions')) return [];
    this.gradingQueryCount += 1;
    return [{
      id: 'q1', type: 'MCQ', question: '2 + 2?', options: '3|4', correct_answer: 'B',
      items: '', text_field: '', blanks: '', distractors: '', sentence: '', words: '',
      correct_word_indexes: '', image: '', difficulty: 1, answer_schema_version: 1,
    }];
  }
}

const routeEnv = (db: RouteDatabase) => ({ DB: db, JWT_SECRET: 'test-secret' } as any);
const authRequest = (body: unknown) => new Request('https://test/api/validate', {
  method: 'POST',
  headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

beforeEach(() => {
  currentUser = null;
});

describe('quiz validation answer secrecy', () => {
  it('does not expose correct answers and reports voided questions without rejecting the submission', async () => {
    const response = await handleValidateAnswers(new Database() as any, {
      quizId: 'quiz-1',
      answers: {
        q1: { type: 'MCQ', optionId: 'option-0' },
        broken: 'mine',
      },
    }, {
      includeCorrectAnswers: false,
      subject: { role: 'student', username: 'student-1', classIds: [] },
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as any;
    expect(payload).toMatchObject({
      questionCount: 2,
      totalQuestions: 1,
      total: 1,
      voidedCount: 1,
    });
    expect(payload.details).toEqual([
      expect.objectContaining({
        questionId: 'q1',
        isCorrect: false,
        status: 'wrong',
      }),
      expect.objectContaining({
        questionId: 'broken',
        isCorrect: false,
        status: 'voided',
        issueCode: 'MISSING_CORRECT_ANSWER',
      }),
    ]);
    expect(payload.details[0]).not.toHaveProperty('correctAnswer');
    expect(payload.details[1]).not.toHaveProperty('correctAnswer');
    expect(payload).not.toHaveProperty('reviewDetails');
  });
});

describe('staff quiz validation ownership', () => {
  it('blocks a teacher from grading another teacher quiz before loading questions', async () => {
    currentUser = { username: 'teacher-a', role: 'teacher' };
    const db = new RouteDatabase();

    const response = await handleResultRoutes(
      authRequest({ quizId: 'quiz-b', answers: {} }),
      routeEnv(db), '/api/validate', 'POST',
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ message: 'Forbidden: Quiz access required' });
    expect(db.gradingQueryCount).toBe(0);
  });

  it('allows the owning teacher to preview answers with the existing review payload', async () => {
    currentUser = { username: 'teacher-a', role: 'teacher' };
    const db = new RouteDatabase();

    const response = await handleResultRoutes(
      authRequest({ quizId: 'quiz-a', answers: {} }),
      routeEnv(db), '/api/validate', 'POST',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.details[0].correctAnswer).toBe('B');
    expect(db.gradingQueryCount).toBe(1);
  });

  it('allows a uniquely matched legacy display-name owner to preview answers', async () => {
    currentUser = { username: 'teacher-a', role: 'teacher' };
    const db = new RouteDatabase();
    db.quizAOwner = 'Cô A';

    const response = await handleResultRoutes(
      authRequest({ quizId: 'quiz-a', answers: {} }),
      routeEnv(db), '/api/validate', 'POST',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.details[0].correctAnswer).toBe('B');
    expect(db.gradingQueryCount).toBe(1);
  });

  it('allows admin preview without requiring quiz ownership', async () => {
    currentUser = { username: 'admin', role: 'admin' };
    const db = new RouteDatabase();

    const response = await handleResultRoutes(
      authRequest({ quizId: 'quiz-b', answers: {} }),
      routeEnv(db), '/api/validate', 'POST',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.details[0].correctAnswer).toBe('B');
    expect(db.gradingQueryCount).toBe(1);
  });

  it('uses the same generic forbidden response for an unknown quiz', async () => {
    currentUser = { username: 'teacher-a', role: 'teacher' };
    const db = new RouteDatabase();

    const response = await handleResultRoutes(
      authRequest({ quizId: 'quiz-missing', answers: {} }),
      routeEnv(db), '/api/validate', 'POST',
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ message: 'Forbidden: Quiz access required' });
    expect(db.gradingQueryCount).toBe(0);
  });
});

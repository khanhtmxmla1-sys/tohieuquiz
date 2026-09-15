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

import { handleResultRoutes } from '../workers/src/routes/results';

type ResultRow = {
  id: string;
  student_id: string;
  class_id: string;
  assignment_id: string | null;
  student_name: string;
  class_name: string;
  quiz_id: string;
  quiz_title: string;
  score: number;
  correct_count: number;
  total_questions: number;
  time_taken: number;
  submitted_at: string;
  answers: string;
  grading_version: string;
};

class Statement {
  bindings: unknown[] = [];

  constructor(readonly sql: string, readonly db: ReviewDatabase) {}

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

class ReviewDatabase {
  executed: Statement[] = [];
  resultAnswers = '{}';
  currentQuestions: Array<Record<string, unknown>> = [{
    id: 'q1', type: 'MCQ', question: 'Current prompt', options: 'Current|Alternative',
    correct_answer: 'B', items: '', text_field: '', blanks: '', distractors: '',
    sentence: '', words: '', correct_word_indexes: '', image: '', difficulty: 1,
    answer_schema_version: 1,
  }];
  resultStudentId = 'student-a';

  prepare(sql: string) {
    return new Statement(sql, this);
  }

  first(sql: string, bindings: unknown[]) {
    if (sql.includes('FROM results WHERE id = ?')) {
      return {
        id: 'result-1', student_id: this.resultStudentId, class_id: 'class-a', assignment_id: null,
        student_name: 'An', class_name: '4A', quiz_id: 'quiz-a', quiz_title: 'Quiz',
        score: 5, correct_count: 1, total_questions: 1, time_taken: 10,
        submitted_at: '2026-09-14T00:00:00.000Z', answers: this.resultAnswers, grading_version: '2.0.0',
      } satisfies ResultRow;
    }
    if (sql.includes('FROM students') && sql.includes('WHERE username = ?')) {
      return { id: currentUser.username === 'student-a' ? 'student-a' : 'student-b', class_id: 'class-a' };
    }
    return null;
  }

  all(sql: string) {
    if (sql.includes('FROM questions')) return this.currentQuestions;
    return [];
  }
}

const reviewDetail = {
  questionId: 'q1',
  type: 'MCQ',
  status: 'correct',
  isCorrect: true,
  studentAnswer: { kind: 'text', lines: [{ value: 'Historical answer' }] },
  correctAnswer: { kind: 'text', lines: [{ value: 'Historical answer' }] },
  presentation: {
    schemaVersion: 1,
    source: 'submission',
    type: 'MCQ',
    items: [{ id: 'option-0', index: 0, text: 'Historical answer', selected: true, correct: true, state: 'correct' }],
  },
};

describe('student result review history source', () => {
  beforeEach(() => {
    currentUser = { username: 'student-a', role: 'student', fullName: 'An' } as JWTPayload;
  });

  it('prefers stored submission review when the current question has changed', async () => {
    const db = new ReviewDatabase();
    db.resultAnswers = JSON.stringify({
      _reviewDetails: { schemaVersion: 1, source: 'submission', details: [reviewDetail] },
      q1: { selectedAnswer: 'A', isCorrect: true, status: 'correct', questionSnapshot: { id: 'q1', type: 'MCQ' } },
    });

    const response = await handleResultRoutes(
      new Request('https://example.test/api/results/result-1/answers'),
      { DB: db } as any,
      '/api/results/result-1/answers',
      'GET',
    );

    const payload = await response.json() as any;
    expect(response.status).toBe(200);
    expect(payload.reviewDetails).toEqual([reviewDetail]);
    expect(payload.result.score).toBe(5);
    expect(payload.result.correctCount).toBe(1);
  });

  it('marks a minimal legacy snapshot as unverified instead of trusting current answer keys', async () => {
    const db = new ReviewDatabase();
    db.resultAnswers = JSON.stringify({
      q1: {
        selectedAnswer: 'A', isCorrect: true, status: 'correct',
        questionSnapshot: { id: 'q1', type: 'MCQ' },
      },
    });

    const response = await handleResultRoutes(
      new Request('https://example.test/api/results/result-1/answers'),
      { DB: db } as any,
      '/api/results/result-1/answers',
      'GET',
    );

    const payload = await response.json() as any;
    expect(response.status).toBe(200);
    expect(payload.reviewDetails[0].presentation.source).toBe('legacy-unverified');
    expect(payload.reviewDetails[0].status).toBe('correct');
    expect(payload.result.score).toBe(5);
  });

  it('uses the current answer key only when a legacy presentation snapshot and stored outcome agree', async () => {
    const db = new ReviewDatabase();
    db.resultAnswers = JSON.stringify({
      q1: {
        selectedAnswer: 'B', isCorrect: true, status: 'correct',
        questionSnapshot: {
          id: 'q1', type: 'MCQ', question: 'Current prompt', options: ['Current', 'Alternative'],
          correctAnswer: 'B',
        },
      },
    });

    const response = await handleResultRoutes(
      new Request('https://example.test/api/results/result-1/answers'),
      { DB: db } as any,
      '/api/results/result-1/answers',
      'GET',
    );

    const payload = await response.json() as any;
    expect(response.status).toBe(200);
    expect(payload.reviewDetails[0].presentation.source).toBe('verified-current');
    expect(payload.reviewDetails[0].correctAnswer.lines[0].value).toBe('Alternative');
  });

  it('does not trust the current answer key when a compatible legacy snapshot has a changed answer outcome', async () => {
    const db = new ReviewDatabase();
    db.currentQuestions = [{
      id: 'q1', type: 'MCQ', question: 'Current prompt', options: 'Current|Alternative',
      correct_answer: 'B', items: '', text_field: '', blanks: '', distractors: '',
      sentence: '', words: '', correct_word_indexes: '', image: '', difficulty: 1,
      answer_schema_version: 1,
    }];
    db.resultAnswers = JSON.stringify({
      q1: {
        selectedAnswer: 'A', isCorrect: true, status: 'correct',
        questionSnapshot: { id: 'q1', type: 'MCQ', question: 'Current prompt', options: ['Current', 'Alternative'] },
      },
    });

    const response = await handleResultRoutes(
      new Request('https://example.test/api/results/result-1/answers'),
      { DB: db } as any,
      '/api/results/result-1/answers',
      'GET',
    );

    const payload = await response.json() as any;
    expect(response.status).toBe(200);
    expect(payload.reviewDetails[0].presentation.source).toBe('legacy-unverified');
    expect(payload.reviewDetails[0].correctAnswer.kind).toBe('unsupported');
    expect(payload.reviewDetails[0].correctAnswer.lines[0].value).toContain('Không thể');
  });

  it('returns stored review when the current question is deleted', async () => {
    const db = new ReviewDatabase();
    db.currentQuestions = [];
    db.resultAnswers = JSON.stringify({
      _reviewDetails: { schemaVersion: 1, source: 'submission', details: [reviewDetail] },
      q1: { selectedAnswer: 'A', isCorrect: true, status: 'correct', questionSnapshot: { id: 'q1', type: 'MCQ' } },
    });

    const response = await handleResultRoutes(
      new Request('https://example.test/api/results/result-1/answers'),
      { DB: db } as any,
      '/api/results/result-1/answers',
      'GET',
    );

    const payload = await response.json() as any;
    expect(response.status).toBe(200);
    expect(payload.reviewDetails).toEqual([reviewDetail]);
  });

  it('keeps a deleted legacy snapshot readable without inventing a current answer key', async () => {
    const db = new ReviewDatabase();
    db.currentQuestions = [];
    db.resultAnswers = JSON.stringify({
      q1: {
        selectedAnswer: { type: 'SHORT_ANSWER', value: 'Historical response' },
        isCorrect: false,
        status: 'wrong',
        questionSnapshot: { id: 'q1', type: 'SHORT_ANSWER', question: 'Deleted prompt' },
      },
    });

    const response = await handleResultRoutes(
      new Request('https://example.test/api/results/result-1/answers'),
      { DB: db } as any,
      '/api/results/result-1/answers',
      'GET',
    );

    const payload = await response.json() as any;
    expect(response.status).toBe(200);
    expect(payload.reviewDetails[0]).toMatchObject({
      questionId: 'q1',
      status: 'wrong',
      presentation: { source: 'legacy-unverified', type: 'UNSUPPORTED' },
    });
    expect(payload.reviewDetails[0].correctAnswer.kind).toBe('unsupported');
  });

  it('keeps result ownership enforcement before returning stored review metadata', async () => {
    currentUser = { username: 'student-b', role: 'student', fullName: 'Bình' } as JWTPayload;
    const db = new ReviewDatabase();
    db.resultAnswers = JSON.stringify({
      _reviewDetails: { schemaVersion: 1, source: 'submission', details: [reviewDetail] },
    });

    const response = await handleResultRoutes(
      new Request('https://example.test/api/results/result-1/answers'),
      { DB: db } as any,
      '/api/results/result-1/answers',
      'GET',
    );

    expect(response.status).toBe(403);
  });
});

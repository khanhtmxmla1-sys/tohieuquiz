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
    if (sql.includes('FROM students s')) return [{ id: 'student-a' }];
    if (sql.includes('FROM questions')) return [{
      id: 'q1', type: 'MCQ', question: '2 + 2?', options: '4|5', correct_answer: 'A',
      items: '', text_field: '', blanks: '', distractors: '', sentence: '', words: '',
      correct_word_indexes: '', image: '', difficulty: 1, answer_schema_version: 1,
    }];
    return [];
  }
}

describe('POST /api/results authoritative scoring', () => {
  beforeEach(() => {
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
    expect(JSON.stringify(payload.answers)).not.toContain('correctAnswer');

    const insert = db.executed.find((statement) => statement.sql.includes('INSERT INTO results'));
    expect(insert?.sql).toContain('grading_version');
    expect(insert?.bindings[6]).toBe(0);
    expect(insert?.bindings[7]).toBe(0);
    expect(insert?.bindings[8]).toBe(1);
    expect(insert?.bindings[9]).toBe(10);
    expect(insert?.bindings[12]).toBe('2.0.0');
    expect(insert?.bindings).not.toContain(99);
  });
});

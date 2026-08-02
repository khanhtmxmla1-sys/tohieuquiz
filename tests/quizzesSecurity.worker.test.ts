import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectConsoleError } from './helpers/expectedConsole';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload | null = null;
let currentAuthErrorStatus = 401;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => currentUser
    ? { user: currentUser }
    : new Response(JSON.stringify({ status: 'error' }), { status: currentAuthErrorStatus })),
  requireAdmin: vi.fn((user: JWTPayload) => user.role === 'admin'),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
  isStudent: vi.fn((user: JWTPayload) => user.role === 'student'),
}));

import { handleQuizRoutes, sanitizeQuestionForStudent } from '../workers/src/routes/quizzes';
import { handleResultRoutes } from '../workers/src/routes/results';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, readonly db: Database) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { this.db.executed.push(this); return this.db.first(this.sql, this.bindings) as T; }
  async all<T>() { this.db.executed.push(this); return { results: this.db.all(this.sql, this.bindings) as T[] }; }
  async run() { this.db.executed.push(this); return { success: true, meta: { changes: 1, last_row_id: 1 } }; }
}

class Database {
  executed: Statement[] = [];
  batchError: Error | null = null;
  question = {
    id: 'q-1', quiz_id: 'quiz-a', type: 'TRUE_FALSE', question: 'Chá»n Ä‘Ãºng sai',
    options: '', correct_answer: 'B', items: JSON.stringify([{ id: 'i-1', statement: 'Má»‡nh Ä‘á»', isCorrect: true }]),
    text_field: '', blanks: JSON.stringify([{ id: 'b-1', correctAnswer: 'bÃ­ máº­t', options: ['bÃ­ máº­t', 'khÃ¡c'] }]),
    distractors: '', sentence: '', words: '', correct_word_indexes: '[1]', image: '', tags: '',
  };
  prepare(sql: string) { return new Statement(sql, this); }
  first(sql: string, bindings: unknown[]) {
    if (sql.includes('FROM teachers t')) {
      return { username: 'teacher-a', full_name: 'CÃ´ A', full_name_count: 1 };
    }
    if (sql.includes('SELECT created_by FROM quizzes')) {
      return { created_by: bindings[0] === 'quiz-b' ? 'teacher-b' : 'teacher-a' };
    }
    if (sql.includes('SELECT * FROM quizzes WHERE id')) {
      return { id: bindings[0], title: 'Äá»', created_by: bindings[0] === 'quiz-b' ? 'teacher-b' : 'teacher-a', class_level: '4', time_limit: 15 };
    }
    if (sql.includes('COUNT(*) as cnt')) return { cnt: 0 };
    return null;
  }
  all(sql: string, bindings: unknown[]) {
    if (sql.includes('FROM questions')) return [{ ...this.question, quiz_id: String(bindings[0] || 'quiz-a') }];
    return [];
  }
  async batch(statements: Statement[]) {
    for (const statement of statements) this.executed.push(statement);
    if (this.batchError) throw this.batchError;
    return statements.map(() => ({ success: true }));
  }
}

const env = (db: Database) => ({ DB: db, JWT_SECRET: 'test-secret' } as any);
const authRequest = (url: string, init: RequestInit = {}) => new Request(url, {
  ...init,
  headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json', ...(init.headers || {}) },
});

describe('quiz answer confidentiality and ownership', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    currentUser = null;
    currentAuthErrorStatus = 401;
  });

  it('returns only sanitized public question data to anonymous callers', async () => {
    const db = new Database();
    const response = await handleQuizRoutes(new Request('https://test/api/questions?quizId=quiz-a'), env(db), '/api/questions', 'GET');
    const rows = await response.json() as any[];
    expect(response.status).toBe(200);
    expect(rows[0]).not.toHaveProperty('correct_answer');
    expect(JSON.parse(rows[0].items)[0]).not.toHaveProperty('isCorrect');
    expect(db.executed.some((statement) => statement.sql.includes('show_on_home'))).toBe(true);
  });

  it('falls back to sanitized public questions when authentication is unavailable', async () => {
    currentAuthErrorStatus = 503;
    const db = new Database();
    const response = await handleQuizRoutes(authRequest('https://test/api/questions?quizId=quiz-a'), env(db), '/api/questions', 'GET');
    const rows = await response.json() as any[];
    expect(response.status).toBe(200);
    expect(rows[0]).not.toHaveProperty('correct_answer');
    expect(JSON.parse(rows[0].items)[0]).not.toHaveProperty('isCorrect');
    expect(db.executed.some((statement) => statement.sql.includes('show_on_home'))).toBe(true);
  });

  it('strips direct and nested answers for a student', async () => {
    currentUser = { id: 'student-a', username: 'student-a', role: 'student', classId: 'class-a' };
    const db = new Database();
    const response = await handleQuizRoutes(authRequest('https://test/api/questions?quizId=quiz-a'), env(db), '/api/questions', 'GET');
    const rows = await response.json() as any[];
    expect(response.status).toBe(200);
    expect(rows[0]).not.toHaveProperty('correct_answer');
    expect(rows[0]).not.toHaveProperty('correct_word_indexes');
    expect(JSON.parse(rows[0].items)[0]).not.toHaveProperty('isCorrect');
    expect(JSON.parse(rows[0].blanks)[0]).not.toHaveProperty('correctAnswer');
  });

  it('keeps the authenticated student catalog contract while sanitizing every row', async () => {
    currentUser = { id: 'student-a', username: 'student-a', role: 'student', classId: 'class-a' };
    const db = new Database();
    const response = await handleQuizRoutes(authRequest('https://test/api/questions'), env(db), '/api/questions', 'GET');
    const rows = await response.json() as any[];
    expect(response.status).toBe(200);
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty('correct_answer');
    expect(JSON.parse(rows[0].items)[0]).not.toHaveProperty('isCorrect');
  });

  it('loads full question data for a uniquely matched legacy display-name owner', async () => {
    currentUser = { username: 'teacher-a', fullName: 'CÃ´ A', role: 'teacher' };
    const db = new Database();

    const response = await handleQuizRoutes(
      authRequest('https://test/api/questions'),
      env(db),
      '/api/questions',
      'GET',
    );
    const rows = await response.json() as any[];

    expect(response.status).toBe(200);
    expect(rows[0].correct_answer).toBe('B');
    const scopedQuery = db.executed.find((statement) => statement.sql.includes('LOWER(TRIM(z.created_by))'));
    expect(scopedQuery?.bindings).toEqual(['teacher-a', 'CÃ´ A', 'CÃ´ A']);
  });

  it('hides drag-drop order while preserving a shuffled choice pool', () => {
    const safe = sanitizeQuestionForStudent({
      id: 'drag-1',
      type: 'DRAG_DROP',
      text_field: 'Báº§u trá»i [xanh] vÃ  mÃ¢y [tráº¯ng].',
      blanks: JSON.stringify(['xanh', 'tráº¯ng']),
      distractors: JSON.stringify(['Ä‘á»']),
      correct_answer: '',
    });
    expect(safe.text_field).toBe('Báº§u trá»i [1] vÃ  mÃ¢y [2].');
    expect(JSON.parse(safe.blanks)).toEqual([{ id: 'blank-0' }, { id: 'blank-1' }]);
    const pool = JSON.parse(safe.distractors);
    expect(pool.sort()).toEqual(['xanh', 'tráº¯ng', 'Ä‘á»'].sort());
    expect(safe.text_field).not.toContain('xanh');
    expect(safe.text_field).not.toContain('tráº¯ng');
  });

  it('does not return correctAnswer in student validation details', async () => {
    currentUser = { id: 'student-a', username: 'student-a', role: 'student', classId: 'class-a' };
    const db = new Database();
    const response = await handleResultRoutes(authRequest('https://test/api/validate', {
      method: 'POST', body: JSON.stringify({ quizId: 'quiz-a', answers: {} }),
    }), env(db), '/api/validate', 'POST');
    const payload = await response.json() as any;
    expect(response.status).toBe(200);
    expect(payload.details[0]).not.toHaveProperty('correctAnswer');
  });

  it('rejects a body id that differs from the URL quiz id', async () => {
    currentUser = { username: 'teacher-a', role: 'teacher' };
    const db = new Database();
    const response = await handleQuizRoutes(authRequest('https://test/api/quizzes/quiz-a', {
      method: 'PUT', body: JSON.stringify({ id: 'quiz-b', title: 'Táº¥n cÃ´ng', classLevel: '4', questions: [] }),
    }), env(db), '/api/quizzes/quiz-a', 'PUT');
    expect(response.status).toBe(400);
    expect(db.executed.some(statement => statement.bindings.includes('quiz-b'))).toBe(false);
  });

  it('rejects duplicating another teacher quiz', async () => {
    currentUser = { username: 'teacher-a', role: 'teacher' };
    const db = new Database();
    const response = await handleQuizRoutes(authRequest('https://test/api/quizzes/quiz-b/duplicate', { method: 'POST' }), env(db), '/api/quizzes/quiz-b/duplicate', 'POST');
    expect(response.status).toBe(403);
  });

  it('does not expose D1 details when quiz creation fails', async () => {
    const errorSpy = expectConsoleError();
    currentUser = { username: 'teacher-a', role: 'teacher' };
    const db = new Database();
    db.batchError = new Error('D1_ERROR: no such table: secret_quizzes');
    const response = await handleQuizRoutes(authRequest('https://test/api/quizzes', {
      method: 'POST',
      headers: { 'x-request-id': 'req-quiz-1' },
      body: JSON.stringify({
        id: 'quiz-a', title: 'Äá»', classLevel: '4', timeLimit: 15,
        createdAt: '2026-07-20T00:00:00.000Z', questions: [],
      }),
    }), env(db), '/api/quizzes', 'POST');
    const payload = await response.json() as any;

    expect(response.status).toBe(500);
    expect(payload.message).toBe('Internal server error');
    expect(payload.requestId).toBe('req-quiz-1');
    expect(JSON.stringify(payload)).not.toContain('secret_quizzes');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(String(errorSpy.mock.calls[0][0]));
    expect(logged).toEqual(expect.objectContaining({
      event: 'worker_request_failed',
      requestId: 'req-quiz-1',
      route: '/api/quizzes',
      method: 'POST',
      status: 500,
      errorCode: 'INTERNAL_ERROR',
      context: 'POST /api/quizzes',
      errorName: 'Error',
    }));
    expect(JSON.stringify(logged)).not.toContain('secret_quizzes');
  });
});

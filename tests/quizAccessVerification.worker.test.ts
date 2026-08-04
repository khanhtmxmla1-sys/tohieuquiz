import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload | null = null;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => currentUser
    ? { user: currentUser }
    : new Response(JSON.stringify({ status: 'error' }), { status: 401 })),
  requireAdmin: vi.fn((user: JWTPayload) => user.role === 'admin'),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
}));

import {
  handleQuizRoutes,
  sanitizeQuizForStudent,
} from '../workers/src/routes/quizzes';

class Statement {
  bindings: unknown[] = [];
  constructor(private readonly sql: string, private readonly db: Database) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { return this.db.first(this.sql, this.bindings) as T | null; }
  async all<T>() { return { results: this.db.all(this.sql) as T[] }; }
}

class Database {
  quiz: Record<string, unknown> | null = {
    id: 'quiz-1',
    title: 'Đề có mã',
    access_code: 'ABC123',
    require_code: 'TRUE',
    show_on_home: 'TRUE',
  };

  prepare(sql: string) { return new Statement(sql, this); }
  first(sql: string, bindings: unknown[]) {
    if (sql.includes('SELECT access_code, require_code FROM quizzes')) {
      return bindings[0] === 'quiz-1' ? this.quiz : null;
    }
    return null;
  }
  all(sql: string) {
    if (sql.includes('SELECT * FROM quizzes')) return this.quiz ? [this.quiz] : [];
    return [];
  }
}

const env = (db: Database) => ({ DB: db, JWT_SECRET: 'test-secret' } as any);
const request = (path: string, body: unknown) => new Request(`https://test${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('quiz access verification', () => {
  beforeEach(() => { currentUser = null; });

  it('accepts a valid normalized access code', async () => {
    const response = await handleQuizRoutes(
      request('/api/quizzes/access-verification/quiz-1', { accessCode: ' abc123 ' }),
      env(new Database()),
      '/api/quizzes/access-verification/quiz-1',
      'POST',
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ valid: true });
  });

  it('returns one generic forbidden response for wrong and missing quizzes', async () => {
    const db = new Database();
    const wrong = await handleQuizRoutes(
      request('/api/quizzes/access-verification/quiz-1', { accessCode: 'ZZZ999' }),
      env(db), '/api/quizzes/access-verification/quiz-1', 'POST',
    );
    const missing = await handleQuizRoutes(
      request('/api/quizzes/access-verification/missing', { accessCode: 'ABC123' }),
      env(db), '/api/quizzes/access-verification/missing', 'POST',
    );

    expect(wrong.status).toBe(403);
    expect(missing.status).toBe(403);
    expect(await wrong.json()).toEqual({ valid: false, error: 'INVALID_ACCESS_CODE' });
    expect(await missing.json()).toEqual({ valid: false, error: 'INVALID_ACCESS_CODE' });
  });

  it('allows entry when the quiz no longer requires a code', async () => {
    const db = new Database();
    db.quiz = { ...db.quiz, require_code: 'FALSE', access_code: '' };
    const response = await handleQuizRoutes(
      request('/api/quizzes/access-verification/quiz-1', { accessCode: 'anything' }),
      env(db), '/api/quizzes/access-verification/quiz-1', 'POST',
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ valid: true });
  });

  it('rejects malformed access-code payloads without querying by the code', async () => {
    const response = await handleQuizRoutes(
      request('/api/quizzes/access-verification/quiz-1', { accessCode: '<script>' }),
      env(new Database()),
      '/api/quizzes/access-verification/quiz-1',
      'POST',
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(expect.objectContaining({ code: 'INVALID_ACCESS_CODE_FORMAT' }));
  });

  it('removes access codes from public and student quiz DTOs but keeps teacher DTOs', async () => {
    const db = new Database();
    const publicResponse = await handleQuizRoutes(
      new Request('https://test/api/quizzes'), env(db), '/api/quizzes', 'GET',
    );
    currentUser = { username: 'student-1', role: 'student' };
    const studentResponse = await handleQuizRoutes(
      new Request('https://test/api/quizzes', { headers: { Authorization: 'Bearer student' } }),
      env(db), '/api/quizzes', 'GET',
    );
    currentUser = { username: 'teacher-1', role: 'teacher' };
    const teacherResponse = await handleQuizRoutes(
      new Request('https://test/api/quizzes', { headers: { Authorization: 'Bearer teacher' } }),
      env(db), '/api/quizzes', 'GET',
    );

    const publicRows = await publicResponse.json() as any[];
    const studentRows = await studentResponse.json() as any[];
    const teacherRows = await teacherResponse.json() as any[];
    expect(publicRows[0]).not.toHaveProperty('access_code');
    expect(studentRows[0]).not.toHaveProperty('access_code');
    expect(teacherRows[0].access_code).toBe('ABC123');
  });

  it('sanitizes both snake-case and camel-case access-code fields', () => {
    expect(sanitizeQuizForStudent({ access_code: 'ABC123', accessCode: 'ABC123', require_code: 'TRUE' }))
      .toEqual({ require_code: 'TRUE' });
  });
});

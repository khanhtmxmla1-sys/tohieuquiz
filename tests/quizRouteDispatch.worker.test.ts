// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload | null = null;
let authCalls = 0;

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => {
    authCalls += 1;
    return currentUser
      ? { user: currentUser }
      : new Response(JSON.stringify({ status: 'error' }), { status: 401 });
  }),
  requireAdmin: vi.fn((user: JWTPayload) => user.role === 'admin'),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
}));

import {
  handleQuizRoutes,
  mapQuestionFromD1,
  sanitizeQuestionForStudent,
  sanitizeQuizForStudent,
} from '../workers/src/routes/quizzes';

class Statement {
  private bindings: unknown[] = [];

  constructor(private readonly db: RecordingDb, private readonly sql: string) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  async first<T>() {
    this.db.firstCalls.push({ sql: this.sql, bindings: this.bindings });
    return this.db.nextFirst as T | null;
  }

  async all<T>() {
    this.db.allCalls.push({ sql: this.sql, bindings: this.bindings });
    return { results: [] as T[] };
  }

  async run() {
    this.db.runCalls.push({ sql: this.sql, bindings: this.bindings });
    return { success: true };
  }
}

class RecordingDb {
  nextFirst: unknown = null;
  firstCalls: Array<{ sql: string; bindings: unknown[] }> = [];
  allCalls: Array<{ sql: string; bindings: unknown[] }> = [];
  runCalls: Array<{ sql: string; bindings: unknown[] }> = [];

  prepare(sql: string) {
    return new Statement(this, sql);
  }
}

const env = (db: RecordingDb) => ({ DB: db, JWT_SECRET: 'test-secret' } as any);
const postRequest = (path: string, body: unknown = {}) => new Request(`https://test${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('quiz route dispatch compatibility', () => {
  beforeEach(() => {
    currentUser = null;
    authCalls = 0;
  });

  it('falls through unsupported methods and unmatched paths to the existing 404 response', async () => {
    const db = new RecordingDb();
    const response = await handleQuizRoutes(
      new Request('https://test/api/quizzes/quiz-1/play-questions', { method: 'GET' }),
      env(db),
      '/api/quizzes/quiz-1/play-questions',
      'GET',
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      status: 'error',
      message: 'Not found: /api/quizzes/quiz-1/play-questions',
    });
    expect(db.firstCalls).toHaveLength(0);
    expect(db.allCalls).toHaveLength(0);
    expect(db.runCalls).toHaveLength(0);
    expect(authCalls).toBe(0);
  });

  it('keeps decode failures local to the access-verification and play routes', async () => {
    const db = new RecordingDb();
    const accessResponse = await handleQuizRoutes(
      postRequest('/api/quizzes/access-verification/%E0%A4%A', { accessCode: 'ABC123' }),
      env(db),
      '/api/quizzes/access-verification/%E0%A4%A',
      'POST',
    );
    const playResponse = await handleQuizRoutes(
      postRequest('/api/quizzes/%E0%A4%A/play-questions'),
      env(db),
      '/api/quizzes/%E0%A4%A/play-questions',
      'POST',
    );

    expect(accessResponse.status).toBe(400);
    expect(await accessResponse.json()).toEqual(expect.objectContaining({ code: 'INVALID_ACCESS_CODE_FORMAT' }));
    expect(playResponse.status).toBe(400);
    expect(await playResponse.json()).toEqual({ status: 'error', message: 'Invalid quiz ID' });
    expect(db.firstCalls).toHaveLength(0);
    expect(db.allCalls).toHaveLength(0);
    expect(db.runCalls).toHaveLength(0);
    expect(authCalls).toBe(0);
  });

  it('keeps the access-verification branch ahead of the overlapping play route', async () => {
    const db = new RecordingDb();
    db.nextFirst = {
      id: 'play-questions',
      access_code: 'ABC123',
      require_code: 'TRUE',
      show_on_home: 'TRUE',
      revision: 1,
      time_limit: 20,
    };
    const response = await handleQuizRoutes(
      postRequest('/api/quizzes/access-verification/play-questions', { accessCode: 'WRONG' }),
      env(db),
      '/api/quizzes/access-verification/play-questions',
      'POST',
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ valid: false, error: 'INVALID_ACCESS_CODE' });
    expect(db.firstCalls[0]?.bindings).toEqual(['play-questions']);
  });

  it('decodes a valid encoded quiz ID before its first D1 lookup', async () => {
    const db = new RecordingDb();
    db.nextFirst = {
      id: 'quiz-1',
      access_code: 'ABC123',
      require_code: 'TRUE',
      show_on_home: 'TRUE',
      revision: 1,
      time_limit: 20,
    };
    const response = await handleQuizRoutes(
      postRequest('/api/quizzes/access-verification/quiz-%31', { accessCode: 'WRONG' }),
      env(db),
      '/api/quizzes/access-verification/quiz-%31',
      'POST',
    );

    expect(response.status).toBe(403);
    expect(db.firstCalls[0]?.bindings).toEqual(['quiz-1']);
  });

  it('marks rejected play responses as private and non-cacheable', async () => {
    const response = await handleQuizRoutes(
      postRequest('/api/quizzes/missing/play-questions'),
      env(new RecordingDb()),
      '/api/quizzes/missing/play-questions',
      'POST',
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('preserves the legacy DELETE prefix dispatch instead of tightening it to an exact path', async () => {
    currentUser = { username: 'admin-1', role: 'admin' };
    const db = new RecordingDb();
    const response = await handleQuizRoutes(
      new Request('https://test/api/quizzes/quiz-1/not-a-delete-route', { method: 'DELETE' }),
      env(db),
      '/api/quizzes/quiz-1/not-a-delete-route',
      'DELETE',
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'success' });
    expect(db.runCalls.map(({ sql }) => sql)).toEqual([
      'DELETE FROM questions WHERE quiz_id = ?',
      'DELETE FROM quizzes WHERE id = ?',
    ]);
    expect(db.runCalls.map(({ bindings }) => bindings)).toEqual([['quiz-1'], ['quiz-1']]);
  });

  it('keeps the facade DTO helper exports available to existing callers', () => {
    expect(typeof mapQuestionFromD1).toBe('function');
    expect(typeof sanitizeQuestionForStudent).toBe('function');
    expect(sanitizeQuizForStudent({ access_code: 'SECRET', title: 'Quiz' })).toEqual({ title: 'Quiz' });
  });
});

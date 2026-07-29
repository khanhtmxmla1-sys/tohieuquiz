// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  user: { id: 'admin-1', username: 'admin', role: 'admin' as const },
}));

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({ user: auth.user })),
  requireAdmin: vi.fn((user) => user.role === 'admin'),
  requireTeacher: vi.fn((user) => user.role === 'teacher' || user.role === 'admin'),
  isStudent: vi.fn((user) => user.role === 'student'),
}));
vi.mock('../workers/src/routes/interventions', () => ({
  handleInterventionRoutes: vi.fn(async () => null),
}));

import { handleResultRoutes } from '../workers/src/routes/results';

class ResultStatement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, private readonly database: ResultDatabase) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() {
    this.database.executed.push(this);
    return { total: this.database.total } as T;
  }
  async all<T>() {
    this.database.executed.push(this);
    return { results: this.database.rows as T[] };
  }
}

class ResultDatabase {
  readonly executed: ResultStatement[] = [];
  constructor(readonly rows: Record<string, unknown>[], readonly total: number) {}
  prepare(sql: string) { return new ResultStatement(sql, this); }
}

const resultRow = (id: string, submittedAt: string) => ({
  id,
  student_name: `Student ${id}`,
  class_name: '4A',
  quiz_id: 'quiz-1',
  quiz_title: 'Quiz',
  score: 8,
  correct_count: 8,
  total_questions: 10,
  time_taken: 90,
  submitted_at: submittedAt,
});

describe('large result route cursor pagination', () => {
  beforeEach(() => {
    auth.user = { id: 'admin-1', username: 'admin', role: 'admin' };
  });

  it('defaults to a bounded page and returns an opaque stable cursor', async () => {
    const database = new ResultDatabase([
      resultRow('r-2', '2026-07-29T10:00:00.000Z'),
      resultRow('r-1', '2026-07-29T09:00:00.000Z'),
    ], 2);
    const response = await handleResultRoutes(
      new Request('https://api.test/api/results?limit=1'),
      { DB: database } as any,
      '/api/results',
      'GET',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
    expect(payload.meta).toMatchObject({ limit: 1, total: 2, hasMore: true });
    expect(payload.meta.nextCursor).toEqual(expect.any(String));
    expect(payload.meta.nextCursor).not.toContain('2026-07-29');
    const query = database.executed.find((statement) => statement.sql.includes('ORDER BY submitted_at'));
    expect(query?.sql).toContain('id DESC LIMIT ?');
    expect(query?.bindings).toEqual([2]);
  });

  it('uses cursor values in the next stable page and rejects unbounded limits', async () => {
    const firstDatabase = new ResultDatabase([
      resultRow('r-2', '2026-07-29T10:00:00.000Z'),
      resultRow('r-1', '2026-07-29T09:00:00.000Z'),
    ], 2);
    const first = await handleResultRoutes(
      new Request('https://api.test/api/results?limit=1'),
      { DB: firstDatabase } as any,
      '/api/results',
      'GET',
    );
    const cursor = (await first.json() as any).meta.nextCursor;

    const secondDatabase = new ResultDatabase([
      resultRow('r-1', '2026-07-29T09:00:00.000Z'),
    ], 2);
    const second = await handleResultRoutes(
      new Request(`https://api.test/api/results?limit=1&cursor=${encodeURIComponent(cursor)}`),
      { DB: secondDatabase } as any,
      '/api/results',
      'GET',
    );
    const query = secondDatabase.executed.find((statement) => statement.sql.includes('ORDER BY submitted_at'));
    expect(second.status).toBe(200);
    expect(query?.sql).toContain('submitted_at < ?');
    expect(query?.bindings).toEqual([
      '2026-07-29T10:00:00.000Z',
      '2026-07-29T10:00:00.000Z',
      'r-2',
      2,
    ]);

    const invalid = await handleResultRoutes(
      new Request('https://api.test/api/results?limit=101'),
      { DB: new ResultDatabase([], 0) } as any,
      '/api/results',
      'GET',
    );
    expect(invalid.status).toBe(400);
  });
});

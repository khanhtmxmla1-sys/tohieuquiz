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

import { handleQuizRoutes } from '../workers/src/routes/quizzes';

type QuizRow = {
  id: string;
  title: string;
  created_by: string;
  access_code: string;
  require_code: string;
};

class Statement {
  bindings: unknown[] = [];

  constructor(
    readonly sql: string,
    private readonly db: Database,
  ) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  async first<T>() {
    return this.db.first(this.sql) as T | null;
  }

  async all<T>() {
    return { results: this.db.all(this.sql, this.bindings) as T[] };
  }
}

class Database {
  readonly quizzes: QuizRow[] = [
    {
      id: 'quiz-own',
      title: 'Đề của tài khoản',
      created_by: 'teacher-a',
      access_code: 'OWN123',
      require_code: 'TRUE',
    },
    {
      id: 'quiz-legacy',
      title: 'Đề tên cũ',
      created_by: 'Cô A',
      access_code: 'OLD456',
      require_code: 'TRUE',
    },
    {
      id: 'quiz-other',
      title: 'Đề giáo viên khác',
      created_by: 'teacher-b',
      access_code: 'SECRET9',
      require_code: 'TRUE',
    },
  ];

  prepare(sql: string) {
    return new Statement(sql, this);
  }

  first(sql: string) {
    if (sql.includes('FROM teachers t')) {
      return {
        username: 'teacher-a',
        full_name: 'Cô A',
        full_name_count: 1,
      };
    }
    return null;
  }

  all(sql: string, bindings: unknown[]) {
    if (!sql.includes('FROM quizzes')) return [];
    if (!sql.includes('LOWER(TRIM(created_by))')) return this.quizzes;

    const owners = bindings
      .filter((value): value is string => typeof value === 'string')
      .map(value => value.trim().toLocaleLowerCase('vi'));
    return this.quizzes.filter(quiz => owners.includes(quiz.created_by.trim().toLocaleLowerCase('vi')));
  }
}

const env = (db: Database) => ({ DB: db, JWT_SECRET: 'test-secret' } as any);
const authRequest = () => new Request('https://test/api/quizzes', {
  headers: { Authorization: 'Bearer teacher-token' },
});

describe('teacher quiz catalog scope', () => {
  beforeEach(() => {
    currentUser = { username: 'teacher-a', role: 'teacher' };
  });

  it('returns only canonical and unique legacy-owned quizzes while preserving their access codes', async () => {
    const response = await handleQuizRoutes(
      authRequest(),
      env(new Database()),
      '/api/quizzes',
      'GET',
    );
    const rows = await response.json() as QuizRow[];

    expect(response.status).toBe(200);
    expect(rows.map(row => row.id)).toEqual(['quiz-own', 'quiz-legacy']);
    expect(rows.map(row => row.access_code)).toEqual(['OWN123', 'OLD456']);
    expect(JSON.stringify(rows)).not.toContain('SECRET9');
  });
});

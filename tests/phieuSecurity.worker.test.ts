import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload | null = null;
vi.mock('../workers/src/utils/ogImage', () => ({
  renderOgPng: vi.fn(async () => new Uint8Array()),
}));

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => currentUser
    ? { user: currentUser }
    : new Response(JSON.stringify({ status: 'error' }), { status: 401 })),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
}));

import { handlePhieuRoutes } from '../workers/src/routes/phieu';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, readonly db: Database) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { this.db.executed.push(this); return this.db.first(this.sql, this.bindings) as T; }
  async run() { this.db.executed.push(this); return { success: true }; }
}

class Database {
  executed: Statement[] = [];
  teacherUsername = 'teacher-a';
  prepare(sql: string) { return new Statement(sql, this); }
  first(sql: string, bindings: unknown[]) {
    if (sql.includes('FROM hw_submissions hs')) {
      return {
        submission_id: String(bindings[0]),
        student_id: 'student-1',
        student_name: 'Học sinh 1',
        class_id: 'class-1',
        teacher_username: this.teacherUsername,
      };
    }
    if (sql.includes('FROM phieu_nhanxet WHERE submission_id')) return null;
    return null;
  }
}

const env = (db: Database) => ({ DB: db, JWT_SECRET: 'test-secret', OG_IMAGES: { delete: vi.fn() } } as any);
const request = (url: string) => new Request(url, { headers: { Authorization: 'Bearer test-token' } });

describe('phieu REST authentication and ownership', () => {
  beforeEach(() => { currentUser = null; });

  it('rejects requests without JWT', async () => {
    const response = await handlePhieuRoutes(
      new Request('https://test/api/phieu/submissions/sub-1'),
      env(new Database()),
      '/api/phieu/submissions/sub-1',
      'GET',
    );
    expect(response.status).toBe(401);
  });

  it('rejects student role', async () => {
    currentUser = { id: 'student-1', username: 'student-1', role: 'student', classId: 'class-1' };
    const response = await handlePhieuRoutes(
      request('https://test/api/phieu/submissions/sub-1'),
      env(new Database()),
      '/api/phieu/submissions/sub-1',
      'GET',
    );
    expect(response.status).toBe(403);
  });

  it('rejects a teacher outside the submission class', async () => {
    currentUser = { username: 'teacher-b', role: 'teacher' };
    const response = await handlePhieuRoutes(
      request('https://test/api/phieu/submissions/sub-1'),
      env(new Database()),
      '/api/phieu/submissions/sub-1',
      'GET',
    );
    expect(response.status).toBe(403);
  });

  it('allows the owning teacher and binds the submission id from the URL', async () => {
    currentUser = { username: 'teacher-a', role: 'teacher' };
    const db = new Database();
    const response = await handlePhieuRoutes(
      request('https://test/api/phieu/submissions/sub%201'),
      env(db),
      '/api/phieu/submissions/sub%201',
      'GET',
    );
    const payload = await response.json() as any;
    expect(response.status).toBe(200);
    expect(payload.data).toBeNull();
    expect(db.executed[0].bindings[0]).toBe('sub 1');
  });
});

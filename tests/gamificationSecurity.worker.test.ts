import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload | null = null;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => currentUser
    ? { user: currentUser }
    : new Response(JSON.stringify({ status: 'error' }), { status: 401 })),
  isStudent: vi.fn((user: JWTPayload) => user.role === 'student'),
}));

import { handleGamificationRoutes } from '../workers/src/routes/gamification';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, readonly db: Database) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { this.db.executed.push(this); return this.db.first(this.sql, this.bindings) as T; }
  async all<T>() { this.db.executed.push(this); return { results: this.db.all(this.sql) as T[] }; }
  async run() { this.db.executed.push(this); return { success: true }; }
}
class Database {
  executed: Statement[] = [];
  prepare(sql: string) { return new Statement(sql, this); }
  first(sql: string, _bindings: unknown[]) {
    if (sql.includes('FROM user_pets')) return { pet_id: 'cat_01', pet_name: 'Mèo', level: 1, exp: 0, exp_to_next: 100, mood: 'happy', items: '[]' };
    if (sql.includes('FROM students')) return { coins: 100 };
    return null;
  }
  all(sql: string) {
    if (sql.includes('shop_items')) return [];
    if (sql.includes('attendance_claims')) return [];
    return [];
  }
}
const env = (db: Database) => ({ DB: db, JWT_SECRET: 'test-secret' } as any);
const request = (url: string, init: RequestInit = {}) => new Request(url, {
  ...init,
  headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json', ...(init.headers || {}) },
});

describe('gamification authentication and subject binding', () => {
  beforeEach(() => { currentUser = null; });

  it('rejects requests without JWT', async () => {
    const response = await handleGamificationRoutes(new Request('https://test/api/pets?username=student-a'), env(new Database()), '/api/pets', 'GET');
    expect(response.status).toBe(401);
  });

  it('rejects a student requesting another username', async () => {
    currentUser = { id: 'student-a', username: 'student-a', role: 'student', classId: 'class-a' };
    const response = await handleGamificationRoutes(request('https://test/api/pets?username=student-b'), env(new Database()), '/api/pets', 'GET');
    expect(response.status).toBe(403);
  });

  it('uses the JWT username for attendance queries', async () => {
    currentUser = { id: 'student-a', username: 'student-a', role: 'student', classId: 'class-a' };
    const db = new Database();
    const response = await handleGamificationRoutes(request('https://test/api/game-state/attendance-status?username=student-a'), env(db), '/api/game-state/attendance-status', 'GET');
    expect(response.status).toBe(200);
    const query = db.executed.find(statement => statement.sql.includes('FROM attendance_claims'));
    expect(query?.bindings[0]).toBe('student-a');
  });

  it('forbids teachers from mutating a student game state', async () => {
    currentUser = { username: 'teacher-a', role: 'teacher' };
    const response = await handleGamificationRoutes(request('https://test/api/game-state', {
      method: 'POST', body: JSON.stringify({ username: 'student-a', addExp: 999, addCoins: 999 }),
    }), env(new Database()), '/api/game-state', 'POST');
    expect(response.status).toBe(403);
  });
});

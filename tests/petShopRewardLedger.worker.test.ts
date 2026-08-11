// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({
    user: { id: 'student-a', username: 'student-a', role: 'student', classId: 'class-a' },
  })),
  isStudent: vi.fn((user: any) => user.role === 'student'),
}));

import { handleGamificationRoutes } from '../workers/src/routes/gamification';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, private readonly db: DatabaseSync) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { return this.db.prepare(this.sql).get(...this.bindings as any[]) as T; }
  async all<T>() { return { results: this.db.prepare(this.sql).all(...this.bindings as any[]) as T[] }; }
  async run() { return this.db.prepare(this.sql).run(...this.bindings as any[]); }
  runSync() { return this.db.prepare(this.sql).run(...this.bindings as any[]); }
}
class SqliteD1 {
  constructor(readonly sqlite: DatabaseSync) {}
  prepare(sql: string) { return new Statement(sql, this.sqlite); }
  async batch(statements: Statement[]) {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(statement => statement.runSync());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }
}

let sqlite: DatabaseSync;
let db: SqliteD1;

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE students (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, coins INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE user_pets (
      username TEXT PRIMARY KEY, pet_id TEXT DEFAULT 'cat_01', pet_name TEXT DEFAULT 'Mèo Con',
      level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, exp_to_next INTEGER DEFAULT 100,
      total_exp INTEGER NOT NULL DEFAULT 0, mood TEXT DEFAULT 'happy', items TEXT DEFAULT '[]',
      last_active TEXT DEFAULT ''
    );
    CREATE TABLE shop_items (
      item_id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0, image_url TEXT DEFAULT ''
    );
    CREATE TABLE student_reward_ledger (
      id TEXT PRIMARY KEY, student_id TEXT NOT NULL, source_type TEXT NOT NULL, source_key TEXT NOT NULL,
      reward_type TEXT NOT NULL, coins_delta INTEGER NOT NULL DEFAULT 0, exp_delta INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL,
      UNIQUE(student_id, source_type, source_key)
    );
    CREATE TRIGGER trg_student_reward_ledger_nonnegative_wallet
    BEFORE INSERT ON student_reward_ledger
    WHEN NEW.coins_delta < 0
      AND COALESCE((SELECT coins FROM students WHERE id = NEW.student_id), 0) + NEW.coins_delta < 0
    BEGIN
      SELECT RAISE(ABORT, 'INSUFFICIENT_COIN_BALANCE');
    END;

    INSERT INTO students VALUES ('student-a', 'student-a', 100);
    INSERT INTO user_pets(username, items, total_exp) VALUES ('student-a', '[]', 0);
    INSERT INTO shop_items VALUES
      ('hat-a', 'Mũ A', 'ACCESSORY', 60, ''),
      ('hat-b', 'Mũ B', 'ACCESSORY', 60, '');
  `);
  db = new SqliteD1(sqlite);
});

afterEach(() => sqlite.close());

const buy = (itemId: string) => handleGamificationRoutes(
  new Request('https://test/api/shop/buy', {
    method: 'POST',
    headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'student-a', itemId }),
  }),
  { DB: db, JWT_SECRET: 'test-secret' } as any,
  '/api/shop/buy',
  'POST',
);

describe('pet shop wallet mutations use the canonical ledger', () => {
  it('makes replay of the same item idempotent and deducts once', async () => {
    const responses = await Promise.all([buy('hat-a'), buy('hat-a')]);
    const payloads = await Promise.all(responses.map(response => response.json() as Promise<any>));

    expect(responses.every(response => response.status === 200)).toBe(true);
    expect(payloads.map(payload => Boolean(payload.alreadyClaimed)).sort()).toEqual([false, true]);
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 40 });
    expect(sqlite.prepare(`SELECT items FROM user_pets WHERE username='student-a'`).get()).toEqual({ items: '["hat-a"]' });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger
      WHERE source_type='PET_SHOP_PURCHASE' AND source_key='hat-a'`).get()).toEqual({ count: 1 });
  });

  it('never lets concurrent different purchases overdraw the wallet', async () => {
    const responses = await Promise.all([buy('hat-a'), buy('hat-b')]);
    const payloads = await Promise.all(responses.map(response => response.json() as Promise<any>));

    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 40 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger`).get()).toEqual({ count: 1 });
    expect(payloads.filter(payload => payload.status === 'success')).toHaveLength(1);
    expect(payloads.filter(payload => payload.status === 'error')).toHaveLength(1);
  });
});

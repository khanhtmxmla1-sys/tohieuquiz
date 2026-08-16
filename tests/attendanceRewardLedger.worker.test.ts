// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({
    user: { id: 'student-a', username: 'student-a', role: 'student', classId: 'class-a' },
  })),
  isStudent: vi.fn((user: any) => user.role === 'student'),
}));

import { getCurrentDateKey } from '../workers/src/gameLoop/dateKeys';
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
const today = getCurrentDateKey();

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE students (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      coins INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE user_pets (
      username TEXT PRIMARY KEY,
      pet_id TEXT DEFAULT 'cat_01',
      pet_name TEXT DEFAULT 'Mèo Con',
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      exp_to_next INTEGER DEFAULT 100,
      total_exp INTEGER NOT NULL DEFAULT 0,
      mood TEXT DEFAULT 'happy',
      items TEXT DEFAULT '[]',
      last_active TEXT DEFAULT ''
    );
    CREATE TABLE student_reward_ledger (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_key TEXT NOT NULL,
      reward_type TEXT NOT NULL,
      coins_delta INTEGER NOT NULL DEFAULT 0,
      exp_delta INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      UNIQUE(student_id, source_type, source_key)
    );
    CREATE TABLE attendance_claims (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      claim_date TEXT NOT NULL,
      reward_exp INTEGER NOT NULL,
      reward_coins INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX idx_attendance_user_date ON attendance_claims(username, claim_date);
    CREATE TABLE questions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      type TEXT NOT NULL,
      options TEXT NOT NULL,
      correct_answer TEXT NOT NULL
    );
    INSERT INTO students VALUES ('student-a', 'student-a', 100);
    INSERT INTO user_pets(username, total_exp) VALUES ('student-a', 0);
    INSERT INTO questions VALUES ('question-1', 'quiz-1', 'MCQ', '["A. 1","B. 2"]', 'B');
  `);
  db = new SqliteD1(sqlite);
});

afterEach(() => sqlite.close());

const claim = (selectedAnswer = 'B') => handleGamificationRoutes(
  new Request('https://test/api/game-state/attendance-claim', {
    method: 'POST',
    headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'student-a',
      quizId: 'quiz-1',
      questionId: 'question-1',
      selectedAnswer,
    }),
  }),
  { DB: db, JWT_SECRET: 'test-secret' } as any,
  '/api/game-state/attendance-claim',
  'POST',
);

describe('attendance reward ledger atomicity', () => {
  it('rejects an incorrect answer before creating any reward state', async () => {
    const response = await claim('A');

    expect(response.status).toBe(400);
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 100 });
    expect(sqlite.prepare(`SELECT total_exp FROM user_pets WHERE username='student-a'`).get()).toEqual({ total_exp: 0 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM attendance_claims`).get()).toEqual({ count: 0 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger`).get()).toEqual({ count: 0 });
  });

  it('keeps an attendance streak across the Sunday-to-Monday week boundary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T17:05:00.000Z'));
    try {
      sqlite.prepare(`INSERT INTO attendance_claims VALUES (?, ?, ?, ?, ?, ?)`).run(
        'att-sunday', 'student-a', '2026-08-16', 50, 50, '2026-08-16T12:00:00.000Z',
      );
      sqlite.prepare(`INSERT INTO attendance_claims VALUES (?, ?, ?, ?, ?, ?)`).run(
        'att-monday', 'student-a', '2026-08-17', 50, 50, '2026-08-17T00:01:00.000Z',
      );

      const response = await handleGamificationRoutes(
        new Request('https://test/api/game-state/attendance-status?username=student-a', {
          headers: { Authorization: 'Bearer test' },
        }),
        { DB: db, JWT_SECRET: 'test-secret' } as any,
        '/api/game-state/attendance-status',
        'GET',
      );
      const payload = await response.json() as any;

      expect(response.status).toBe(200);
      expect(payload.data.claimedToday).toBe(true);
      expect(payload.data.streakDays).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('makes concurrent attendance claims idempotent and awards the stored receipt', async () => {
    const responses = await Promise.all([claim(), claim()]);
    const payloads = await Promise.all(responses.map(response => response.json() as Promise<any>));

    expect(responses.every(response => response.status === 200)).toBe(true);
    expect(payloads.map(payload => payload.alreadyClaimed).sort()).toEqual([false, true]);
    expect(payloads[0].data.awardedCoins).toBe(50);
    expect(payloads[1].data.awardedCoins).toBe(50);
    expect(payloads[0].data.awardedExp).toBe(50);
    expect(payloads[1].data.awardedExp).toBe(50);
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 150 });
    expect(sqlite.prepare(`SELECT total_exp FROM user_pets WHERE username='student-a'`).get()).toEqual({ total_exp: 50 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM attendance_claims WHERE claim_date=?`).get(today))
      .toEqual({ count: 1 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger
      WHERE source_type='DAILY_ATTENDANCE' AND source_key=?`).get(today)).toEqual({ count: 1 });
  });
});

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

const call = (path: string, method: string, body?: unknown) => handleGamificationRoutes(
  new Request(`https://test${path}`, {
    method,
    headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }),
  { DB: db, JWT_SECRET: 'test-secret' } as any,
  new URL(`https://test${path}`).pathname,
  method,
);

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE students (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      class_id TEXT NOT NULL,
      coins INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT DEFAULT ''
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
      created_at TEXT NOT NULL,
      UNIQUE(username, claim_date)
    );
    CREATE TABLE class_attendance_settings (
      class_id TEXT PRIMARY KEY,
      is_enabled INTEGER NOT NULL DEFAULT 0,
      updated_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE class_attendance_questions (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT '',
      question_text TEXT NOT NULL,
      question_rich_text TEXT,
      options_json TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      image_url TEXT,
      image_alt TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE attendance_attempts (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      username TEXT NOT NULL,
      class_id TEXT NOT NULL,
      attempt_date TEXT NOT NULL,
      status TEXT NOT NULL,
      correct_count INTEGER NOT NULL DEFAULT 0,
      total_questions INTEGER NOT NULL DEFAULT 2,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      UNIQUE(student_id, attempt_date)
    );
    CREATE TABLE attendance_attempt_items (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL,
      question_id TEXT,
      position INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      question_rich_text TEXT,
      options_json TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      image_url TEXT,
      image_alt TEXT,
      selected_answer TEXT,
      is_correct INTEGER,
      answered_at TEXT,
      UNIQUE(attempt_id, position)
    );

    INSERT INTO students VALUES ('student-a', 'student-a', 'An', 'class-a', 100, '');
    INSERT INTO user_pets(username, total_exp) VALUES ('student-a', 0);
    INSERT INTO class_attendance_settings
      VALUES ('class-a', 1, 'teacher-a', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
    INSERT INTO class_attendance_questions VALUES
      ('q1', 'class-a', 'Toán', '1 + 1?', NULL, '["1","2","3","4"]', 'B', NULL, NULL, 1, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
      ('q2', 'class-a', 'Toán', '2 + 2?', NULL, '["1","2","3","4"]', 'D', NULL, NULL, 1, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
  `);
  db = new SqliteD1(sqlite);
});

afterEach(() => sqlite.close());

describe('attendance reward ledger atomicity', () => {
  it('retires the legacy one-question claim without changing reward state', async () => {
    const response = await call('/api/game-state/attendance-claim', 'POST', {
      username: 'student-a',
      quizId: 'quiz-1',
      questionId: 'question-1',
      selectedAnswer: 'B',
    });

    expect(response.status).toBe(410);
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 100 });
    expect(sqlite.prepare(`SELECT total_exp FROM user_pets WHERE username='student-a'`).get()).toEqual({ total_exp: 0 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM attendance_claims`).get()).toEqual({ count: 0 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger`).get()).toEqual({ count: 0 });
  });

  it('keeps an attendance streak across the Sunday-to-Monday week boundary with fixed reward preview', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-16T17:05:00.000Z'));
    try {
      sqlite.prepare(`INSERT INTO attendance_claims VALUES (?, ?, ?, ?, ?, ?)`).run(
        'att-sunday', 'student-a', '2026-08-16', 10, 5, '2026-08-16T12:00:00.000Z',
      );
      sqlite.prepare(`INSERT INTO attendance_claims VALUES (?, ?, ?, ?, ?, ?)`).run(
        'att-monday', 'student-a', '2026-08-17', 10, 5, '2026-08-17T00:01:00.000Z',
      );

      const response = await call('/api/game-state/attendance-status?username=student-a', 'GET');
      const payload = await response.json() as any;

      expect(response.status).toBe(200);
      expect(payload.data.claimedToday).toBe(true);
      expect(payload.data.streakDays).toBe(2);
      expect(payload.data.nextRewardCoins).toBe(5);
      expect(payload.data.nextRewardExp).toBe(10);
    } finally {
      vi.useRealTimers();
    }
  });

  it('makes repeated final-answer submissions idempotent and awards only 5 Xu / 10 EXP', async () => {
    const start = await call('/api/game-state/attendance-start', 'POST', { username: 'student-a' });
    const started = await start.json() as any;
    const [firstItem, secondItem] = started.data.items;

    const first = await call('/api/game-state/attendance-answer', 'POST', {
      username: 'student-a',
      attemptId: started.data.attemptId,
      itemId: firstItem.id,
      selectedAnswer: 'A',
    });
    expect(first.status).toBe(200);

    const responses = await Promise.all([
      call('/api/game-state/attendance-answer', 'POST', {
        username: 'student-a',
        attemptId: started.data.attemptId,
        itemId: secondItem.id,
        selectedAnswer: 'A',
      }),
      call('/api/game-state/attendance-answer', 'POST', {
        username: 'student-a',
        attemptId: started.data.attemptId,
        itemId: secondItem.id,
        selectedAnswer: 'A',
      }),
    ]);
    const payloads = await Promise.all(responses.map(response => response.json() as Promise<any>));

    expect(responses.every(response => response.status === 200)).toBe(true);
    expect(payloads.every(payload => payload.data.completed === true)).toBe(true);
    expect(payloads.every(payload => payload.data.awardedCoins === 5)).toBe(true);
    expect(payloads.every(payload => payload.data.awardedExp === 10)).toBe(true);
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 105 });
    expect(sqlite.prepare(`SELECT total_exp FROM user_pets WHERE username='student-a'`).get()).toEqual({ total_exp: 10 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM attendance_claims WHERE claim_date=?`).get(today))
      .toEqual({ count: 1 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger
      WHERE source_type='DAILY_ATTENDANCE' AND source_key=?`).get(today)).toEqual({ count: 1 });
  });
});

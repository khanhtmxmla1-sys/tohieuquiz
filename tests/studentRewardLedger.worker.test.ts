// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { applyStudentReward } from '../workers/src/gamification/studentRewardLedger';

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
    PRAGMA foreign_keys = ON;
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
    CREATE TRIGGER trg_student_reward_ledger_nonnegative_wallet
    BEFORE INSERT ON student_reward_ledger
    WHEN NEW.coins_delta < 0
      AND COALESCE((SELECT coins FROM students WHERE id = NEW.student_id), 0) + NEW.coins_delta < 0
    BEGIN
      SELECT RAISE(ABORT, 'INSUFFICIENT_COIN_BALANCE');
    END;
    CREATE TABLE reward_side_effect (
      id TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    );
    INSERT INTO students(id, username, coins) VALUES ('student-a', 'student-a', 100);
    INSERT INTO user_pets(username, level, exp, exp_to_next, total_exp)
      VALUES ('student-a', 1, 0, 100, 0);
  `);
  db = new SqliteD1(sqlite);
});

afterEach(() => sqlite.close());

const reward = (sourceKey: string, coinsDelta = 15, expDelta = 60, extraStatements: any[] = []) =>
  applyStudentReward(db as any, {
    studentId: 'student-a',
    username: 'student-a',
    sourceType: 'QUIZ_RESULT',
    sourceKey,
    rewardType: 'COINS_EXP',
    coinsDelta,
    expDelta,
    payload: { resultId: sourceKey },
    extraStatements,
  });

describe('student reward ledger atomicity', () => {
  it('makes concurrent replay of the same source idempotent', async () => {
    const [first, second] = await Promise.all([reward('result-1'), reward('result-1')]);

    expect([first.alreadyClaimed, second.alreadyClaimed].sort()).toEqual([false, true]);
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 115 });
    expect(sqlite.prepare(`SELECT total_exp, level, exp, exp_to_next FROM user_pets WHERE username='student-a'`).get())
      .toEqual({ total_exp: 60, level: 1, exp: 60, exp_to_next: 100 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger`).get()).toEqual({ count: 1 });
  });

  it('adds different rewards without losing coins or EXP', async () => {
    await Promise.all([
      reward('result-1', 15, 60),
      reward('result-2', 25, 70),
    ]);

    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 140 });
    expect(sqlite.prepare(`SELECT total_exp, level, exp, exp_to_next FROM user_pets WHERE username='student-a'`).get())
      .toEqual({ total_exp: 130, level: 2, exp: 30, exp_to_next: 120 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger`).get()).toEqual({ count: 2 });
  });

  it('rejects a negative reward that would make the wallet negative', async () => {
    await expect(reward('purchase-too-expensive', -120, 0)).rejects.toThrow(/INSUFFICIENT_COIN_BALANCE/);
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 100 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger`).get()).toEqual({ count: 0 });
  });

  it('rolls back ledger, wallet, EXP and side effects when any statement fails', async () => {
    const extraStatements = [
      db.prepare(`INSERT INTO reward_side_effect(id, value) VALUES (?, ?)`).bind('ok', 1),
      db.prepare(`INSERT INTO missing_table(id) VALUES (?)`).bind('boom'),
    ];

    await expect(reward('result-fail', 15, 60, extraStatements)).rejects.toThrow();

    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 100 });
    expect(sqlite.prepare(`SELECT total_exp FROM user_pets WHERE username='student-a'`).get()).toEqual({ total_exp: 0 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger`).get()).toEqual({ count: 0 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM reward_side_effect`).get()).toEqual({ count: 0 });
  });
});

// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  awardClosedLiveExamRewards,
  calculateLiveExamRewardAmounts,
  retryMissingClosedLiveExamRewards,
} from '../workers/src/gamification/liveExamReward';

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
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      coins INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE user_pets (
      username TEXT PRIMARY KEY,
      pet_id TEXT DEFAULT 'cat_01', pet_name TEXT DEFAULT 'Mèo Con',
      level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, exp_to_next INTEGER DEFAULT 100,
      total_exp INTEGER NOT NULL DEFAULT 0, mood TEXT DEFAULT 'happy',
      items TEXT DEFAULT '[]', last_active TEXT DEFAULT ''
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
    CREATE TABLE live_exam_sessions (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      closed_at TEXT,
      archived_at TEXT
    );
    CREATE TABLE live_exam_participants (
      id TEXT PRIMARY KEY,
      live_exam_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      username TEXT NOT NULL,
      score REAL,
      rank INTEGER,
      correct_count INTEGER DEFAULT 0,
      wrong_count INTEGER DEFAULT 0,
      submitted_at TEXT
    );
    INSERT INTO students VALUES
      ('student-a', 'student-a', 100),
      ('student-b', 'student-b', 20),
      ('student-old', 'student-old', 10);
    INSERT INTO user_pets(username, total_exp) VALUES
      ('student-a', 0), ('student-b', 0), ('student-old', 0);
    INSERT INTO live_exam_sessions VALUES
      ('session-1', 'closed', '2026-08-11T07:00:00.000Z', NULL),
      ('session-old', 'closed', '2026-08-06T13:29:07.885Z', NULL);
    INSERT INTO live_exam_participants VALUES
      ('p-a', 'session-1', 'student-a', 'student-a', 9.8, 1, 10, 0, '2026-08-11T07:00:00.000Z'),
      ('p-b', 'session-1', 'student-b', 'student-b', 7.4, 6, 7, 3, '2026-08-11T07:01:00.000Z'),
      ('p-old', 'session-old', 'student-old', 'student-old', 8.0, 1, 8, 2, '2026-08-06T13:28:36.804Z');
  `);
  db = new SqliteD1(sqlite);
});

afterEach(() => sqlite.close());

describe('live exam reward ledger', () => {
  it('uses the approved floored score and rank bonus policy', () => {
    expect(calculateLiveExamRewardAmounts({ score: 9.8, rank: 1 })).toEqual({
      baseCoins: 9,
      bonusCoins: 500,
      coins: 509,
      exp: 98,
    });
    expect(calculateLiveExamRewardAmounts({ score: 7.4, rank: 6 })).toEqual({
      baseCoins: 7,
      bonusCoins: 50,
      coins: 57,
      exp: 74,
    });
  });

  it('awards a closed session exactly once even when close/recovery runs again', async () => {
    await awardClosedLiveExamRewards(db as any, 'session-1');
    await awardClosedLiveExamRewards(db as any, 'session-1');

    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 609 });
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-b'`).get()).toEqual({ coins: 77 });
    expect(sqlite.prepare(`SELECT total_exp FROM user_pets WHERE username='student-a'`).get()).toEqual({ total_exp: 98 });
    expect(sqlite.prepare(`SELECT total_exp FROM user_pets WHERE username='student-b'`).get()).toEqual({ total_exp: 74 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger WHERE source_type='LIVE_EXAM'`).get())
      .toEqual({ count: 2 });
    expect(sqlite.prepare(`SELECT coins_delta, exp_delta FROM student_reward_ledger
      WHERE student_id='student-a' AND source_type='LIVE_EXAM' AND source_key='session-1'`).get())
      .toEqual({ coins_delta: 509, exp_delta: 98 });
  });

  it('refuses to award before the session is closed', async () => {
    sqlite.exec(`UPDATE live_exam_sessions SET status='active' WHERE id='session-1'`);
    await expect(awardClosedLiveExamRewards(db as any, 'session-1')).rejects.toThrow(/closed/i);
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger`).get()).toEqual({ count: 0 });
  });

  it('retries only sessions closed after the reward-ledger rollout cutoff', async () => {
    const processed = await retryMissingClosedLiveExamRewards(db as any);

    expect(processed).toBe(1);
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger
      WHERE source_type='LIVE_EXAM' AND source_key='session-1'`).get()).toEqual({ count: 2 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger
      WHERE source_type='LIVE_EXAM' AND source_key='session-old'`).get()).toEqual({ count: 0 });
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-old'`).get()).toEqual({ coins: 10 });
  });
});

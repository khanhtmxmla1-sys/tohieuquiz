// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleResultRewardClaim } from '../workers/src/gamification/resultRewardClaim';

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
  failAtStatement: number | null = null;
  constructor(readonly sqlite: DatabaseSync) {}
  prepare(sql: string) { return new Statement(sql, this.sqlite); }
  async batch(statements: Statement[]) {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map((statement, index) => {
        const result = statement.runSync();
        if (this.failAtStatement === index) throw new Error('forced batch failure');
        return result;
      });
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
    CREATE TABLE results (
      id TEXT PRIMARY KEY,
      student_id TEXT,
      class_id TEXT,
      score REAL DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      total_questions INTEGER DEFAULT 0
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
    INSERT INTO students VALUES
      ('student-a', 'student-a', 100),
      ('student-b', 'student-b', 50);
    INSERT INTO results VALUES
      ('result-1', 'student-a', 'class-a', 8, 8, 10),
      ('result-other', 'student-b', 'class-a', 10, 10, 10);
    INSERT INTO user_pets(username, total_exp) VALUES ('student-a', 0), ('student-b', 0);
  `);
  db = new SqliteD1(sqlite);
});

afterEach(() => sqlite.close());

const claim = (resultId = 'result-1') => handleResultRewardClaim(db as any, { resultId }, 'student-a');

describe('result reward claim', () => {
  it('calculates and applies the saved result reward atomically', async () => {
    const response = await claim();
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      awardedExp: 60,
      awardedCoins: 15,
      newCoins: 115,
      newLevel: 1,
      newExp: 60,
      alreadyClaimed: false,
    });
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 115 });
    expect(sqlite.prepare(`SELECT coins_delta, exp_delta FROM student_reward_ledger
      WHERE student_id='student-a' AND source_type='QUIZ_RESULT' AND source_key='result-1'`).get())
      .toEqual({ coins_delta: 15, exp_delta: 60 });
  });

  it('returns the stored ledger receipt without applying the reward twice', async () => {
    await claim();
    const response = await claim();
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      alreadyClaimed: true,
      awardedExp: 60,
      awardedCoins: 15,
      newCoins: 115,
      newExp: 60,
    });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger`).get()).toEqual({ count: 1 });
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 115 });
  });

  it('rolls back a partial batch so retry can safely award later', async () => {
    db.failAtStatement = 1;
    const failed = await claim();
    expect(failed.status).toBe(500);
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 100 });
    expect(sqlite.prepare(`SELECT total_exp FROM user_pets WHERE username='student-a'`).get()).toEqual({ total_exp: 0 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger`).get()).toEqual({ count: 0 });

    db.failAtStatement = null;
    const retry = await claim();
    expect(retry.status).toBe(200);
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 115 });
  });

  it('creates a default pet inside the same transaction when needed', async () => {
    sqlite.exec(`DELETE FROM user_pets WHERE username='student-a'`);

    const response = await claim();
    expect(response.status).toBe(200);
    expect(sqlite.prepare(`SELECT level, exp, exp_to_next, total_exp FROM user_pets WHERE username='student-a'`).get())
      .toEqual({ level: 1, exp: 60, exp_to_next: 100, total_exp: 60 });
  });

  it('rejects a result owned by another student', async () => {
    const response = await claim('result-other');
    expect(response.status).toBe(403);
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger`).get()).toEqual({ count: 0 });
  });

  it('returns 404 when the saved result does not exist', async () => {
    const response = await claim('missing');
    expect(response.status).toBe(404);
  });
});

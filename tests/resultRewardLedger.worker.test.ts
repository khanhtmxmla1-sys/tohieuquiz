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
    CREATE TABLE classes (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE students (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      class_id TEXT,
      full_name TEXT NOT NULL,
      coins INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE results (
      id TEXT PRIMARY KEY,
      student_id TEXT,
      class_id TEXT,
      student_name TEXT NOT NULL,
      class_name TEXT DEFAULT '',
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

    INSERT INTO classes VALUES ('class-a', '5A');
    INSERT INTO students VALUES
      ('student-a', 'student-a', 'class-a', 'Nguyễn Văn An', 100),
      ('student-b', 'student-b', 'class-a', 'Trần Bình', 50);
    INSERT INTO user_pets(username, total_exp) VALUES ('student-a', 0), ('student-b', 0);
    INSERT INTO results VALUES
      ('result-1', 'student-a', 'class-a', 'Nguyễn Văn An', '5A', 8, 8, 10),
      ('result-2', 'student-a', 'class-a', 'Nguyễn Văn An', '5A', 10, 10, 10),
      ('result-other', 'student-b', 'class-a', 'Trần Bình', '5A', 10, 10, 10);
  `);
  db = new SqliteD1(sqlite);
});

afterEach(() => sqlite.close());

const claim = (resultId: string) => handleResultRewardClaim(db as any, { resultId }, 'student-a');

describe('result rewards use canonical ledger deltas', () => {
  it('adds two different result rewards without losing coins or EXP', async () => {
    const [first, second] = await Promise.all([claim('result-1'), claim('result-2')]);
    const payloads = await Promise.all([first.json() as Promise<any>, second.json() as Promise<any>]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(payloads.map(payload => payload.data.awardedCoins).sort((a, b) => a - b)).toEqual([15, 30]);
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 145 });
    expect(sqlite.prepare(`SELECT total_exp, level, exp, exp_to_next FROM user_pets WHERE username='student-a'`).get())
      .toEqual({ total_exp: 150, level: 2, exp: 50, exp_to_next: 120 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger WHERE source_type='QUIZ_RESULT'`).get())
      .toEqual({ count: 2 });
  });

  it('makes concurrent replay of one result idempotent', async () => {
    const responses = await Promise.all([claim('result-1'), claim('result-1')]);
    const payloads = await Promise.all(responses.map(response => response.json() as Promise<any>));

    expect(responses.every(response => response.status === 200)).toBe(true);
    expect(payloads.map(payload => payload.data.alreadyClaimed).sort()).toEqual([false, true]);
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 115 });
    expect(sqlite.prepare(`SELECT total_exp FROM user_pets WHERE username='student-a'`).get()).toEqual({ total_exp: 60 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger WHERE source_key='result-1'`).get())
      .toEqual({ count: 1 });
  });

  it('rejects a result owned by another student without writing a ledger entry', async () => {
    const response = await claim('result-other');
    expect(response.status).toBe(403);
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger`).get()).toEqual({ count: 0 });
  });
});

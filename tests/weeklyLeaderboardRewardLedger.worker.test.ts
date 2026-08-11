// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getCurrentWeekKey, getWeekUtcRange } from '../workers/src/gameLoop/dateKeys';
import { awardWeeklyLeaderboardRewards } from '../workers/src/gamification/weeklyLeaderboardReward';

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
const weekKey = getCurrentWeekKey();
const { startIso } = getWeekUtcRange(weekKey);
const first = new Date(new Date(startIso).getTime() + 60_000).toISOString();
const second = new Date(new Date(startIso).getTime() + 120_000).toISOString();

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE students (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, coins INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE results (
      id TEXT PRIMARY KEY, student_id TEXT, score REAL, correct_count INTEGER, submitted_at TEXT NOT NULL
    );
    CREATE TABLE user_pets (
      username TEXT PRIMARY KEY, pet_id TEXT DEFAULT 'cat_01', pet_name TEXT DEFAULT 'Mèo Con',
      level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, exp_to_next INTEGER DEFAULT 100,
      total_exp INTEGER NOT NULL DEFAULT 0, mood TEXT DEFAULT 'happy', items TEXT DEFAULT '[]', last_active TEXT DEFAULT ''
    );
    CREATE TABLE student_reward_ledger (
      id TEXT PRIMARY KEY, student_id TEXT NOT NULL, source_type TEXT NOT NULL, source_key TEXT NOT NULL,
      reward_type TEXT NOT NULL, coins_delta INTEGER NOT NULL DEFAULT 0, exp_delta INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL,
      UNIQUE(student_id, source_type, source_key)
    );
    CREATE TABLE student_achievement_unlocks (
      id TEXT PRIMARY KEY, username TEXT NOT NULL, achievement_code TEXT NOT NULL,
      unlocked_at TEXT NOT NULL, metadata TEXT,
      UNIQUE(username, achievement_code)
    );
    CREATE TABLE leaderboard_rewards_history (
      id TEXT PRIMARY KEY, username TEXT NOT NULL, period TEXT NOT NULL, period_key TEXT NOT NULL,
      rank INTEGER NOT NULL, coins_awarded INTEGER DEFAULT 0, badge_code TEXT, awarded_at TEXT NOT NULL
    );
    INSERT INTO students VALUES
      ('a','a',0),('b','b',0),('c','c',0),('d','d',0);
    INSERT INTO user_pets(username,total_exp) VALUES ('a',0),('b',0),('c',0),('d',0);
    INSERT INTO results VALUES
      ('a1','a',10,10,'${first}'),
      ('b1','b',10,9,'${first}'),
      ('c1','c',10,9,'${second}'),
      ('d1','d',9,10,'${first}');
  `);
  db = new SqliteD1(sqlite);
});

afterEach(() => sqlite.close());

describe('weekly leaderboard reward ledger', () => {
  it('uses stable tie-breaks and awards only top three once', async () => {
    const firstRun = await awardWeeklyLeaderboardRewards(db as any, weekKey);
    const secondRun = await awardWeeklyLeaderboardRewards(db as any, weekKey);

    expect(firstRun.map(item => [item.studentId, item.rank, item.alreadyClaimed])).toEqual([
      ['a', 1, false],
      ['b', 2, false],
      ['c', 3, false],
    ]);
    expect(secondRun.map(item => item.alreadyClaimed)).toEqual([true, true, true]);
    expect(sqlite.prepare(`SELECT id, coins FROM students ORDER BY id`).all()).toEqual([
      { id: 'a', coins: 500 },
      { id: 'b', coins: 300 },
      { id: 'c', coins: 150 },
      { id: 'd', coins: 0 },
    ]);
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger WHERE source_type='WEEKLY_LEADERBOARD'`).get())
      .toEqual({ count: 3 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM leaderboard_rewards_history`).get())
      .toEqual({ count: 3 });
  });
});

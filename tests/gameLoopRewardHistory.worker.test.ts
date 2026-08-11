// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { getRecentRewards } from '../workers/src/gameLoop/rewardService';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, private readonly db: DatabaseSync) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async all<T>() { return { results: this.db.prepare(this.sql).all(...this.bindings as any[]) as T[] }; }
}
class SqliteD1 {
  constructor(readonly sqlite: DatabaseSync) {}
  prepare(sql: string) { return new Statement(sql, this.sqlite); }
}

let sqlite: DatabaseSync | null = null;
afterEach(() => { sqlite?.close(); sqlite = null; });

describe('game-loop reward history', () => {
  it('reads immutable reward ledger and hides opening-balance bookkeeping', async () => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE students (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL);
      CREATE TABLE student_reward_ledger (
        id TEXT PRIMARY KEY, student_id TEXT NOT NULL, source_type TEXT NOT NULL,
        source_key TEXT NOT NULL, reward_type TEXT NOT NULL, coins_delta INTEGER NOT NULL,
        exp_delta INTEGER NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL
      );
      INSERT INTO students VALUES ('student-a', 'student-a');
      INSERT INTO student_reward_ledger VALUES
        ('opening','student-a','BALANCE_OPENING','0066','COINS',100,0,'{}','2026-08-11T00:00:00.000Z'),
        ('mission','student-a','DAILY_MISSION','2026-08-11:daily_questions','COINS',30,0,'{"missionId":"daily_questions","coins":30}','2026-08-11T01:00:00.000Z'),
        ('quiz','student-a','QUIZ_RESULT','result-1','COINS_EXP',15,60,'{"resultId":"result-1","awardedCoins":15,"awardedExp":60}','2026-08-11T02:00:00.000Z');
    `);

    const rewards = await getRecentRewards(new SqliteD1(sqlite) as any, 'student-a');
    expect(rewards).toEqual([
      {
        eventType: 'QUIZ_RESULT', rewardType: 'COINS_EXP',
        payload: { resultId: 'result-1', awardedCoins: 15, awardedExp: 60 },
        createdAt: '2026-08-11T02:00:00.000Z',
      },
      {
        eventType: 'DAILY_MISSION', rewardType: 'COINS',
        payload: { missionId: 'daily_questions', coins: 30 },
        createdAt: '2026-08-11T01:00:00.000Z',
      },
    ]);
  });
});

// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../workers/src/gameLoop/dashboardService', () => ({
  buildDashboardResponse: vi.fn(async (db: any, username: string) => {
    const row = await db.prepare('SELECT coins FROM students WHERE username = ?').bind(username).first<any>();
    return { wallet: { coins: Number(row?.coins) || 0 } };
  }),
}));

import { getCurrentDateKey, getCurrentWeekKey } from '../workers/src/gameLoop/dateKeys';
import { handleClaimMissionRoute } from '../workers/src/routes/gameLoop/claimMissionRoute';
import { handleClaimChestRoute } from '../workers/src/routes/gameLoop/claimChestRoute';
import { handleClaimWeeklyQuestRoute } from '../workers/src/routes/gameLoop/claimWeeklyQuestRoute';

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
const username = 'student-a';
const studentId = 'student-a';
const dateKey = getCurrentDateKey();
const weekKey = getCurrentWeekKey();
const now = '2026-08-11T04:00:00.000Z';

const post = (path: string, body: Record<string, unknown>) => new Request(`https://test${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

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
    CREATE TABLE student_reward_events (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      event_type TEXT NOT NULL,
      reward_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE student_game_profiles (
      username TEXT PRIMARY KEY,
      daily_streak INTEGER NOT NULL DEFAULT 0,
      last_mission_completion_date TEXT DEFAULT '',
      hint_tokens INTEGER NOT NULL DEFAULT 0,
      streak_shields INTEGER NOT NULL DEFAULT 0,
      collection_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE student_daily_progress (
      username TEXT NOT NULL,
      progress_date TEXT NOT NULL,
      questions_answered INTEGER NOT NULL DEFAULT 0,
      correct_answers INTEGER NOT NULL DEFAULT 0,
      quizzes_completed INTEGER NOT NULL DEFAULT 0,
      toan_quizzes_completed INTEGER NOT NULL DEFAULT 0,
      tieng_viet_quizzes_completed INTEGER NOT NULL DEFAULT 0,
      mission_questions_claimed INTEGER NOT NULL DEFAULT 0,
      mission_accuracy_claimed INTEGER NOT NULL DEFAULT 0,
      mission_subject_claimed INTEGER NOT NULL DEFAULT 0,
      chest_claimed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(username, progress_date)
    );
    CREATE TABLE student_weekly_progress (
      username TEXT NOT NULL,
      week_key TEXT NOT NULL,
      quest_id TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      target INTEGER NOT NULL,
      claimed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(username, week_key, quest_id)
    );
    CREATE TABLE shop_items (
      item_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL
    );
    INSERT INTO students(id, username, coins) VALUES ('${studentId}', '${username}', 100);
    INSERT INTO user_pets(username, total_exp) VALUES ('${username}', 0);
    INSERT INTO student_game_profiles(username, created_at, updated_at)
      VALUES ('${username}', '${now}', '${now}');
    INSERT INTO student_daily_progress(
      username, progress_date, questions_answered, correct_answers,
      quizzes_completed, toan_quizzes_completed, tieng_viet_quizzes_completed,
      mission_questions_claimed, mission_accuracy_claimed, mission_subject_claimed,
      chest_claimed, created_at, updated_at
    ) VALUES (
      '${username}', '${dateKey}', 20, 20, 2, 1, 1,
      0, 0, 0, 0, '${now}', '${now}'
    );
    INSERT INTO student_weekly_progress(
      username, week_key, quest_id, progress, target, claimed, created_at, updated_at
    ) VALUES (
      '${username}', '${weekKey}', 'weekly_100_correct', 100, 100, 0, '${now}', '${now}'
    );
    INSERT INTO shop_items(item_id, name, type)
      VALUES ('accessory-crown', 'Vương miện thú cưng', 'ACCESSORY');
  `);
  db = new SqliteD1(sqlite);
});

afterEach(() => {
  vi.restoreAllMocks();
  sqlite.close();
});

describe('game-loop claim routes use the canonical reward ledger', () => {
  it('makes concurrent daily mission claims idempotent', async () => {
    const responses = await Promise.all([
      handleClaimMissionRoute(post('/api/game-loop/claim-mission', { missionId: 'daily_questions' }), db as any, username),
      handleClaimMissionRoute(post('/api/game-loop/claim-mission', { missionId: 'daily_questions' }), db as any, username),
    ]);
    const payloads = await Promise.all(responses.map(response => response.json() as Promise<any>));

    expect(responses.every(response => response.status === 200)).toBe(true);
    expect(payloads.map(payload => payload.alreadyClaimed).sort()).toEqual([false, true]);
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='${studentId}'`).get()).toEqual({ coins: 130 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger
      WHERE source_type='DAILY_MISSION' AND source_key='${dateKey}:daily_questions'`).get()).toEqual({ count: 1 });
  });

  it('makes concurrent chest claims return the same stored reward', async () => {
    sqlite.exec(`UPDATE student_daily_progress SET
      mission_questions_claimed=1, mission_accuracy_claimed=1, mission_subject_claimed=1
      WHERE username='${username}' AND progress_date='${dateKey}'`);
    vi.spyOn(Math, 'random').mockReturnValue(0.7);

    const responses = await Promise.all([
      handleClaimChestRoute(post('/api/game-loop/claim-chest', {}), db as any, username),
      handleClaimChestRoute(post('/api/game-loop/claim-chest', {}), db as any, username),
    ]);
    const payloads = await Promise.all(responses.map(response => response.json() as Promise<any>));

    expect(responses.every(response => response.status === 200)).toBe(true);
    expect(payloads.map(payload => payload.alreadyClaimed).sort()).toEqual([false, true]);
    expect(payloads[0].reward).toEqual(payloads[1].reward);
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='${studentId}'`).get()).toEqual({ coins: 145 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger
      WHERE source_type='DAILY_CHEST' AND source_key='${dateKey}'`).get()).toEqual({ count: 1 });
  });

  it('makes concurrent weekly quest claims idempotent', async () => {
    const responses = await Promise.all([
      handleClaimWeeklyQuestRoute(post('/api/game-loop/claim-weekly-quest', { questId: 'weekly_100_correct' }), db as any, username),
      handleClaimWeeklyQuestRoute(post('/api/game-loop/claim-weekly-quest', { questId: 'weekly_100_correct' }), db as any, username),
    ]);
    const payloads = await Promise.all(responses.map(response => response.json() as Promise<any>));

    expect(responses.every(response => response.status === 200)).toBe(true);
    expect(payloads.map(payload => payload.alreadyClaimed).sort()).toEqual([false, true]);
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='${studentId}'`).get()).toEqual({ coins: 250 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger
      WHERE source_type='WEEKLY_QUEST' AND source_key='${weekKey}:weekly_100_correct'`).get()).toEqual({ count: 1 });
  });

  it('grants exactly one real pet accessory for weekly_subject_master', async () => {
    sqlite.prepare(`INSERT INTO student_weekly_progress
      (username, week_key, quest_id, progress, target, claimed, created_at, updated_at)
      VALUES (?, ?, 'weekly_subject_master', 3, 3, 0, ?, ?)`)
      .run(username, weekKey, now, now);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const response = await handleClaimWeeklyQuestRoute(
      post('/api/game-loop/claim-weekly-quest', { questId: 'weekly_subject_master' }),
      db as any,
      username,
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.reward.items).toEqual([
      { type: 'pet_accessory', quantity: 1, itemId: 'accessory-crown', title: 'Vương miện thú cưng' },
    ]);
    expect(sqlite.prepare(`SELECT items FROM user_pets WHERE username=?`).get(username)).toEqual({
      items: '["accessory-crown"]',
    });
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id=?`).get(studentId)).toEqual({ coins: 350 });
  });

  it('grants one hint token and one streak shield for weekly_perfect_streak', async () => {
    sqlite.prepare(`INSERT INTO student_weekly_progress
      (username, week_key, quest_id, progress, target, claimed, created_at, updated_at)
      VALUES (?, ?, 'weekly_perfect_streak', 3, 3, 0, ?, ?)`)
      .run(username, weekKey, now, now);

    const response = await handleClaimWeeklyQuestRoute(
      post('/api/game-loop/claim-weekly-quest', { questId: 'weekly_perfect_streak' }),
      db as any,
      username,
    );
    expect(response.status).toBe(200);
    expect(sqlite.prepare(`SELECT hint_tokens, streak_shields FROM student_game_profiles WHERE username=?`).get(username))
      .toEqual({ hint_tokens: 1, streak_shields: 1 });
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id=?`).get(studentId)).toEqual({ coins: 500 });
  });
});

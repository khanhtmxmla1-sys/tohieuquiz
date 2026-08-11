// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const migrationPath = 'workers/migrations/0066_student_reward_ledger.sql';
let db: DatabaseSync | null = null;

const setupLegacyDb = () => {
  db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE students (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      class_id TEXT,
      coins INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE user_pets (
      username TEXT PRIMARY KEY,
      pet_id TEXT DEFAULT 'cat_01',
      pet_name TEXT DEFAULT 'Mèo Con',
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      exp_to_next INTEGER DEFAULT 100,
      mood TEXT DEFAULT 'happy',
      items TEXT DEFAULT '[]',
      image_url TEXT DEFAULT '',
      last_active TEXT DEFAULT ''
    );
    CREATE TABLE reward_receipts (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      activity_id TEXT NOT NULL,
      reward_exp INTEGER NOT NULL DEFAULT 0,
      reward_coins INTEGER NOT NULL DEFAULT 0,
      new_level INTEGER NOT NULL DEFAULT 1,
      new_exp INTEGER NOT NULL DEFAULT 0,
      new_exp_to_next INTEGER NOT NULL DEFAULT 100,
      new_coins INTEGER NOT NULL DEFAULT 0,
      leveled_up INTEGER NOT NULL DEFAULT 0,
      mood TEXT NOT NULL DEFAULT 'excited',
      created_at TEXT NOT NULL,
      UNIQUE(username, activity_type, activity_id)
    );
    CREATE TABLE attendance_claims (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      claim_date TEXT NOT NULL,
      reward_exp INTEGER NOT NULL,
      reward_coins INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE student_daily_progress (
      username TEXT NOT NULL,
      progress_date TEXT NOT NULL,
      mission_questions_claimed INTEGER NOT NULL DEFAULT 0,
      mission_accuracy_claimed INTEGER NOT NULL DEFAULT 0,
      mission_subject_claimed INTEGER NOT NULL DEFAULT 0,
      chest_claimed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(username, progress_date)
    );
    CREATE TABLE student_weekly_progress (
      username TEXT NOT NULL,
      week_key TEXT NOT NULL,
      quest_id TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      target INTEGER NOT NULL,
      claimed INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(username, week_key, quest_id)
    );
    CREATE TABLE leaderboard_rewards_history (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      period TEXT NOT NULL,
      period_key TEXT NOT NULL,
      rank INTEGER NOT NULL,
      coins_awarded INTEGER DEFAULT 0,
      badge_code TEXT,
      awarded_at TEXT NOT NULL
    );
    CREATE TABLE gift_wallet_ledger (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      delta_coins INTEGER NOT NULL,
      reason TEXT NOT NULL,
      ref_order_id TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE gift_orders (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      price_coins INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      cancelled_at TEXT NOT NULL DEFAULT ''
    );

    INSERT INTO students(id, username, class_id, coins) VALUES
      ('student-a', 'student-a', 'class-a', 420),
      ('student-b', 'student-b', 'class-a', 75);
    INSERT INTO user_pets(username, level, exp, exp_to_next) VALUES
      ('student-a', 3, 40, 140),
      ('student-b', 1, 15, 100);
    INSERT INTO reward_receipts(
      id, username, activity_type, activity_id, reward_exp, reward_coins,
      new_level, new_exp, new_exp_to_next, new_coins, leveled_up, mood, created_at
    ) VALUES ('rr-1', 'student-a', 'QUIZ_RESULT', 'result-1', 60, 15, 3, 100, 140, 420, 0, 'excited', '2026-08-10T02:00:00.000Z');
    INSERT INTO attendance_claims VALUES
      ('att-1', 'student-a', '2026-08-10', 50, 50, '2026-08-10T00:00:00.000Z');
    INSERT INTO student_daily_progress(
      username, progress_date, mission_questions_claimed, mission_accuracy_claimed,
      mission_subject_claimed, chest_claimed
    ) VALUES ('student-a', '2026-08-10', 1, 0, 1, 1);
    INSERT INTO student_weekly_progress VALUES
      ('student-a', '2026-W33', 'weekly_20_quizzes', 20, 20, 1, '2026-08-10T00:00:00.000Z', '2026-08-10T00:00:00.000Z');
    INSERT INTO leaderboard_rewards_history VALUES
      ('lr-1', 'student-a', 'weekly', '2026-W32', 1, 500, 'weekly_champion', '2026-08-10T00:00:00.000Z');
    INSERT INTO gift_wallet_ledger VALUES
      ('gw-1', 'student-a', -50, 'PURCHASE', 'order-1', '2026-08-10T00:00:00.000Z');
    INSERT INTO gift_orders(id, student_id, price_coins, status, created_at, cancelled_at)
      VALUES ('order-1', 'student-a', 50, 'PENDING', '2026-08-10T00:00:00.000Z', '');
  `);
  return db;
};

afterEach(() => {
  db?.close();
  db = null;
});

describe('student reward ledger migration', () => {
  it('creates immutable reward identity, opening balances and zero-delta legacy locks', () => {
    const database = setupLegacyDb();
    database.exec(readFileSync(migrationPath, 'utf8'));

    expect(database.prepare(`SELECT coins_delta FROM student_reward_ledger
      WHERE student_id='student-a' AND source_type='BALANCE_OPENING'`).get())
      .toEqual({ coins_delta: 420 });
    expect(database.prepare(`SELECT coins_delta, exp_delta FROM student_reward_ledger
      WHERE student_id='student-a' AND source_type='QUIZ_RESULT' AND source_key='result-1'`).get())
      .toEqual({ coins_delta: 0, exp_delta: 0 });
    expect(database.prepare(`SELECT coins_delta, exp_delta FROM student_reward_ledger
      WHERE student_id='student-a' AND source_type='DAILY_ATTENDANCE' AND source_key='2026-08-10'`).get())
      .toEqual({ coins_delta: 0, exp_delta: 0 });
    expect(database.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger
      WHERE student_id='student-a' AND source_type='DAILY_MISSION'`).get())
      .toEqual({ count: 2 });
    expect(database.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger
      WHERE student_id='student-a' AND source_type='DAILY_CHEST'`).get())
      .toEqual({ count: 1 });
    expect(database.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger
      WHERE student_id='student-a' AND source_type='WEEKLY_QUEST'`).get())
      .toEqual({ count: 1 });
    expect(database.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger
      WHERE student_id='student-a' AND source_type='WEEKLY_LEADERBOARD'`).get())
      .toEqual({ count: 1 });
    expect(database.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger
      WHERE student_id='student-a' AND source_type='GIFT_PURCHASE' AND source_key='order-1'`).get())
      .toEqual({ count: 1 });

    expect(() => database.prepare(`INSERT INTO student_reward_ledger
      (id, student_id, source_type, source_key, reward_type, coins_delta, exp_delta, payload_json, created_at)
      VALUES ('dup', 'student-a', 'QUIZ_RESULT', 'result-1', 'COINS_EXP', 1, 1, '{}', datetime('now'))`).run())
      .toThrow(/UNIQUE/);
    expect(() => database.prepare(`INSERT INTO student_reward_ledger
      (id, student_id, source_type, source_key, reward_type, coins_delta, exp_delta, payload_json, created_at)
      VALUES ('negative', 'student-b', 'PET_SHOP_PURCHASE', 'too-expensive', 'ITEM', -100, 0, '{}', datetime('now'))`).run())
      .toThrow(/INSUFFICIENT_COIN_BALANCE/);
  });

  it('mirrors future gift purchase/refund wallet entries into the canonical ledger', () => {
    const database = setupLegacyDb();
    database.exec(readFileSync(migrationPath, 'utf8'));

    database.prepare(`INSERT INTO gift_wallet_ledger
      (id, student_id, delta_coins, reason, ref_order_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
        'gw-new-purchase', 'student-a', -25, 'PURCHASE', 'order-new', '2026-08-11T04:00:00.000Z',
      );
    database.prepare(`INSERT INTO gift_wallet_ledger
      (id, student_id, delta_coins, reason, ref_order_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(
        'gw-new-refund', 'student-a', 25, 'REFUND', 'order-new-refund', '2026-08-11T04:01:00.000Z',
      );

    expect(database.prepare(`SELECT source_type, source_key, coins_delta FROM student_reward_ledger
      WHERE id='reward-gift-gw-new-purchase'`).get()).toEqual({
        source_type: 'GIFT_PURCHASE', source_key: 'order-new', coins_delta: -25,
      });
    expect(database.prepare(`SELECT source_type, source_key, coins_delta FROM student_reward_ledger
      WHERE id='reward-gift-gw-new-refund'`).get()).toEqual({
        source_type: 'GIFT_REFUND', source_key: 'order-new-refund', coins_delta: 25,
      });
  });

  it('backfills pet total_exp and creates official weekly state tables', () => {
    const database = setupLegacyDb();
    database.exec(readFileSync(migrationPath, 'utf8'));

    expect(database.prepare(`SELECT total_exp FROM user_pets WHERE username='student-a'`).get())
      .toEqual({ total_exp: 260 });
    expect(database.prepare(`SELECT total_exp FROM user_pets WHERE username='student-b'`).get())
      .toEqual({ total_exp: 15 });

    const tables = database.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all()
      .map((row: any) => row.name);
    expect(tables).toContain('student_weekly_progress');
    expect(tables).toContain('leaderboard_rewards_history');
    expect(tables).toContain('student_weekly_subjects');
    expect(tables).toContain('student_weekly_state');
  });
});

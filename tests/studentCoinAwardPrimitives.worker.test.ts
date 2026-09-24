// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  prepareStudentRewardBatch,
  type StudentRewardMutation,
} from '../workers/src/gamification/studentRewardLedger';
import { prepareMandatoryNotificationBatch } from '../workers/src/services/notificationWriter';
import { resolveNotificationTarget } from '../shared/notifications.contract';

class Statement {
  bindings: unknown[] = [];

  constructor(readonly sql: string, private readonly db: DatabaseSync) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  async first<T>() {
    return this.db.prepare(this.sql).get(...this.bindings as any[]) as T;
  }

  async run() {
    return this.db.prepare(this.sql).run(...this.bindings as any[]);
  }

  runSync() {
    return this.db.prepare(this.sql).run(...this.bindings as any[]);
  }
}

class SqliteD1 {
  constructor(readonly sqlite: DatabaseSync) {}

  prepare(sql: string) {
    return new Statement(sql, this.sqlite);
  }

  async batch(statements: Statement[]) {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map((statement) => statement.runSync());
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
    CREATE TABLE notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_role TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      data TEXT NOT NULL,
      priority TEXT NOT NULL,
      severity TEXT NOT NULL,
      source_type TEXT,
      source_id TEXT,
      dedupe_key TEXT,
      action_url TEXT,
      available_at TEXT,
      expires_at TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX notifications_dedupe
      ON notifications(user_id, user_role, dedupe_key)
      WHERE dedupe_key IS NOT NULL;
    INSERT INTO students(id, username, coins) VALUES
      ('s-1', 'a', 0),
      ('s-2', 'b', 0),
      ('s-poor', 'poor', 3);
  `);
  db = new SqliteD1(sqlite);
});

afterEach(() => sqlite.close());

const mutation = (studentId: string, username: string, coinsDelta: number): StudentRewardMutation => ({
  studentId,
  username,
  sourceType: 'MANUAL_AWARD',
  sourceKey: 'batch-1',
  rewardType: 'COINS',
  coinsDelta,
  expDelta: 0,
  payload: { batchId: 'batch-1' },
});

describe('student coin award atomic primitives', () => {
  it('prepares one JSON-backed reward batch for multiple recipients', async () => {
    const prepared = prepareStudentRewardBatch(db as any, [
      mutation('s-1', 'a', 10),
      mutation('s-2', 'b', 10),
    ]);

    expect(prepared.statements).toHaveLength(2);
    await db.batch(prepared.statements as any);

    expect(sqlite.prepare('SELECT id, coins FROM students ORDER BY id').all()).toEqual([
      { id: 's-1', coins: 10 },
      { id: 's-2', coins: 10 },
      { id: 's-poor', coins: 3 },
    ]);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM student_reward_ledger WHERE source_key='batch-1'").get())
      .toEqual({ count: 2 });
  });

  it('rolls back every recipient when one reward violates the wallet trigger', async () => {
    const prepared = prepareStudentRewardBatch(db as any, [
      mutation('s-1', 'a', 10),
      mutation('s-poor', 'poor', -10),
    ]);

    await expect(db.batch(prepared.statements as any)).rejects.toThrow(/INSUFFICIENT_COIN_BALANCE/);
    expect(sqlite.prepare('SELECT coins FROM students ORDER BY id').all()).toEqual([
      { coins: 0 },
      { coins: 0 },
      { coins: 3 },
    ]);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM student_reward_ledger').get()).toEqual({ count: 0 });
  });

  it('rejects duplicate recipients before preparing a batch', () => {
    expect(() => prepareStudentRewardBatch(db as any, [
      mutation('s-1', 'a', 10),
      { ...mutation('s-1', 'a', 5), sourceKey: 'batch-2' },
    ])).toThrow(/Duplicate reward recipient/);
  });

  it('writes mandatory coin notifications in one JSON-backed statement and deduplicates them', async () => {
    const inputs = [
      {
        userId: 's-1', userRole: 'student' as const, type: 'coin_awarded' as const,
        title: 'Bạn được thưởng 10 xu', body: 'Lý do: Tiến bộ', priority: 'INFO' as const,
        data: { batchId: 'batch-1', coins: 10 }, sourceType: 'coin_award', sourceId: 'batch-1',
        actionUrl: '/student/achievements?view=coin-history', createdAt: '2026-09-21T10:00:00.000Z',
      },
      {
        userId: 's-2', userRole: 'student' as const, type: 'coin_awarded' as const,
        title: 'Bạn được thưởng 10 xu', body: 'Lý do: Tiến bộ', priority: 'INFO' as const,
        data: { batchId: 'batch-1', coins: 10 }, sourceType: 'coin_award', sourceId: 'batch-1',
        actionUrl: '/student/achievements?view=coin-history', createdAt: '2026-09-21T10:00:00.000Z',
      },
    ];
    const statement = prepareMandatoryNotificationBatch(db as any, inputs);

    await db.batch([statement as any]);
    await db.batch([prepareMandatoryNotificationBatch(db as any, inputs) as any]);

    expect(sqlite.prepare('SELECT type, COUNT(*) AS count FROM notifications GROUP BY type').all())
      .toEqual([{ type: 'coin_awarded', count: 2 }]);
    expect(sqlite.prepare('SELECT action_url FROM notifications WHERE user_id = \'s-1\'').get())
      .toEqual({ action_url: '/student/achievements?view=coin-history' });
    expect(resolveNotificationTarget({
      type: 'coin_awarded',
      data: { batch_id: 'batch-1' },
      actionUrl: null,
    })).toEqual({ kind: 'url', url: '/student/achievements?view=coin-history' });
  });
});

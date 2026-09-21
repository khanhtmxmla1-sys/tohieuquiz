// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  adjustCoinAwardBatch,
  createCoinAward,
  getCoinAwardSettings,
  listStaffCoinAwardHistory,
  listStudentCoinAwardHistory,
  previewCoinAward,
  reverseCoinAwardBatch,
  updateCoinAwardSettings,
} from '../workers/src/coinAwards/service';
import type { CoinAwardActor } from '../workers/src/coinAwards/repository';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, private readonly db: DatabaseSync) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { return this.db.prepare(this.sql).get(...this.bindings as any[]) as T | null; }
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
const teacher: CoinAwardActor = { username: 'teacher-a', displayName: 'Cô A', role: 'teacher' };
const otherTeacher: CoinAwardActor = { username: 'teacher-b', displayName: 'Thầy B', role: 'teacher' };
const admin: CoinAwardActor = { username: 'admin-a', displayName: 'Quản trị viên', role: 'admin' };

const awardInput = (studentIds: string[], overrides: Record<string, unknown> = {}) => ({
  classId: 'class-a',
  studentIds,
  selectionMode: 'SELECTED' as const,
  coinsPerStudent: 20,
  reason: 'Tiến bộ tốt',
  idempotencyKey: `award-${studentIds.join('-') || 'class'}`,
  ...overrides,
});

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE teachers (
      username TEXT PRIMARY KEY, full_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'teacher',
      status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE classes (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, teacher_username TEXT NOT NULL,
      created_at TEXT NOT NULL, archived_at TEXT
    );
    CREATE TABLE students (
      id TEXT PRIMARY KEY, full_name TEXT NOT NULL, username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL DEFAULT '', class_id TEXT NOT NULL, coins INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, archived_at TEXT
    );
    CREATE TABLE student_reward_ledger (
      id TEXT PRIMARY KEY, student_id TEXT NOT NULL, source_type TEXT NOT NULL,
      source_key TEXT NOT NULL, reward_type TEXT NOT NULL, coins_delta INTEGER NOT NULL DEFAULT 0,
      exp_delta INTEGER NOT NULL DEFAULT 0, payload_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL,
      UNIQUE(student_id, source_type, source_key), FOREIGN KEY(student_id) REFERENCES students(id)
    );
    CREATE TRIGGER trg_student_reward_ledger_nonnegative_wallet
    BEFORE INSERT ON student_reward_ledger
    WHEN NEW.coins_delta < 0 AND COALESCE((SELECT coins FROM students WHERE id = NEW.student_id), 0) + NEW.coins_delta < 0
    BEGIN SELECT RAISE(ABORT, 'INSUFFICIENT_COIN_BALANCE'); END;
    CREATE TABLE notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, user_role TEXT NOT NULL, type TEXT NOT NULL,
      title TEXT NOT NULL, body TEXT, data TEXT NOT NULL DEFAULT '{}', priority TEXT NOT NULL,
      severity TEXT NOT NULL, source_type TEXT, source_id TEXT, dedupe_key TEXT, action_url TEXT,
      available_at TEXT, expires_at TEXT, sent_at TEXT, created_at TEXT NOT NULL,
      UNIQUE(user_id, dedupe_key)
    );
    CREATE TABLE notification_preferences (
      user_id TEXT NOT NULL, user_role TEXT NOT NULL, action_required_enabled INTEGER NOT NULL DEFAULT 1,
      informational_enabled INTEGER NOT NULL DEFAULT 1, quiet_hours_enabled INTEGER NOT NULL DEFAULT 0,
      quiet_start TEXT NOT NULL DEFAULT '22:00', quiet_end TEXT NOT NULL DEFAULT '07:00',
      timezone_offset_minutes INTEGER NOT NULL DEFAULT 420, type_preferences_json TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY(user_id, user_role)
    );
    CREATE TABLE feature_flags (
      flag_key TEXT PRIMARY KEY, description TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 0,
      owner TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE feature_flag_rules (
      flag_key TEXT PRIMARY KEY, audience TEXT NOT NULL DEFAULT 'all', percentage INTEGER NOT NULL DEFAULT 100,
      allow_users_json TEXT NOT NULL DEFAULT '[]', allow_classes_json TEXT NOT NULL DEFAULT '[]',
      starts_at TEXT, ends_at TEXT, stop_conditions_json TEXT NOT NULL DEFAULT '{}', reason TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
    );
    INSERT INTO teachers(username, full_name) VALUES ('teacher-a', 'Cô A'), ('teacher-b', 'Thầy B');
    INSERT INTO classes(id, name, teacher_username, created_at) VALUES
      ('class-a', 'Lớp A', 'teacher-a', '2026-01-01'), ('class-b', 'Lớp B', 'teacher-b', '2026-01-01');
    INSERT INTO students(id, full_name, username, class_id, coins, created_at) VALUES
      ('student-a', 'Học sinh A', 'student-a-login', 'class-a', 100, '2026-01-01'),
      ('student-b', 'Học sinh B', 'student-b', 'class-a', 100, '2026-01-01'),
      ('student-c', 'Học sinh C', 'student-c', 'class-a', 100, '2026-01-01'),
      ('student-other', 'Học sinh khác', 'student-other', 'class-b', 100, '2026-01-01'),
      ('student-archived', 'Học sinh lưu trữ', 'student-archived', 'class-a', 100, '2026-01-01');
    UPDATE students SET archived_at = '2026-09-01T00:00:00.000Z' WHERE id = 'student-archived';
  `);
  sqlite.exec(readFileSync('workers/migrations/0082_student_coin_awards.sql', 'utf8'));
  db = new SqliteD1(sqlite);
});

afterEach(() => sqlite.close());

describe('student coin award domain service', () => {
  it('awards one managed active student with ledger, wallet, notification, and receipt', async () => {
    const receipt = await createCoinAward(db as any, teacher, awardInput(['student-a']), new Date('2026-09-21T04:00:00.000Z'));
    expect(receipt).toMatchObject({ recipientCount: 1, coinsPerStudent: 20, totalCoins: 20, alreadyProcessed: false });
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 120 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger WHERE source_type='MANUAL_AWARD'`).get()).toEqual({ count: 1 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM notifications WHERE type='coin_awarded'`).get()).toEqual({ count: 1 });
    expect(sqlite.prepare(`SELECT user_id FROM notifications WHERE type='coin_awarded'`).get()).toEqual({ user_id: 'student-a' });
  });

  it('previews the normalized batch without changing the wallet or ledger', async () => {
    const preview = await previewCoinAward(db as any, teacher, awardInput(['student-b'], {
      coinsPerStudent: 10, reason: '  Hoàn thành tốt  ',
    }), new Date('2026-09-21T04:00:00.000Z'));
    expect(preview).toMatchObject({ recipientCount: 1, totalCoins: 10, reason: 'Hoàn thành tốt', remainingTeacherDailyCoins: 1990 });
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-b'`).get()).toEqual({ coins: 100 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM coin_award_batches`).get()).toEqual({ count: 0 });
  });

  it('awards selected students atomically and expands CLASS to active students only', async () => {
    await createCoinAward(db as any, teacher, awardInput(['student-a', 'student-b']), new Date('2026-09-21T04:00:00.000Z'));
    const classReceipt = await createCoinAward(db as any, teacher, awardInput([], {
      selectionMode: 'CLASS', idempotencyKey: 'award-class-a', coinsPerStudent: 5,
    }), new Date('2026-09-21T04:01:00.000Z'));
    expect(classReceipt.recipientCount).toBe(3);
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id IN ('student-a','student-b','student-c') ORDER BY id`).all()).toEqual([
      { coins: 125 }, { coins: 125 }, { coins: 105 },
    ]);
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger`).get()).toEqual({ count: 5 });
  });

  it('keeps school-wide administrator batch context null across multiple classes', async () => {
    const receipt = await createCoinAward(db as any, admin, awardInput(['student-a', 'student-other'], {
      classId: '', idempotencyKey: 'admin-cross-class', coinsPerStudent: 7,
    }), new Date('2026-09-21T04:00:00.000Z'));
    expect(receipt).toMatchObject({ classId: null, className: null, recipientCount: 2 });
    const payloads = sqlite.prepare(`
      SELECT payload_json FROM student_reward_ledger WHERE source_type='MANUAL_AWARD' ORDER BY student_id
    `).all() as Array<{ payload_json: string }>;
    expect(JSON.parse(payloads[0].payload_json)).toMatchObject({
      policySnapshot: { maxCoinsPerStudent: 100, maxTeacherDailyCoins: 2000, reversalWindowMinutes: 15 },
      originalLedgerId: null,
    });
  });

  it('rejects unauthorized, archived, and duplicate recipients with zero writes', async () => {
    await expect(createCoinAward(db as any, teacher, awardInput(['student-other']), new Date())).rejects.toThrow(/UNAUTHORIZED_RECIPIENT/);
    await expect(createCoinAward(db as any, teacher, awardInput(['student-archived']), new Date())).rejects.toThrow(/INACTIVE_RECIPIENT/);
    await expect(createCoinAward(db as any, teacher, awardInput(['student-a', 'student-a']), new Date())).rejects.toThrow(/duplicate/i);
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM coin_award_batches`).get()).toEqual({ count: 0 });
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 100 });
  });

  it('rejects non-positive, fractional, oversized, and empty-reason awards before writing', async () => {
    for (const coinsPerStudent of [0, -1, 1.5, 1_000_001]) {
      await expect(createCoinAward(db as any, teacher, awardInput(['student-a'], {
        coinsPerStudent, idempotencyKey: `invalid-${coinsPerStudent}`,
      }), new Date())).rejects.toThrow(/INVALID_AMOUNT/);
    }
    await expect(createCoinAward(db as any, teacher, awardInput(['student-a'], {
      reason: 'x', idempotencyKey: 'invalid-reason',
    }), new Date())).rejects.toThrow(/INVALID_REASON/);
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM coin_award_batches`).get()).toEqual({ count: 0 });
  });

  it('replays matching idempotency and rejects conflicting reuse', async () => {
    const input = awardInput(['student-a'], { idempotencyKey: 'stable-key' });
    const first = await createCoinAward(db as any, teacher, input, new Date('2026-09-21T04:00:00.000Z'));
    const replay = await createCoinAward(db as any, teacher, input, new Date('2026-09-21T04:01:00.000Z'));
    expect(replay).toMatchObject({ batchId: first.batchId, alreadyProcessed: true });
    await expect(createCoinAward(db as any, teacher, awardInput(['student-a'], {
      idempotencyKey: 'stable-key', coinsPerStudent: 30,
    }), new Date())).rejects.toThrow(/IDEMPOTENCY_CONFLICT/);
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 120 });
  });

  it('enforces teacher limits while administrator awards remain technically bounded', async () => {
    const initialSettings = await getCoinAwardSettings(db as any);
    await updateCoinAwardSettings(db as any, admin, {
      maxCoinsPerStudent: 10, maxTeacherDailyCoins: 15, reversalWindowMinutes: 15,
      expectedUpdatedAt: initialSettings.updatedAt, reason: 'Điều chỉnh kiểm thử',
    }, new Date('2026-09-21T04:00:00.000Z'));
    await expect(createCoinAward(db as any, teacher, awardInput(['student-a'], { coinsPerStudent: 11 }), new Date())).rejects.toThrow(/LIMIT_EXCEEDED/);
    await createCoinAward(db as any, admin, awardInput(['student-a'], { coinsPerStudent: 100, idempotencyKey: 'admin-award' }), new Date());
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 200 });
  });

  it('reverses a teacher entire batch within the window and preserves immutable history', async () => {
    const original = await createCoinAward(db as any, teacher, awardInput(['student-a', 'student-b']), new Date('2026-09-21T04:00:00.000Z'));
    const reversal = await reverseCoinAwardBatch(db as any, teacher, original.batchId, 'Trao nhầm', new Date('2026-09-21T04:10:00.000Z'));
    expect(reversal).toMatchObject({ kind: 'REVERSAL', totalCoins: -40 });
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id IN ('student-a','student-b') ORDER BY id`).all()).toEqual([{ coins: 100 }, { coins: 100 }]);
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM coin_award_batches`).get()).toEqual({ count: 2 });
    const reversalPayload = sqlite.prepare(`
      SELECT payload_json FROM student_reward_ledger WHERE source_type='MANUAL_AWARD_REVERSAL' ORDER BY student_id LIMIT 1
    `).get() as { payload_json: string };
    expect(JSON.parse(reversalPayload.payload_json)).toMatchObject({
      originalLedgerId: expect.any(String),
      policySnapshot: { maxCoinsPerStudent: 100, maxTeacherDailyCoins: 2000, reversalWindowMinutes: 15 },
    });
    await expect(reverseCoinAwardBatch(db as any, teacher, original.batchId, 'Lặp', new Date('2026-09-21T04:11:00.000Z'))).rejects.toThrow(/ALREADY_REVERSED/);
  });

  it('allows only one concurrent whole-batch reversal and maps the loser to ALREADY_REVERSED', async () => {
    const original = await createCoinAward(db as any, teacher, awardInput(['student-a']), new Date('2026-09-21T04:00:00.000Z'));
    const results = await Promise.allSettled([
      reverseCoinAwardBatch(db as any, teacher, original.batchId, 'Hoàn tác A', new Date('2026-09-21T04:05:00.000Z')),
      reverseCoinAwardBatch(db as any, teacher, original.batchId, 'Hoàn tác B', new Date('2026-09-21T04:05:01.000Z')),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected').map((result) => String((result as PromiseRejectedResult).reason?.message))).toEqual([
      expect.stringMatching(/ALREADY_REVERSED/),
    ]);
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM coin_award_batches WHERE parent_batch_id = ?`).get(original.batchId)).toEqual({ count: 1 });
  });

  it('rejects expired reversal and creates a linked administrator adjustment for selected recipients', async () => {
    const original = await createCoinAward(db as any, teacher, awardInput(['student-a', 'student-b']), new Date('2026-09-21T04:00:00.000Z'));
    await expect(reverseCoinAwardBatch(db as any, teacher, original.batchId, undefined, new Date('2026-09-21T04:16:00.000Z'))).rejects.toThrow(/REVERSAL_EXPIRED/);
    const adjustment = await adjustCoinAwardBatch(db as any, admin, {
      parentBatchId: original.batchId, studentIds: ['student-a'], reason: 'Điều chỉnh theo biên bản', idempotencyKey: 'adjust-1',
    }, new Date('2026-09-21T05:00:00.000Z'));
    expect(adjustment).toMatchObject({ kind: 'ADJUSTMENT', recipientCount: 1, totalCoins: -20 });
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 100 });
  });

  it('rejects conflicting administrator adjustment idempotency reuse', async () => {
    const original = await createCoinAward(db as any, teacher, awardInput(['student-a']), new Date('2026-09-21T04:00:00.000Z'));
    await adjustCoinAwardBatch(db as any, admin, {
      parentBatchId: original.batchId, studentIds: ['student-a'], reason: 'Điều chỉnh lần một', idempotencyKey: 'adjust-conflict',
    }, new Date('2026-09-21T05:00:00.000Z'));
    await expect(adjustCoinAwardBatch(db as any, admin, {
      parentBatchId: original.batchId, studentIds: ['student-a'], reason: 'Lý do khác', idempotencyKey: 'adjust-conflict',
    }, new Date('2026-09-21T05:01:00.000Z'))).rejects.toThrow(/IDEMPOTENCY_CONFLICT/);
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM coin_award_batches WHERE kind='ADJUSTMENT'`).get()).toEqual({ count: 1 });
  });

  it('replays one concurrent administrator adjustment and writes one compensating batch', async () => {
    const original = await createCoinAward(db as any, teacher, awardInput(['student-a']), new Date('2026-09-21T04:00:00.000Z'));
    const input = {
      parentBatchId: original.batchId, studentIds: ['student-a'], reason: 'Điều chỉnh đồng thời', idempotencyKey: 'adjust-concurrent',
    };
    const results = await Promise.allSettled([
      adjustCoinAwardBatch(db as any, admin, input, new Date('2026-09-21T05:00:00.000Z')),
      adjustCoinAwardBatch(db as any, admin, input, new Date('2026-09-21T05:00:01.000Z')),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter((result) => result.status === 'fulfilled').map((result) => (result as PromiseFulfilledResult<{ alreadyProcessed: boolean }>).value.alreadyProcessed).sort()).toEqual([false, true]);
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM coin_award_batches WHERE kind='ADJUSTMENT'`).get()).toEqual({ count: 1 });
  });

  it('rejects an underfunded reversal without creating a compensating batch', async () => {
    const original = await createCoinAward(db as any, teacher, awardInput(['student-a']), new Date('2026-09-21T04:00:00.000Z'));
    sqlite.prepare(`UPDATE students SET coins = 0 WHERE id='student-a'`).run();
    await expect(reverseCoinAwardBatch(db as any, teacher, original.batchId, undefined, new Date('2026-09-21T04:05:00.000Z'))).rejects.toThrow(/INSUFFICIENT_BALANCE/);
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM coin_award_batches`).get()).toEqual({ count: 1 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM student_reward_ledger WHERE source_type='MANUAL_AWARD_REVERSAL'`).get()).toEqual({ count: 0 });
  });

  it('returns role-scoped history and audits optimistic settings changes', async () => {
    await createCoinAward(db as any, teacher, awardInput(['student-a']), new Date('2026-09-21T04:00:00.000Z'));
    await createCoinAward(db as any, otherTeacher, awardInput(['student-other'], { classId: 'class-b', idempotencyKey: 'other-award' }), new Date('2026-09-21T04:01:00.000Z'));
    const teacherHistory = await listStaffCoinAwardHistory(db as any, teacher, { limit: 20 });
    const adminHistory = await listStaffCoinAwardHistory(db as any, admin, { limit: 20 });
    expect(teacherHistory.items).toHaveLength(1);
    expect(adminHistory.items).toHaveLength(2);
    expect((await listStudentCoinAwardHistory(db as any, 'student-a', { limit: 20 })).items).toHaveLength(1);
    const before = await getCoinAwardSettings(db as any);
    await updateCoinAwardSettings(db as any, admin, {
      maxCoinsPerStudent: 80, maxTeacherDailyCoins: 1800, reversalWindowMinutes: 30,
      expectedUpdatedAt: before.updatedAt, reason: 'Cập nhật chính sách',
    }, new Date('2026-09-21T06:00:00.000Z'));
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM coin_award_setting_audit`).get()).toEqual({ count: 1 });
    await expect(updateCoinAwardSettings(db as any, admin, {
      maxCoinsPerStudent: 70, maxTeacherDailyCoins: 1700, reversalWindowMinutes: 30,
      expectedUpdatedAt: before.updatedAt, reason: 'Xung đột',
    }, new Date('2026-09-21T06:01:00.000Z'))).rejects.toThrow(/SETTINGS_CONFLICT/);
  });

  it('rejects a stale settings update even when two requests use the same timestamp', async () => {
    const before = await getCoinAwardSettings(db as any);
    const now = new Date('2026-09-21T06:00:00.000Z');
    await updateCoinAwardSettings(db as any, admin, {
      maxCoinsPerStudent: 90, maxTeacherDailyCoins: 1900, reversalWindowMinutes: 20,
      expectedUpdatedAt: before.updatedAt, reason: 'Cập nhật cùng giờ',
    }, now);
    await expect(updateCoinAwardSettings(db as any, admin, {
      maxCoinsPerStudent: 80, maxTeacherDailyCoins: 1800, reversalWindowMinutes: 20,
      expectedUpdatedAt: before.updatedAt, reason: 'Yêu cầu cũ',
    }, now)).rejects.toThrow(/SETTINGS_CONFLICT/);
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM coin_award_setting_audit`).get()).toEqual({ count: 1 });
  });
});

// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const migrationPath = 'workers/migrations/0082_student_coin_awards.sql';
const rollbackPath = 'workers/rollbacks/0082_drop_student_coin_awards.sql';
const schemaPath = 'workers/schema.sql';

let db: DatabaseSync | null = null;

const setupRolloutControlPlane = () => {
  db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE feature_flags (
      flag_key TEXT PRIMARY KEY,
      description TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
      owner TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE feature_flag_rules (
      flag_key TEXT PRIMARY KEY,
      audience TEXT NOT NULL DEFAULT 'all'
        CHECK (audience IN ('all', 'admin', 'teacher', 'student', 'parent')),
      percentage INTEGER NOT NULL DEFAULT 100 CHECK (percentage BETWEEN 0 AND 100),
      allow_users_json TEXT NOT NULL DEFAULT '[]',
      allow_classes_json TEXT NOT NULL DEFAULT '[]',
      starts_at TEXT,
      ends_at TEXT,
      stop_conditions_json TEXT NOT NULL DEFAULT '{}',
      reason TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (flag_key) REFERENCES feature_flags(flag_key) ON DELETE CASCADE
    );
  `);
  return db;
};

type BatchInput = {
  id: string;
  actorRole: 'teacher' | 'admin';
  coinsPerStudent: number;
  recipientCount?: number;
  totalCoins?: number;
  idempotencyKey?: string;
};

const insertBatch = (database: DatabaseSync, input: BatchInput) => database.prepare(`
  INSERT INTO coin_award_batches (
    id, kind, actor_username, actor_display_name, actor_role, selection_mode,
    coins_per_student, recipient_count, total_coins, reason, idempotency_key,
    request_hash, hanoi_date, created_at
  ) VALUES (?, 'AWARD', 'teacher-a', 'Teacher A', ?, 'STUDENT', ?, ?, ?,
    'Tiến bộ tốt', ?, 'hash', '2026-09-21', datetime('now'))
`).run(
  input.id,
  input.actorRole,
  input.coinsPerStudent,
  input.recipientCount ?? 1,
  input.totalCoins ?? input.coinsPerStudent * (input.recipientCount ?? 1),
  input.idempotencyKey ?? input.id,
);

afterEach(() => {
  db?.close();
  db = null;
});

describe('student coin awards persistence migration', () => {
  it('seeds disabled rollout and school governance defaults', () => {
    const database = setupRolloutControlPlane();
    database.exec(readFileSync(migrationPath, 'utf8'));

    expect(database.prepare(`
      SELECT max_coins_per_student, max_teacher_daily_coins, reversal_window_minutes
      FROM coin_award_settings
      WHERE scope_key = 'school'
    `).get()).toEqual({
      max_coins_per_student: 100,
      max_teacher_daily_coins: 2000,
      reversal_window_minutes: 15,
    });

    expect(database.prepare(`
      SELECT enabled FROM feature_flags WHERE flag_key = 'student_coin_awards_v1'
    `).get()).toEqual({ enabled: 0 });
    expect(database.prepare(`
      SELECT audience, percentage FROM feature_flag_rules
      WHERE flag_key = 'student_coin_awards_v1'
    `).get()).toEqual({ audience: 'teacher', percentage: 100 });
  });

  it('enforces teacher per-student and daily award limits before accepting a batch', () => {
    const database = setupRolloutControlPlane();
    database.exec(readFileSync(migrationPath, 'utf8'));

    insertBatch(database, {
      id: 'batch-1',
      actorRole: 'teacher',
      coinsPerStudent: 100,
      totalCoins: 100,
    });

    expect(() => insertBatch(database, {
      id: 'batch-too-many-per-student',
      actorRole: 'teacher',
      coinsPerStudent: 101,
      totalCoins: 101,
    })).toThrow(/COIN_AWARD_PER_STUDENT_LIMIT/);

    expect(() => insertBatch(database, {
      id: 'batch-too-many-per-day',
      actorRole: 'teacher',
      coinsPerStudent: 100,
      recipientCount: 20,
      totalCoins: 2000,
    })).toThrow(/COIN_AWARD_DAILY_LIMIT/);
  });

  it('keeps award batches and setting audit rows immutable', () => {
    const database = setupRolloutControlPlane();
    database.exec(readFileSync(migrationPath, 'utf8'));
    insertBatch(database, {
      id: 'batch-1',
      actorRole: 'teacher',
      coinsPerStudent: 100,
    });

    expect(() => database.prepare(`
      UPDATE coin_award_batches SET reason = 'changed' WHERE id = 'batch-1'
    `).run()).toThrow(/COIN_AWARD_BATCH_IMMUTABLE/);
    expect(() => database.prepare(`
      DELETE FROM coin_award_batches WHERE id = 'batch-1'
    `).run()).toThrow(/COIN_AWARD_BATCH_IMMUTABLE/);

    database.prepare(`
      INSERT INTO coin_award_setting_audit
      (id, scope_key, before_json, after_json, actor_username, reason, created_at)
      VALUES ('audit-1', 'school', '{}', '{}', 'admin-a', 'Initial seed', datetime('now'))
    `).run();
    expect(() => database.prepare(`
      UPDATE coin_award_setting_audit SET reason = 'changed' WHERE id = 'audit-1'
    `).run()).toThrow(/COIN_AWARD_SETTING_AUDIT_IMMUTABLE/);
    expect(() => database.prepare(`
      DELETE FROM coin_award_settings WHERE scope_key = 'school'
    `).run()).toThrow(/COIN_AWARD_SETTINGS_REQUIRED/);
  });

  it('allows administrators to exceed teacher business limits while retaining technical bounds', () => {
    const database = setupRolloutControlPlane();
    database.exec(readFileSync(migrationPath, 'utf8'));

    insertBatch(database, {
      id: 'admin-batch',
      actorRole: 'admin',
      coinsPerStudent: 1000,
      recipientCount: 100,
      totalCoins: 100000,
    });

    expect(database.prepare(`
      SELECT actor_role, total_coins FROM coin_award_batches WHERE id = 'admin-batch'
    `).get()).toEqual({ actor_role: 'admin', total_coins: 100000 });
    expect(() => insertBatch(database, {
      id: 'admin-too-large',
      actorRole: 'admin',
      coinsPerStudent: 1000001,
      totalCoins: 1000001,
    })).toThrow(/CHECK constraint failed/);
  });

  it('removes only the coin award objects during rollback', () => {
    const database = setupRolloutControlPlane();
    database.exec(readFileSync(migrationPath, 'utf8'));
    database.exec(readFileSync(rollbackPath, 'utf8'));

    expect(database.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name IN (
        'coin_award_batches', 'coin_award_settings', 'coin_award_setting_audit'
      )
    `).all()).toEqual([]);
    expect(database.prepare(`
      SELECT flag_key FROM feature_flags WHERE flag_key = 'student_coin_awards_v1'
    `).all()).toEqual([]);
    expect(database.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'feature_flags'`).all())
      .toEqual([{ name: 'feature_flags' }]);
  });

  it('keeps the fresh schema equivalent to the migration governance contract', () => {
    const schema = readFileSync(schemaPath, 'utf8').toLowerCase();
    for (const table of ['coin_award_batches', 'coin_award_settings', 'coin_award_setting_audit']) {
      expect(schema).toContain(`create table if not exists ${table}`);
    }
    expect(schema).toContain('student_coin_awards_v1');
    expect(schema).toContain('coin_award_per_student_limit');
    expect(schema).toContain('coin_award_daily_limit');
  });
});

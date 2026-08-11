// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getFeatureFlag,
  patchFeatureFlag,
  patchFeatureFlagBatch,
  rollbackFeatureFlag,
} from '../workers/src/services/featureFlagService';

class SqliteStatement {
  private bindings: unknown[] = [];
  constructor(private readonly statement: ReturnType<DatabaseSync['prepare']>) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { return (this.statement.get(...this.bindings) ?? null) as T | null; }
  async all<T>() { return { results: this.statement.all(...this.bindings) as T[] }; }
  async run() {
    const result = this.statement.run(...this.bindings);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

class SqliteD1 {
  constructor(readonly sqlite: DatabaseSync) {}
  prepare(sql: string) { return new SqliteStatement(this.sqlite.prepare(sql)); }
  async batch(statements: SqliteStatement[]) {
    this.sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }
}

const migration = readFileSync(
  new URL('../workers/migrations/0054_feature_rollout_control_plane.sql', import.meta.url),
  'utf8',
);
let sqlite: DatabaseSync | null = null;
afterEach(() => { sqlite?.close(); sqlite = null; });

const setup = () => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE system_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO system_settings VALUES
      ('unified_notifications_v1', 'false', '2026-07-29T00:00:00.000Z'),
      ('ai_assistant_enabled', 'true', '2026-07-29T00:00:00.000Z');
  `);
  sqlite.exec(migration);
  return new SqliteD1(sqlite) as unknown as D1Database;
};

describe('feature flag persistence and rollback', () => {
  it('patches one rule field, increments version and records actor/request audit', async () => {
    const db = setup();
    const before = await getFeatureFlag(db, 'unified_notifications_v1');
    expect(before).toMatchObject({ enabled: false, percentage: 100, version: 1 });

    const after = await patchFeatureFlag(db, 'unified_notifications_v1', {
      field: 'percentage', value: 5, reason: 'Pilot 5% teachers',
    }, 'admin-a', 'req-flag-1');
    expect(after).toMatchObject({ percentage: 5, version: 2, updatedBy: 'admin-a' });

    const audit = sqlite!.prepare(`
      SELECT action, field_name, actor_username, request_id, reason
      FROM feature_flag_audit
    `).get() as Record<string, unknown>;
    expect(audit).toEqual(expect.objectContaining({
      action: 'UPDATED', field_name: 'percentage', actor_username: 'admin-a',
      request_id: 'req-flag-1', reason: 'Pilot 5% teachers',
    }));
  });

  it('rolls back the latest change once without a deploy', async () => {
    const db = setup();
    await patchFeatureFlag(db, 'unified_notifications_v1', {
      field: 'percentage', value: 25, reason: 'Open pilot',
    }, 'admin-a', 'req-update');
    const rolledBack = await rollbackFeatureFlag(
      db, 'unified_notifications_v1', 'admin-b', 'req-rollback', 'Stop condition breached',
    );
    expect(rolledBack).toMatchObject({ percentage: 100, version: 3, updatedBy: 'admin-b' });
    await expect(rollbackFeatureFlag(
      db, 'unified_notifications_v1', 'admin-b', 'req-replay', 'Repeat rollback',
    )).rejects.toThrow('FEATURE_FLAG_ROLLBACK_NOT_FOUND');
    expect(sqlite!.prepare("SELECT COUNT(*) AS count FROM feature_flag_audit WHERE action='ROLLED_BACK'").get())
      .toEqual({ count: 1 });
  });

  it('rejects an invalid percentage before writing audit data', async () => {
    const db = setup();
    await expect(patchFeatureFlag(db, 'unified_notifications_v1', {
      field: 'percentage', value: 101, reason: 'Invalid',
    }, 'admin-a', 'req-invalid')).rejects.toThrow('FEATURE_FLAG_INVALID_PERCENTAGE');
    expect(sqlite!.prepare('SELECT COUNT(*) AS count FROM feature_flag_audit').get()).toEqual({ count: 0 });
  });

  it('applies a valid batch atomically and increments version exactly once', async () => {
    const db = setup();
    const after = await patchFeatureFlagBatch(db, 'unified_notifications_v1', {
      changes: [
        { field: 'enabled', value: true },
        { field: 'audience', value: 'teacher' },
        { field: 'percentage', value: 10 },
      ],
      reason: 'Pilot 10% teachers',
      expectedVersion: 1,
    }, 'admin-a', 'req-batch-1');

    expect(after).toMatchObject({
      enabled: true,
      audience: 'teacher',
      percentage: 10,
      version: 2,
      reason: 'Pilot 10% teachers',
      updatedBy: 'admin-a',
    });
    expect(sqlite!.prepare('SELECT COUNT(*) AS count FROM feature_flag_audit').get()).toEqual({ count: 1 });
    expect(sqlite!.prepare('SELECT field_name, request_id FROM feature_flag_audit').get()).toEqual({
      field_name: '__batch__', request_id: 'req-batch-1',
    });
  });

  it.each([
    ['empty changes', { changes: [], reason: 'Empty', expectedVersion: 1 }, 'FEATURE_FLAG_BATCH_EMPTY'],
    ['too many changes', {
      changes: Array.from({ length: 11 }, (_, index) => ({ field: 'percentage', value: index })),
      reason: 'Too many', expectedVersion: 1,
    }, 'FEATURE_FLAG_BATCH_TOO_LARGE'],
    ['duplicate field', {
      changes: [{ field: 'enabled', value: true }, { field: 'enabled', value: false }],
      reason: 'Duplicate', expectedVersion: 1,
    }, 'FEATURE_FLAG_BATCH_DUPLICATE_FIELD'],
    ['unknown field', {
      changes: [{ field: 'unknownField', value: true }], reason: 'Unknown', expectedVersion: 1,
    }, 'FEATURE_FLAG_INVALID_FIELD'],
  ] as const)('rejects %s without any mutation', async (_label, batch, expectedError) => {
    const db = setup();
    const before = await getFeatureFlag(db, 'unified_notifications_v1');

    await expect(patchFeatureFlagBatch(
      db,
      'unified_notifications_v1',
      batch as any,
      'admin-a',
      'req-invalid-batch',
    )).rejects.toThrow(expectedError);

    expect(await getFeatureFlag(db, 'unified_notifications_v1')).toEqual(before);
    expect(sqlite!.prepare('SELECT COUNT(*) AS count FROM feature_flag_audit').get()).toEqual({ count: 0 });
  });

  it('validates every value before writing any part of the batch', async () => {
    const db = setup();
    const before = await getFeatureFlag(db, 'unified_notifications_v1');

    await expect(patchFeatureFlagBatch(db, 'unified_notifications_v1', {
      changes: [
        { field: 'enabled', value: true },
        { field: 'percentage', value: 101 },
      ],
      reason: 'Invalid second value',
      expectedVersion: 1,
    }, 'admin-a', 'req-invalid-value')).rejects.toThrow('FEATURE_FLAG_INVALID_PERCENTAGE');

    expect(await getFeatureFlag(db, 'unified_notifications_v1')).toEqual(before);
    expect(sqlite!.prepare('SELECT COUNT(*) AS count FROM feature_flag_audit').get()).toEqual({ count: 0 });
  });

  it('rejects a version conflict without audit or mutation', async () => {
    const db = setup();
    const before = await getFeatureFlag(db, 'unified_notifications_v1');

    await expect(patchFeatureFlagBatch(db, 'unified_notifications_v1', {
      changes: [{ field: 'percentage', value: 25 }],
      reason: 'Stale editor',
      expectedVersion: 99,
    }, 'admin-a', 'req-conflict')).rejects.toThrow('FEATURE_FLAG_VERSION_CONFLICT');

    expect(await getFeatureFlag(db, 'unified_notifications_v1')).toEqual(before);
    expect(sqlite!.prepare('SELECT COUNT(*) AS count FROM feature_flag_audit').get()).toEqual({ count: 0 });
  });

  it('rolls back the latest batch as one mutation', async () => {
    const db = setup();
    await patchFeatureFlagBatch(db, 'unified_notifications_v1', {
      changes: [
        { field: 'enabled', value: true },
        { field: 'audience', value: 'teacher' },
        { field: 'percentage', value: 10 },
      ],
      reason: 'Pilot 10%',
      expectedVersion: 1,
    }, 'admin-a', 'req-batch-rollback');

    const rolledBack = await rollbackFeatureFlag(
      db, 'unified_notifications_v1', 'admin-b', 'req-batch-rollback-action', 'Undo batch',
    );
    expect(rolledBack).toMatchObject({
      enabled: false,
      audience: 'all',
      percentage: 100,
      version: 3,
    });
  });
});

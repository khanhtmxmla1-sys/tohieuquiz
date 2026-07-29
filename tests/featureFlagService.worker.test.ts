// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getFeatureFlag,
  patchFeatureFlag,
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
});

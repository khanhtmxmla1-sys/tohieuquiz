import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migrationsDir = path.join(root, 'workers', 'migrations');
const rollbacksDir = path.join(root, 'workers', 'rollbacks');
const bootstrapPath = path.join(root, 'workers', 'scripts', 'bootstrap_d1_migration_registry.sql');

function migrationFiles(): string[] {
  return fs.readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

describe('D1 migration layout', () => {
  it('keeps rollback SQL outside the forward migration directory', () => {
    const migrations = migrationFiles();
    expect(migrations.some((name) => /rollback|drop/i.test(name))).toBe(false);
    expect(fs.existsSync(path.join(rollbacksDir, '0019_drop_phieu_nhanxet.sql'))).toBe(true);
  });

  it('keeps the fresh-database registry bootstrap aligned with every migration filename', () => {
    const migrations = migrationFiles();
    const bootstrap = fs.readFileSync(bootstrapPath, 'utf8');
    const registered = [...bootstrap.matchAll(/\('([^']+\.sql)'\)/g)]
      .map((match) => match[1])
      .sort();

    expect(registered).toEqual(migrations);
    expect(new Set(registered).size).toBe(registered.length);
    const numericPrefixes = migrations.map((name) => name.slice(0, 4));
    expect(new Set(numericPrefixes).size).toBe(numericPrefixes.length);
    expect(migrations.at(-1)).toBe('0052_auth_sessions_security_events.sql');
  });

  it('stores assignment-scoped result identity in migration 0040', () => {
    const sql = fs.readFileSync(
      path.join(migrationsDir, '0040_scope_results_to_assignments.sql'),
      'utf8',
    );

    expect(sql).toContain('ALTER TABLE results ADD COLUMN assignment_id TEXT');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_results_assignment_student');
    expect(sql).toContain('UPDATE results');
  });

  it('stores teacher AI quota and action reservations in migrations', () => {
    const sql = fs.readFileSync(
      path.join(migrationsDir, '0039_create_ai_generation_actions.sql'),
      'utf8',
    );

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS teacher_ai_daily_usage');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS ai_generation_actions');
    expect(sql).toContain("CHECK(status IN ('RESERVED', 'SUCCEEDED', 'FAILED', 'EXPIRED'))");
  });
});

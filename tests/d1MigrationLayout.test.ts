import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXPECTED_LATEST_MIGRATION } from '../workers/src/services/operationsService';

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
    expect(migrations.at(-1)).toBe('0068_login_media.sql');
    expect(EXPECTED_LATEST_MIGRATION).toBe(migrations.at(-1));
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

  it('stores canonical result class scope in migration 0065', () => {
    const sql = fs.readFileSync(
      path.join(migrationsDir, '0065_add_result_canonical_class_scope.sql'),
      'utf8',
    );

    expect(sql).toContain('ALTER TABLE results ADD COLUMN class_id TEXT REFERENCES classes(id) ON DELETE SET NULL');
    expect(sql).toContain('idx_results_class_submitted');
    expect(sql).toContain('idx_results_class_quiz_submitted');
  });

  it('stores the immutable student reward ledger in migration 0066', () => {
    const sql = fs.readFileSync(
      path.join(migrationsDir, '0066_student_reward_ledger.sql'),
      'utf8',
    );

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS student_reward_ledger');
    expect(sql).toContain('UNIQUE(student_id, source_type, source_key)');
    expect(sql).toContain("'BALANCE_OPENING'");
    expect(sql).toContain('student_reward_reconciliation');
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

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migrationPath = path.join(root, 'workers', 'migrations', '0060_system_question_bank.sql');
const rollbackPath = path.join(root, 'workers', 'rollbacks', '0060_drop_system_question_bank.sql');
const schemaPath = path.join(root, 'workers', 'schema.sql');

describe('system question bank migration', () => {
  it('creates shared question-bank tables, indexes, rollout flag and legacy backfill', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS question_bank_items');
    expect(sql).toContain("CHECK (scope IN ('SYSTEM', 'PERSONAL'))");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS question_bank_audit');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_question_bank_unique_content');
    expect(sql).toContain("'system_question_bank_v1'");
    expect(sql).toContain('INSERT OR IGNORE INTO question_bank_items');
    expect(sql).toContain("'legacy:' || id");
    expect(sql).not.toContain('DROP TABLE test_bank');
  });

  it('ships a rollback that removes only the new system-question-bank resources', () => {
    const sql = fs.readFileSync(rollbackPath, 'utf8');

    expect(sql).toContain("DELETE FROM feature_flag_rules WHERE flag_key = 'system_question_bank_v1'");
    expect(sql).toContain("DELETE FROM feature_flags WHERE flag_key = 'system_question_bank_v1'");
    expect(sql).toContain('DROP TABLE IF EXISTS question_bank_audit');
    expect(sql).toContain('DROP TABLE IF EXISTS question_bank_items');
    expect(sql).not.toContain('DROP TABLE IF EXISTS test_bank');
  });

  it('mirrors the canonical tables and disabled rollout flag in the fresh bootstrap schema', () => {
    const sql = fs.readFileSync(schemaPath, 'utf8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS question_bank_items');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS question_bank_audit');
    expect(sql).toContain("'system_question_bank_v1', 'System-wide shared question bank', 0");
  });
});

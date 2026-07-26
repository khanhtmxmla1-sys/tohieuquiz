import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'workers',
  'migrations',
  '0038_normalize_quiz_ownership.sql',
);

describe('0038 quiz ownership normalization', () => {
  it('maps unique legacy teacher display names to canonical usernames', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('UPDATE quizzes');
    expect(sql).toContain('LOWER(TRIM(t.full_name)) = LOWER(TRIM(quizzes.created_by))');
    expect(sql).toContain('SELECT COUNT(*)');
    expect(sql).toContain('= 1');
  });

  it('repairs the known historical Khánh display-name typo without claiming blank owners', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('Thầy Khánh đẹp troai');
    expect(sql).toContain('Thầy Khánh đẹp Choai');
    expect(sql).not.toContain('tongminhkhanh');
    expect(sql).toContain("TRIM(COALESCE(quizzes.created_by, '')) <> ''");
    expect(sql).not.toMatch(/SET\s+created_by\s*=\s*'[^']+'\s*WHERE\s+TRIM\(COALESCE\(created_by,\s*''\)\)\s*=\s*''/i);
  });

  it('adds an index for canonical ownership lookups', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_quizzes_created_by');
  });
});

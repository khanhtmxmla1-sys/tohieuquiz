import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('canonical scoring migration', () => {
  it('adds only version columns and does not rewrite answers', () => {
    const sql = readFileSync('workers/migrations/0058_canonical_quiz_scoring_v2.sql', 'utf8');
    expect(sql).toContain('ALTER TABLE questions ADD COLUMN answer_schema_version INTEGER NOT NULL DEFAULT 1');
    expect(sql).toContain("ALTER TABLE results ADD COLUMN grading_version TEXT NOT NULL DEFAULT 'legacy'");
    expect(sql).toContain('ALTER TABLE live_exam_participants ADD COLUMN grading_version TEXT');
    expect(sql).not.toMatch(/UPDATE\s+(questions|results|live_exam_participants)/i);
  });

  it('keeps fresh schema and migration registry aligned with scoring versions', () => {
    const schema = readFileSync('workers/schema.sql', 'utf8');
    const registry = readFileSync('workers/scripts/bootstrap_d1_migration_registry.sql', 'utf8');
    expect(schema).toContain('answer_schema_version INTEGER NOT NULL DEFAULT 1');
    expect(schema).toContain("grading_version TEXT NOT NULL DEFAULT 'legacy'");
    expect(registry).toContain("('0058_canonical_quiz_scoring_v2.sql')");
  });
});

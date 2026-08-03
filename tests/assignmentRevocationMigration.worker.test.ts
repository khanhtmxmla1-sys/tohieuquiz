// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const migrationPath = 'workers/migrations/0061_assignment_revocation.sql';
let db: DatabaseSync | null = null;

afterEach(() => {
  db?.close();
  db = null;
});

describe('assignment revocation migration', () => {
  it('adds the complete revocation audit contract to a legacy assignments table', () => {
    db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE assignments (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL,
        class_id TEXT NOT NULL,
        student_id TEXT DEFAULT '',
        deadline TEXT NOT NULL,
        max_attempts INTEGER DEFAULT 1,
        intervention_group_id TEXT,
        status TEXT DEFAULT 'OPEN',
        created_at TEXT NOT NULL
      );
    `);

    db.exec(readFileSync(migrationPath, 'utf8'));
    const columns = db.prepare("PRAGMA table_info('assignments')").all() as Array<{ name: string; notnull: number; dflt_value: string | null }>;
    const byName = new Map(columns.map(column => [column.name, column]));

    expect([...byName.keys()]).toEqual(expect.arrayContaining([
      'revoked_at',
      'revoked_by',
      'revoked_reason',
      'previous_status',
      'submission_count_at_revoke',
    ]));
    expect(byName.get('submission_count_at_revoke')).toMatchObject({
      notnull: 1,
      dflt_value: '0',
    });
  });

  it('keeps the fresh schema and migration registry aligned with the migration contract', () => {
    const schema = readFileSync('workers/schema.sql', 'utf8');
    const registry = readFileSync('workers/scripts/bootstrap_d1_migration_registry.sql', 'utf8');
    for (const column of [
      'revoked_at TEXT',
      'revoked_by TEXT',
      'revoked_reason TEXT',
      'previous_status TEXT',
      'submission_count_at_revoke INTEGER NOT NULL DEFAULT 0',
    ]) {
      expect(schema).toContain(column);
    }
    expect(registry).toContain("('0061_assignment_revocation.sql')");
  });
});

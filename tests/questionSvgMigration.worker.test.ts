// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const migrationPath = 'workers/migrations/0062_add_question_svg_diagrams.sql';
let db: DatabaseSync | null = null;

afterEach(() => {
  db?.close();
  db = null;
});

describe('question SVG diagram migration', () => {
  it('adds non-null SVG content and alt columns with empty defaults', () => {
    db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE questions (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL,
        type TEXT NOT NULL,
        question TEXT DEFAULT '',
        image_alt TEXT NOT NULL DEFAULT '',
        answer_schema_version INTEGER NOT NULL DEFAULT 1
      );
    `);

    db.exec(readFileSync(migrationPath, 'utf8'));
    const columns = db.prepare("PRAGMA table_info('questions')").all() as Array<{
      name: string;
      notnull: number;
      dflt_value: string | null;
    }>;
    const byName = new Map(columns.map((column) => [column.name, column]));

    expect(byName.get('svg_content')).toMatchObject({ notnull: 1, dflt_value: "''" });
    expect(byName.get('svg_alt')).toMatchObject({ notnull: 1, dflt_value: "''" });
  });

  it('keeps the fresh schema, registry and rollback aligned', () => {
    const schema = readFileSync('workers/schema.sql', 'utf8');
    const registry = readFileSync('workers/scripts/bootstrap_d1_migration_registry.sql', 'utf8');
    const rollback = readFileSync('workers/rollbacks/0062_drop_question_svg_diagrams.sql', 'utf8');

    expect(schema).toContain("svg_content TEXT NOT NULL DEFAULT ''");
    expect(schema).toContain("svg_alt TEXT NOT NULL DEFAULT ''");
    expect(registry).toContain("('0062_add_question_svg_diagrams.sql')");
    expect(rollback).toContain('ALTER TABLE questions DROP COLUMN svg_alt;');
    expect(rollback).toContain('ALTER TABLE questions DROP COLUMN svg_content;');
  });
});

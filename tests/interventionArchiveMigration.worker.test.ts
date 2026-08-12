// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const migrationPath = 'workers/migrations/0067_intervention_group_archive_audit.sql';
let db: DatabaseSync | null = null;

afterEach(() => {
  db?.close();
  db = null;
});

const createLegacyAuditSchema = (database: DatabaseSync) => {
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE teachers (username TEXT PRIMARY KEY);
    CREATE TABLE classes (id TEXT PRIMARY KEY, name TEXT NOT NULL, teacher_username TEXT);
    CREATE TABLE students (id TEXT PRIMARY KEY, full_name TEXT NOT NULL, class_id TEXT);
    CREATE TABLE intervention_groups (
      id TEXT PRIMARY KEY,
      teacher_username TEXT NOT NULL,
      class_id TEXT NOT NULL
    );
    CREATE TABLE intervention_audit (
      id TEXT PRIMARY KEY,
      teacher_username TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('GROUP_CREATED', 'NOTE_CREATED', 'ASSIGNMENT_BATCH_CREATED')),
      group_id TEXT,
      student_id TEXT,
      assignment_id TEXT,
      request_id TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (teacher_username) REFERENCES teachers(username) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES intervention_groups(id) ON DELETE SET NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
    );
    CREATE INDEX idx_intervention_audit_group_created
      ON intervention_audit(group_id, created_at DESC);
    INSERT INTO teachers(username) VALUES ('teacher-a');
    INSERT INTO classes(id, name, teacher_username) VALUES ('class-1', '4A', 'teacher-a');
    INSERT INTO intervention_groups(id, teacher_username, class_id) VALUES ('group-1', 'teacher-a', 'class-1');
    INSERT INTO intervention_audit(
      id, teacher_username, action, group_id, request_id, metadata_json, created_at
    ) VALUES (
      'audit-existing', 'teacher-a', 'GROUP_CREATED', 'group-1', 'request-existing', '{}', '2026-08-01T00:00:00.000Z'
    );
  `);
};

describe('intervention group archive audit migration', () => {
  it('preserves existing audit rows and allows only the expanded action set', () => {
    db = new DatabaseSync(':memory:');
    createLegacyAuditSchema(db);

    expect(() => db!.exec(readFileSync(migrationPath, 'utf8'))).not.toThrow();
    expect(db.prepare('SELECT id, action FROM intervention_audit').all()).toEqual([
      { id: 'audit-existing', action: 'GROUP_CREATED' },
    ]);
    expect(() => db!.prepare(`
      INSERT INTO intervention_audit(
        id, teacher_username, action, group_id, request_id, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'audit-archive', 'teacher-a', 'GROUP_ARCHIVED', 'group-1', 'request-archive', '{}', '2026-08-12T00:00:00.000Z',
    )).not.toThrow();
    expect(() => db!.prepare(`
      INSERT INTO intervention_audit(
        id, teacher_username, action, group_id, request_id, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'audit-invalid', 'teacher-a', 'GROUP_DELETED', 'group-1', 'request-invalid', '{}', '2026-08-12T00:00:00.000Z',
    )).toThrow();

    const indexes = db.prepare("PRAGMA index_list('intervention_audit')").all() as Array<{ name: string }>;
    expect(indexes.map((index) => index.name)).toContain('idx_intervention_audit_group_created');
  });

  it('keeps fresh schema and migration registry aligned', () => {
    const schema = readFileSync('workers/schema.sql', 'utf8');
    const registry = readFileSync('workers/scripts/bootstrap_d1_migration_registry.sql', 'utf8');

    expect(schema).toContain("'GROUP_ARCHIVED'");
    expect(registry).toContain("('0067_intervention_group_archive_audit.sql')");
  });
});

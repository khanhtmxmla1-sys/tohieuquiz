// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../workers/migrations/0082_class_attendance_question_bank.sql', import.meta.url),
  'utf8',
);
const rollback = readFileSync(
  new URL('../workers/migrations/rollback/0082_class_attendance_question_bank.rollback.sql', import.meta.url),
  'utf8',
);

let db: DatabaseSync | null = null;

afterEach(() => {
  db?.close();
  db = null;
});

describe('attendance question bank migration', () => {
  it('installs and rolls back the attendance tables and indexes cleanly', () => {
    db = new DatabaseSync(':memory:');
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE classes (id TEXT PRIMARY KEY);
      CREATE TABLE students (id TEXT PRIMARY KEY);
    `);

    db.exec(migration);

    const installed = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name LIKE '%attendance%'
      ORDER BY name
    `).all().map((row: any) => row.name);

    expect(installed).toEqual([
      'attendance_attempt_items',
      'attendance_attempts',
      'class_attendance_questions',
      'class_attendance_settings',
    ]);

    db.exec(rollback);

    const remaining = db.prepare(`
      SELECT COUNT(*) AS count
      FROM sqlite_master
      WHERE type = 'table' AND name IN (
        'class_attendance_settings',
        'class_attendance_questions',
        'attendance_attempts',
        'attendance_attempt_items'
      )
    `).get() as { count: number };

    expect(remaining.count).toBe(0);
  });
});

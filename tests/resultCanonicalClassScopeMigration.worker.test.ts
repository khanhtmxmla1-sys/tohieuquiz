// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const migrationPath = 'workers/migrations/0065_add_result_canonical_class_scope.sql';
let db: DatabaseSync | null = null;

const createDatabase = () => {
  db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      teacher_username TEXT NOT NULL,
      created_at TEXT NOT NULL,
      archived_at TEXT
    );
    CREATE TABLE students (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      full_name TEXT NOT NULL,
      class_id TEXT,
      archived_at TEXT
    );
    CREATE TABLE assignments (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      class_id TEXT NOT NULL
    );
    CREATE TABLE results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT,
      assignment_id TEXT,
      student_name TEXT NOT NULL,
      class_name TEXT DEFAULT '',
      quiz_id TEXT DEFAULT '',
      submitted_at TEXT NOT NULL
    );
  `);
  return db;
};

const classIdFor = (resultId: number): string | null => {
  const row = db!.prepare('SELECT class_id FROM results WHERE id = ?').get(resultId) as { class_id: string | null };
  return row.class_id;
};

afterEach(() => {
  db?.close();
  db = null;
});

describe('0065 canonical result class scope migration', () => {
  it('backfills assignment first, student only on matching class name, and unique legacy names without guessing conflicts', () => {
    const database = createDatabase();
    database.exec(`
      INSERT INTO classes (id, name, teacher_username, created_at) VALUES
        ('class-a', '4A', 'teacher-a', '2026-08-01'),
        ('class-b', '4B', 'teacher-b', '2026-08-01'),
        ('class-c1', '5A', 'teacher-a', '2026-08-01'),
        ('class-c2', '5A', 'teacher-b', '2026-08-01'),
        ('class-d', '6A', 'teacher-a', '2026-08-01');
      INSERT INTO students (id, username, full_name, class_id) VALUES
        ('student-a', 'student-a', 'An', 'class-a'),
        ('student-b', 'student-b', 'Binh', 'class-b');
      INSERT INTO assignments (id, quiz_id, class_id) VALUES
        ('assignment-b', 'quiz-1', 'class-b');
      INSERT INTO results (id, student_id, assignment_id, student_name, class_name, quiz_id, submitted_at) VALUES
        (1, 'student-a', 'assignment-b', 'An', '4A', 'quiz-1', '2026-08-01T01:00:00Z'),
        (2, 'student-a', NULL, 'An', '4A', 'quiz-1', '2026-08-01T02:00:00Z'),
        (3, 'student-a', NULL, 'An', '4B', 'quiz-1', '2026-08-01T03:00:00Z'),
        (4, NULL, NULL, 'Legacy', ' 6a ', 'quiz-1', '2026-08-01T04:00:00Z'),
        (5, NULL, NULL, 'Legacy Duplicate', '5A', 'quiz-1', '2026-08-01T05:00:00Z');
    `);

    database.exec(readFileSync(migrationPath, 'utf8'));

    expect(classIdFor(1)).toBe('class-b');
    expect(classIdFor(2)).toBe('class-a');
    expect(classIdFor(3)).toBeNull();
    expect(classIdFor(4)).toBe('class-d');
    expect(classIdFor(5)).toBeNull();
  });

  it('creates indexes used for canonical class pagination and class+quiz pagination', () => {
    const database = createDatabase();
    database.exec(readFileSync(migrationPath, 'utf8'));

    const classPlan = database.prepare(`
      EXPLAIN QUERY PLAN
      SELECT id FROM results
      WHERE class_id = 'class-a'
      ORDER BY submitted_at DESC, id DESC
      LIMIT 20
    `).all() as Array<{ detail: string }>;
    const quizPlan = database.prepare(`
      EXPLAIN QUERY PLAN
      SELECT id FROM results
      WHERE class_id = 'class-a' AND quiz_id = 'quiz-1'
      ORDER BY submitted_at DESC, id DESC
      LIMIT 20
    `).all() as Array<{ detail: string }>;

    expect(classPlan.some((row) => row.detail.includes('idx_results_class_submitted'))).toBe(true);
    expect(quizPlan.some((row) => row.detail.includes('idx_results_class_quiz_submitted'))).toBe(true);
  });
});

// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

let database: DatabaseSync | null = null;
afterEach(() => {
  database?.close();
  database = null;
});

describe('large collection pagination database contracts', () => {
  it('creates measured indexes that the SQLite planner uses for core list reads', () => {
    database = new DatabaseSync(':memory:');
    database.exec(`
      CREATE TABLE results (
        id TEXT PRIMARY KEY, quiz_id TEXT, class_name TEXT, submitted_at TEXT
      );
      CREATE TABLE students (
        id TEXT PRIMARY KEY, class_id TEXT, archived_at TEXT, full_name TEXT
      );
      CREATE TABLE teachers (
        username TEXT PRIMARY KEY, status TEXT, full_name TEXT
      );
      CREATE TABLE gift_orders (
        id TEXT PRIMARY KEY, class_id TEXT, student_id TEXT, status TEXT, updated_at TEXT
      );
      CREATE TABLE notifications (
        id TEXT PRIMARY KEY, user_id TEXT, user_role TEXT, is_read INTEGER, created_at TEXT
      );
    `);
    database.exec(readFileSync('workers/migrations/0051_pagination_indexes.sql', 'utf8'));

    const plans = [
      ['results', "EXPLAIN QUERY PLAN SELECT id FROM results ORDER BY submitted_at DESC, id DESC LIMIT 25", 'idx_results_cursor'],
      ['students', "EXPLAIN QUERY PLAN SELECT id FROM students WHERE class_id='c1' AND archived_at IS NULL ORDER BY full_name COLLATE NOCASE, id LIMIT 25", 'idx_students_class_name_cursor'],
      ['teachers', "EXPLAIN QUERY PLAN SELECT username FROM teachers WHERE status='ACTIVE' ORDER BY full_name COLLATE NOCASE, username LIMIT 25", 'idx_teachers_admin_cursor'],
      ['orders', "EXPLAIN QUERY PLAN SELECT id FROM gift_orders WHERE class_id='c1' ORDER BY updated_at DESC, id DESC LIMIT 25", 'idx_gift_orders_class_cursor'],
      ['notifications', "EXPLAIN QUERY PLAN SELECT id FROM notifications WHERE user_id='u1' AND user_role='teacher' AND is_read=0 ORDER BY created_at DESC, id DESC LIMIT 25", 'idx_notifications_feed_cursor'],
    ] as const;

    for (const [name, sql, expectedIndex] of plans) {
      const detail = database.prepare(sql).all()
        .map((row: Record<string, unknown>) => String(row.detail || ''))
        .join(' ');
      expect(detail, `${name} plan`).toContain(expectedIndex);
    }
  });
});

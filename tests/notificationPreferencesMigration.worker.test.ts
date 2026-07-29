// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../workers/migrations/0050_notification_preferences.sql', import.meta.url),
  'utf8',
);

let db: DatabaseSync | null = null;
afterEach(() => {
  db?.close();
  db = null;
});

describe('notification preference migration', () => {
  it('adds delivery fields, preferences and window-scoped dedupe to a legacy inbox', () => {
    db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_role TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        data TEXT NOT NULL DEFAULT '{}',
        is_read INTEGER NOT NULL DEFAULT 0,
        priority TEXT NOT NULL DEFAULT 'INFO',
        action_url TEXT,
        source_type TEXT,
        source_id TEXT,
        expires_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX idx_notifications_source_dedupe
        ON notifications(user_id, user_role, source_type, source_id, type)
        WHERE source_type IS NOT NULL AND source_id IS NOT NULL;
      INSERT INTO notifications (
        id, user_id, user_role, type, title, priority, is_read, created_at
      ) VALUES ('n1', 's1', 'student', 'system', 'Khẩn', 'URGENT', 1, '2026-07-01T00:00:00.000Z');
    `);
    db.exec(migration);

    const columns = db.prepare("PRAGMA table_info('notifications')").all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toEqual(expect.arrayContaining([
      'severity', 'dedupe_key', 'available_at', 'read_at', 'clicked_at', 'sent_at',
    ]));
    expect(db.prepare('SELECT severity, read_at, sent_at FROM notifications WHERE id = ?')
      .get('n1')).toMatchObject({
        severity: 'critical',
        read_at: '2026-07-01T00:00:00.000Z',
        sent_at: '2026-07-01T00:00:00.000Z',
      });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notification_preferences'")
      .get()).toBeTruthy();

    const insert = db.prepare(`
      INSERT OR IGNORE INTO notifications (
        id, user_id, user_role, type, title, dedupe_key, created_at
      ) VALUES (?, 's1', 'student', 'system', 'T', 'system:resource:1', ?)
    `);
    expect(insert.run('n2', '2026-07-01T01:00:00.000Z').changes).toBe(1);
    expect(insert.run('n3', '2026-07-01T01:01:00.000Z').changes).toBe(0);
  });
});

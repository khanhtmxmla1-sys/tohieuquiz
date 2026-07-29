// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../workers/migrations/0052_auth_sessions_security_events.sql', import.meta.url),
  'utf8',
);

let db: DatabaseSync | null = null;
afterEach(() => {
  db?.close();
  db = null;
});

describe('auth sessions migration', () => {
  it('adds student token versions and privacy-minimal session/security tables', () => {
    db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE students (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE
      );
      INSERT INTO students (id, username) VALUES ('student-1', 'student-a');
    `);
    db.exec(migration);

    const studentColumns = db.prepare("PRAGMA table_info('students')").all() as Array<{ name: string }>;
    expect(studentColumns.map((column) => column.name)).toContain('token_version');
    expect(db.prepare('SELECT token_version FROM students WHERE id = ?').get('student-1'))
      .toMatchObject({ token_version: 1 });

    const sessionColumns = db.prepare("PRAGMA table_info('auth_sessions')").all() as Array<{ name: string }>;
    expect(sessionColumns.map((column) => column.name)).toEqual(expect.arrayContaining([
      'id', 'username', 'role', 'token_version', 'purpose', 'user_agent_family',
      'created_at', 'last_seen_at', 'expires_at', 'revoked_at', 'revoked_reason', 'revoked_by',
    ]));
    expect(sessionColumns.map((column) => column.name)).not.toEqual(expect.arrayContaining([
      'ip', 'ip_address', 'user_agent', 'token',
    ]));

    const eventColumns = db.prepare("PRAGMA table_info('security_events')").all() as Array<{ name: string }>;
    expect(eventColumns.map((column) => column.name)).not.toEqual(expect.arrayContaining([
      'ip', 'ip_address', 'password', 'token',
    ]));
  });
});

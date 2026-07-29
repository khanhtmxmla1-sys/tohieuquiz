// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertActiveAuthSession,
  createAuthSession,
  purgeExpiredAuthSecurityData,
  revokeAllAuthSessions,
  revokeAuthSession,
} from '../workers/src/services/authSessionService';
import { verifyJWTMiddleware } from '../workers/src/middleware/jwtAuth';
import { signJWT } from '../workers/src/utils/jwt';

class SqliteStatement {
  private bindings: unknown[] = [];
  constructor(private readonly statement: ReturnType<DatabaseSync['prepare']>) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { return (this.statement.get(...this.bindings) ?? null) as T | null; }
  async all<T>() { return { results: this.statement.all(...this.bindings) as T[] }; }
  async run() {
    const result = this.statement.run(...this.bindings);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

class SqliteD1 {
  constructor(readonly sqlite: DatabaseSync) {}
  prepare(sql: string) { return new SqliteStatement(this.sqlite.prepare(sql)); }
  async batch(statements: SqliteStatement[]) {
    this.sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }
}

const migration = readFileSync(
  new URL('../workers/migrations/0052_auth_sessions_security_events.sql', import.meta.url),
  'utf8',
);

let sqlite: DatabaseSync | null = null;
afterEach(() => {
  sqlite?.close();
  sqlite = null;
});

const setup = () => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE students (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE
    );
    CREATE TABLE teachers (
      username TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      token_version INTEGER NOT NULL,
      must_change_password INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO teachers (username, status, token_version, must_change_password)
    VALUES ('teacher-a', 'ACTIVE', 1, 0), ('teacher-b', 'ACTIVE', 1, 0);
  `);
  sqlite.exec(migration);
  return new SqliteD1(sqlite) as unknown as D1Database;
};

const request = (ua = 'Mozilla/5.0 Chrome/150.0.0.0') => new Request(
  'https://api.test/api/account/sessions',
  { headers: { 'user-agent': ua, 'x-request-id': 'req-session-test' } },
);

describe('auth session lifecycle', () => {
  it('revokes one session and rejects its next authenticated request', async () => {
    const db = setup();
    const user = { username: 'teacher-a', role: 'teacher' as const, tokenVersion: 1 };
    const session = await createAuthSession(db, request(), user, {
      now: new Date('2026-07-29T08:00:00.000Z'),
    });
    const token = await signJWT({ ...user, sessionId: session.id }, 'a-test-secret-that-is-long-enough');
    const env = {
      DB: db,
      JWT_SECRET: 'a-test-secret-that-is-long-enough',
      AUTH_MIGRATION_MODE: 'enforce',
      AUTH_SESSION_MODE: 'enforce',
    } as any;

    const before = await verifyJWTMiddleware(new Request('https://api.test/api/results', {
      headers: { Cookie: `auth_token=${token}` },
    }), env);
    expect(before).not.toBeInstanceOf(Response);

    expect(await revokeAuthSession(db, user, session.id, {
      requestId: 'req-revoke-one',
      now: new Date('2026-07-29T08:05:00.000Z'),
    })).toBe(true);

    const after = await verifyJWTMiddleware(new Request('https://api.test/api/results', {
      headers: { Cookie: `auth_token=${token}` },
    }), env);
    expect(after).toBeInstanceOf(Response);
    expect((after as Response).status).toBe(401);
  });

  it('logout-all cutoff leaves sessions created afterward active', async () => {
    const db = setup();
    const user = { username: 'teacher-a', role: 'teacher' as const, tokenVersion: 1 };
    const oldSession = await createAuthSession(db, request(), user, {
      now: new Date('2026-07-29T08:00:00.000Z'),
    });
    const cutoff = new Date('2026-07-29T09:00:00.000Z');
    const newSession = await createAuthSession(db, request('Firefox/140.0'), user, {
      now: new Date('2026-07-29T10:00:00.000Z'),
    });

    expect(await revokeAllAuthSessions(db, user, {
      requestId: 'req-logout-all',
      cutoff,
      now: cutoff,
    })).toBe(1);
    expect(await assertActiveAuthSession(db, { ...user, sessionId: oldSession.id }, cutoff)).toBe(false);
    expect(await assertActiveAuthSession(db, { ...user, sessionId: newSession.id }, cutoff)).toBe(true);
  });

  it('prevents cross-owner revocation and purges records older than 90 days', async () => {
    const db = setup();
    const owner = { username: 'teacher-a', role: 'teacher' as const, tokenVersion: 1 };
    const other = { username: 'teacher-b', role: 'teacher' as const, tokenVersion: 1 };
    const session = await createAuthSession(db, request(), owner, {
      now: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(await revokeAuthSession(db, other, session.id, {
      requestId: 'req-cross-owner',
      now: new Date('2026-01-02T00:00:00.000Z'),
    })).toBe(false);
    const purged = await purgeExpiredAuthSecurityData(db, new Date('2026-07-29T00:00:00.000Z'));
    expect(purged.sessions).toBe(1);
  });
});

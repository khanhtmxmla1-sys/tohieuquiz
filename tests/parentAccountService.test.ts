// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import { createParentAccountService, ParentAccountError } from '../workers/src/parentPortal/accountService';
import type { ParentEmailMessage, ParentEmailProvider } from '../workers/src/parentPortal/emailProvider';
import { hashParentPin, verifyParentPin } from '../workers/src/parentPortal/crypto';

class SQLiteStatement {
  private bindings: unknown[] = [];
  constructor(private readonly database: DatabaseSync, private readonly sql: string) {}
  bind(...bindings: unknown[]) { this.bindings = bindings; return this; }
  async first<T>() { return this.database.prepare(this.sql).get(...this.bindings as any[]) as T | null; }
  async all<T>() { return { results: this.database.prepare(this.sql).all(...this.bindings as any[]) as T[] }; }
  async run() {
    const result = this.database.prepare(this.sql).run(...this.bindings as any[]);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

class SQLiteD1Adapter {
  constructor(private readonly database: DatabaseSync) {}
  prepare(sql: string) { return new SQLiteStatement(this.database, sql); }
  async batch(statements: SQLiteStatement[]) { return Promise.all(statements.map(statement => statement.run())); }
}

const setup = async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec(`
    CREATE TABLE students (id TEXT PRIMARY KEY);
    CREATE TABLE parent_links (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      access_code TEXT NOT NULL UNIQUE,
      pin_hash TEXT,
      status TEXT NOT NULL,
      token_version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      activated_at TEXT,
      revoked_at TEXT,
      last_accessed_at TEXT,
      FOREIGN KEY(student_id) REFERENCES students(id)
    );
    INSERT INTO students(id) VALUES ('student-1');
  `);
  sqlite.exec(readFileSync('workers/migrations/0048_parent_digest_recovery.sql', 'utf8'));
  sqlite.prepare(`
    INSERT INTO parent_links (
      id, student_id, access_code, pin_hash, status, token_version, created_by, created_at, activated_at
    ) VALUES (?, ?, ?, ?, 'ACTIVE', 3, 'teacher-a', ?, ?)
  `).run(
    'link-1',
    'student-1',
    'ABCDEFG234',
    await hashParentPin('123456'),
    '2026-07-20T00:00:00.000Z',
    '2026-07-20T00:00:00.000Z',
  );
  sqlite.prepare(`
    INSERT INTO parent_contact_preferences (
      link_id, email, email_normalized, email_verified_at,
      weekly_digest_enabled, digest_weekday, digest_hour, timezone,
      quiet_hours_enabled, quiet_hours_start_minute, quiet_hours_end_minute,
      email_kinds_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 1, 1, 19, 'Asia/Ho_Chi_Minh', 1, 1260, 420, '[]', ?, ?)
  `).run(
    'link-1', 'parent@example.com', 'parent@example.com',
    '2026-07-20T00:00:00.000Z', '2026-07-20T00:00:00.000Z', '2026-07-20T00:00:00.000Z',
  );
  const messages: ParentEmailMessage[] = [];
  const provider: ParentEmailProvider = {
    ready: true,
    reason: null,
    send: vi.fn(async (message: ParentEmailMessage) => {
      messages.push(message);
      return { messageId: `message-${messages.length}` };
    }),
  };
  return {
    sqlite,
    db: new SQLiteD1Adapter(sqlite) as unknown as D1Database,
    provider,
    messages,
  };
};

const tokenFromMessage = (message: ParentEmailMessage): string => {
  const match = message.text.match(/[?&]token=([^&\s]+)/);
  if (!match) throw new Error('Token missing from email fixture');
  return decodeURIComponent(match[1]);
};

const now = new Date('2026-07-29T08:00:00.000Z');

describe('parent contact and account recovery service', () => {
  it('stores only a token hash, verifies the current email once and rejects replay', async () => {
    const { sqlite, db, provider, messages } = await setup();
    const service = createParentAccountService(db, provider, 'https://phuhuynh.test');

    await service.updatePreferences('link-1', {
      email: 'New.Parent@example.com',
      weeklyDigestEnabled: false,
      digestWeekday: 1,
      digestHour: 19,
      quietHoursEnabled: true,
      quietHoursStart: '21:00',
      quietHoursEnd: '07:00',
      emailKinds: ['quiz_result', 'homework_due'],
    }, now, 'request-preferences');
    const unverified = sqlite.prepare('SELECT email_normalized, email_verified_at FROM parent_contact_preferences').get();
    expect(unverified).toEqual({ email_normalized: 'new.parent@example.com', email_verified_at: null });
    const optOut = await service.updatePreferences('link-1', {
      email: 'New.Parent@example.com', weeklyDigestEnabled: false, digestWeekday: 1, digestHour: 19,
      quietHoursEnabled: true, quietHoursStart: '21:00', quietHoursEnd: '07:00', emailKinds: [],
    }, now, 'request-opt-out');
    expect(optOut.emailKinds).toEqual([]);

    await service.requestEmailVerification('link-1', now, 'request-verify');
    const token = tokenFromMessage(messages[0]);
    const stored = sqlite.prepare(`
      SELECT token_hash, consumed_at FROM parent_contact_tokens WHERE purpose = 'EMAIL_VERIFICATION'
    `).get() as { token_hash: string; consumed_at: string | null };
    expect(stored.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.token_hash).not.toBe(token);
    expect(JSON.stringify(stored)).not.toContain(token);

    await expect(service.verifyEmail(token, new Date(now.getTime() + 60_000), 'request-consume'))
      .resolves.toEqual({ verified: true });
    expect(sqlite.prepare('SELECT email_verified_at FROM parent_contact_preferences').get())
      .toEqual({ email_verified_at: '2026-07-29T08:01:00.000Z' });
    await expect(service.verifyEmail(token, new Date(now.getTime() + 120_000), 'request-replay'))
      .rejects.toMatchObject({ code: 'PARENT_TOKEN_INVALID', status: 410 });
  });

  it('returns the same recovery response for a mismatch, resets a matching PIN once and invalidates old sessions', async () => {
    const { sqlite, db, provider, messages } = await setup();
    const service = createParentAccountService(db, provider, 'https://phuhuynh.test');

    await expect(service.requestRecovery('ABCDEFG234', 'wrong@example.com', now, 'request-mismatch'))
      .resolves.toEqual({ requested: true });
    expect(messages).toHaveLength(0);

    const randomSpy = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementationOnce((array: any) => {
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      bytes.fill(0);
      bytes[0] = 0xe0; // Base64url token starts with "4A", matching the class-like fragment below.
      return array;
    });
    try {
      await expect(service.requestRecovery('ABCDEFG234', 'parent@example.com', now, 'request-recovery'))
        .resolves.toEqual({ requested: true });
    } finally {
      randomSpy.mockRestore();
    }
    expect(messages).toHaveLength(1);
    const token = tokenFromMessage(messages[0]);
    expect(token).toMatch(/^4A/);
    expect(messages[0].text.replace(token, '[recovery-token]'))
      .not.toMatch(/student-1|teacher-a|Nguyễn|4A/i);

    await expect(service.confirmRecovery(token, '654321', new Date(now.getTime() + 60_000), 'request-reset'))
      .resolves.toEqual({ reset: true });
    const link = sqlite.prepare('SELECT pin_hash, token_version FROM parent_links WHERE id = ?').get('link-1') as {
      pin_hash: string;
      token_version: number;
    };
    expect(link.token_version).toBe(4);
    await expect(verifyParentPin('654321', link.pin_hash)).resolves.toBe(true);
    await expect(verifyParentPin('123456', link.pin_hash)).resolves.toBe(false);
    await expect(service.confirmRecovery(token, '111111', new Date(now.getTime() + 120_000), 'request-reset-replay'))
      .rejects.toBeInstanceOf(ParentAccountError);
    expect((sqlite.prepare('SELECT token_version FROM parent_links WHERE id = ?').get('link-1') as any).token_version).toBe(4);
  });

  it('fails closed when email rollout authentication is not ready', async () => {
    const { db } = await setup();
    const service = createParentAccountService(db, {
      ready: false,
      reason: 'domain_authentication_incomplete',
      send: vi.fn(async () => { throw new Error('should not send'); }),
    }, 'https://phuhuynh.test');

    await expect(service.requestEmailVerification('link-1', now, 'request-closed'))
      .rejects.toMatchObject({ code: 'PARENT_EMAIL_UNAVAILABLE', status: 503 });
    await expect(service.updatePreferences('link-1', {
      email: 'parent@example.com',
      weeklyDigestEnabled: true,
      digestWeekday: 1,
      digestHour: 19,
      quietHoursEnabled: true,
      quietHoursStart: '21:00',
      quietHoursEnd: '07:00',
      emailKinds: ['quiz_result'],
    }, now, 'request-enable-closed')).rejects.toMatchObject({ code: 'PARENT_EMAIL_UNAVAILABLE' });
  });
});

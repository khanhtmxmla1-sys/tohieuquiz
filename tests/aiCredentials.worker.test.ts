// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAiCredentialRoutes } from '../workers/src/routes/aiCredentials';
import { createSqliteD1 } from './helpers/sqliteD1';

const authState = vi.hoisted(() => ({
  result: { user: { username: 'teacher-a', role: 'teacher', tokenVersion: 1 } } as any,
}));
const rateLimitMock = vi.hoisted(() => vi.fn(async () => null as Response | null));

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => authState.result),
  requireTeacher: vi.fn((user: { role?: string }) => user.role === 'teacher' || user.role === 'admin'),
}));

vi.mock('../workers/src/middleware/rateLimit', () => ({
  rateLimit: rateLimitMock,
}));

const migrationPath = 'workers/migrations/0083_teacher_ai_credentials.sql';

const base64Key = () => {
  const bytes = new Uint8Array(32);
  bytes.forEach((_, index) => { bytes[index] = index + 1; });
  return btoa(String.fromCharCode(...bytes));
};

let sqlite: DatabaseSync;
let env: any;
let fetchSpy: ReturnType<typeof vi.spyOn>;

const setupDatabase = () => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE teachers (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'teacher',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      token_version INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE feature_flags (
      flag_key TEXT PRIMARY KEY,
      description TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 0,
      owner TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE feature_flag_rules (
      flag_key TEXT PRIMARY KEY,
      audience TEXT NOT NULL DEFAULT 'all',
      percentage INTEGER NOT NULL DEFAULT 100,
      allow_users_json TEXT NOT NULL DEFAULT '[]',
      allow_classes_json TEXT NOT NULL DEFAULT '[]',
      starts_at TEXT,
      ends_at TEXT,
      stop_conditions_json TEXT NOT NULL DEFAULT '{}',
      reason TEXT NOT NULL DEFAULT '',
      updated_by TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (flag_key) REFERENCES feature_flags(flag_key) ON DELETE CASCADE
    );
    CREATE TABLE ai_generation_actions (
      action_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      workflow TEXT NOT NULL,
      status TEXT NOT NULL,
      usage_date TEXT NOT NULL,
      upstream_calls INTEGER NOT NULL DEFAULT 0,
      ocr_calls INTEGER NOT NULL DEFAULT 0,
      generate_calls INTEGER NOT NULL DEFAULT 0,
      review_calls INTEGER NOT NULL DEFAULT 0,
      repair_calls INTEGER NOT NULL DEFAULT 0,
      failure_code TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE TABLE security_events (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      actor_username TEXT,
      session_id TEXT,
      request_id TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    INSERT INTO teachers (username, name) VALUES
      ('teacher-a', 'Teacher A'),
      ('teacher-b', 'Teacher B');
  `);
  sqlite.exec(readFileSync(migrationPath, 'utf8'));

  env = {
    DB: createSqliteD1(sqlite),
    JWT_SECRET: 'test-secret',
    AI_CREDENTIAL_KEYRING: JSON.stringify({ activeKeyId: 'v1', keys: { v1: base64Key() } }),
    ENVIRONMENT: 'test',
  };
};

const enableByok = () => {
  sqlite.prepare("UPDATE feature_flags SET enabled = 1 WHERE flag_key = 'teacher_ai_byok_v1'").run();
  sqlite.prepare("UPDATE feature_flag_rules SET percentage = 100 WHERE flag_key = 'teacher_ai_byok_v1'").run();
};

const request = (
  path: string,
  method: 'GET' | 'PUT' | 'POST' | 'DELETE',
  body?: unknown,
  headers: Record<string, string> = {},
) => new Request(`https://api.thtohieu.com${path}`, {
  method,
  headers: {
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    'CF-Connecting-IP': '203.0.113.8',
    'x-request-id': 'req-ai-key-1',
    ...headers,
  },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const providerOk = () => new Response(JSON.stringify({
  choices: [{ message: { content: 'OK' } }],
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  setupDatabase();
  authState.result = { user: { username: 'teacher-a', role: 'teacher', tokenVersion: 1 } };
  rateLimitMock.mockReset();
  rateLimitMock.mockResolvedValue(null);
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(providerOk());
});

afterEach(() => {
  fetchSpy.mockRestore();
  sqlite.close();
});

describe('teacher AI credential routes', () => {
  it('returns only metadata for both providers while BYOK is disabled', async () => {
    const response = await handleAiCredentialRoutes(
      request('/api/account/ai-credentials', 'GET'),
      env,
      '/api/account/ai-credentials',
      'GET',
    );

    expect(response?.status).toBe(200);
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
    const payload = await response?.json() as any;
    expect(payload.enabled).toBe(false);
    expect(payload.credentials).toEqual([
      expect.objectContaining({ provider: 'gemini', configured: false, last4: null, version: 0 }),
      expect.objectContaining({ provider: 'deepseek', configured: false, last4: null, version: 0 }),
    ]);
    expect(JSON.stringify(payload)).not.toContain('ciphertext');
  });

  it('blocks save/test when the feature is off but still allows deletion', async () => {
    const blocked = await handleAiCredentialRoutes(
      request('/api/account/ai-credentials/gemini', 'PUT', {
        apiKey: 'gemini-canary-key-123456789',
        expectedVersion: 0,
      }),
      env,
      '/api/account/ai-credentials/gemini',
      'PUT',
    );
    expect(blocked?.status).toBe(403);
    await expect(blocked?.json()).resolves.toMatchObject({ code: 'AI_BYOK_DISABLED' });
    expect(fetchSpy).not.toHaveBeenCalled();

    const deleted = await handleAiCredentialRoutes(
      request('/api/account/ai-credentials/gemini', 'DELETE', undefined, { 'If-Match': '1' }),
      env,
      '/api/account/ai-credentials/gemini',
      'DELETE',
    );
    expect(deleted?.status).toBe(200);
  });

  it('verifies then saves ciphertext for the authenticated owner and never returns plaintext/ciphertext', async () => {
    enableByok();
    const canary = 'gemini-canary-key-123456789';

    const response = await handleAiCredentialRoutes(
      request('/api/account/ai-credentials/gemini', 'PUT', { apiKey: canary, expectedVersion: 0 }),
      env,
      '/api/account/ai-credentials/gemini',
      'PUT',
    );

    expect(response?.status).toBe(200);
    const text = await response!.text();
    expect(text).not.toContain(canary);
    expect(text).not.toContain('ciphertext');

    const row = sqlite.prepare(`
      SELECT username, provider, ciphertext, last4, version
      FROM teacher_ai_credentials
    `).get() as any;
    expect(row).toMatchObject({
      username: 'teacher-a',
      provider: 'gemini',
      last4: '6789',
      version: 1,
    });
    expect(row.ciphertext).not.toContain(canary);
    const audit = sqlite.prepare(`
      SELECT event_type, provider, operation, result_code, request_id
      FROM teacher_ai_credential_audit
      ORDER BY created_at DESC LIMIT 1
    `).get();
    expect(audit).toEqual({
      event_type: 'AI_KEY_SAVED',
      provider: 'gemini',
      operation: 'save',
      result_code: 'OK',
      request_id: 'req-ai-key-1',
    });
    expect(JSON.stringify(audit)).not.toContain(canary);
    expect(rateLimitMock).toHaveBeenCalledTimes(2);
  });

  it('fails before provider access when the credential vault is unavailable', async () => {
    enableByok();
    delete env.AI_CREDENTIAL_KEYRING;

    const response = await handleAiCredentialRoutes(
      request('/api/account/ai-credentials/gemini', 'PUT', {
        apiKey: 'gemini-canary-key-123456789',
        expectedVersion: 0,
      }),
      env,
      '/api/account/ai-credentials/gemini',
      'PUT',
    );

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({ code: 'AI_VAULT_UNAVAILABLE' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM teacher_ai_credentials').get())
      .toEqual({ count: 0 });
  });

  it('rolls back save and delete mutations when their audit record cannot be persisted', async () => {
    enableByok();
    sqlite.exec('DROP TABLE teacher_ai_credential_audit');

    const failedSave = await handleAiCredentialRoutes(
      request('/api/account/ai-credentials/gemini', 'PUT', {
        apiKey: 'gemini-canary-key-123456789',
        expectedVersion: 0,
      }),
      env,
      '/api/account/ai-credentials/gemini',
      'PUT',
    );
    expect(failedSave?.status).toBe(503);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM teacher_ai_credentials').get())
      .toEqual({ count: 0 });

    sqlite.exec(`
      CREATE TABLE teacher_ai_credential_audit (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        role TEXT NOT NULL,
        event_type TEXT NOT NULL,
        provider TEXT NOT NULL,
        operation TEXT NOT NULL,
        result_code TEXT NOT NULL,
        request_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    const saved = await handleAiCredentialRoutes(
      request('/api/account/ai-credentials/gemini', 'PUT', {
        apiKey: 'gemini-canary-key-123456789',
        expectedVersion: 0,
      }),
      env,
      '/api/account/ai-credentials/gemini',
      'PUT',
    );
    expect(saved?.status).toBe(200);

    sqlite.exec('DROP TABLE teacher_ai_credential_audit');
    const failedDelete = await handleAiCredentialRoutes(
      request('/api/account/ai-credentials/gemini', 'DELETE', undefined, { 'If-Match': '1' }),
      env,
      '/api/account/ai-credentials/gemini',
      'DELETE',
    );
    expect(failedDelete?.status).toBe(503);
    expect(sqlite.prepare(`
      SELECT last4, version FROM teacher_ai_credentials
      WHERE username = 'teacher-a' AND provider = 'gemini'
    `).get()).toEqual({ last4: '6789', version: 1 });
  });

  it('rejects stale versions before spending another provider request and preserves the old key on provider failure', async () => {
    enableByok();
    await handleAiCredentialRoutes(
      request('/api/account/ai-credentials/gemini', 'PUT', {
        apiKey: 'gemini-old-key-123456789012',
        expectedVersion: 0,
      }),
      env,
      '/api/account/ai-credentials/gemini',
      'PUT',
    );
    fetchSpy.mockClear();

    const stale = await handleAiCredentialRoutes(
      request('/api/account/ai-credentials/gemini', 'PUT', {
        apiKey: 'gemini-stale-key-123456789',
        expectedVersion: 0,
      }),
      env,
      '/api/account/ai-credentials/gemini',
      'PUT',
    );
    expect(stale?.status).toBe(409);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockResolvedValueOnce(new Response(
      JSON.stringify({ error: { message: 'invalid gemini-new-key-123456789' } }),
      { status: 401 },
    ));
    const invalid = await handleAiCredentialRoutes(
      request('/api/account/ai-credentials/gemini', 'PUT', {
        apiKey: 'gemini-new-key-123456789',
        expectedVersion: 1,
      }),
      env,
      '/api/account/ai-credentials/gemini',
      'PUT',
    );
    expect(invalid?.status).toBe(400);
    await expect(invalid?.json()).resolves.toMatchObject({ code: 'AI_KEY_INVALID' });
    expect(sqlite.prepare(`
      SELECT last4, version FROM teacher_ai_credentials
      WHERE username = 'teacher-a' AND provider = 'gemini'
    `).get()).toEqual({ last4: '9012', version: 1 });
  });

  it('uses the stored server-side key for retest and supports conditional delete even when flag is later disabled', async () => {
    enableByok();
    await handleAiCredentialRoutes(
      request('/api/account/ai-credentials/deepseek', 'PUT', {
        apiKey: 'deepseek-canary-key-123456789',
        expectedVersion: 0,
      }),
      env,
      '/api/account/ai-credentials/deepseek',
      'PUT',
    );
    fetchSpy.mockClear();
    sqlite.prepare(`
      UPDATE teacher_ai_credentials
      SET verified_at = '2000-01-01T00:00:00.000Z', updated_at = '2000-01-01T00:00:00.000Z'
      WHERE username = 'teacher-a' AND provider = 'deepseek'
    `).run();

    const retest = await handleAiCredentialRoutes(
      request('/api/account/ai-credentials/deepseek/test', 'POST'),
      env,
      '/api/account/ai-credentials/deepseek/test',
      'POST',
    );
    expect(retest?.status).toBe(200);
    const retestPayload = await retest?.json() as any;
    expect(retestPayload.credential.verifiedAt).not.toBe('2000-01-01T00:00:00.000Z');
    expect(sqlite.prepare(`
      SELECT verified_at FROM teacher_ai_credentials
      WHERE username = 'teacher-a' AND provider = 'deepseek'
    `).get()).toEqual({ verified_at: retestPayload.credential.verifiedAt });
    expect(new Headers(fetchSpy.mock.calls[0][1]?.headers).get('Authorization'))
      .toBe('Bearer deepseek-canary-key-123456789');

    sqlite.prepare("UPDATE feature_flags SET enabled = 0 WHERE flag_key = 'teacher_ai_byok_v1'").run();
    const staleDelete = await handleAiCredentialRoutes(
      request('/api/account/ai-credentials/deepseek', 'DELETE', undefined, { 'If-Match': '2' }),
      env,
      '/api/account/ai-credentials/deepseek',
      'DELETE',
    );
    expect(staleDelete?.status).toBe(409);

    const deleted = await handleAiCredentialRoutes(
      request('/api/account/ai-credentials/deepseek', 'DELETE', undefined, { 'If-Match': '1' }),
      env,
      '/api/account/ai-credentials/deepseek',
      'DELETE',
    );
    expect(deleted?.status).toBe(200);
    expect(sqlite.prepare('SELECT * FROM teacher_ai_credentials').all()).toEqual([]);
  });

  it.each([
    ['student', { user: { username: 'student-a', role: 'student', tokenVersion: 1 } }, 403],
    ['anonymous', new Response('{}', { status: 401 }), 401],
    ['inactive session', new Response('{}', { status: 401 }), 401],
  ])('blocks %s before provider access', async (_label, authResult, status) => {
    enableByok();
    authState.result = authResult as any;
    const response = await handleAiCredentialRoutes(
      request('/api/account/ai-credentials/gemini', 'PUT', {
        apiKey: 'gemini-canary-key-123456789',
        expectedVersion: 0,
      }),
      env,
      '/api/account/ai-credentials/gemini',
      'PUT',
    );
    expect(response?.status).toBe(status);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects spoofed owner, unknown fields, malformed provider and oversized bodies before provider access', async () => {
    enableByok();

    for (const [path, body] of [
      ['/api/account/ai-credentials/gemini', {
        apiKey: 'gemini-canary-key-123456789',
        expectedVersion: 0,
        username: 'teacher-b',
      }],
      ['/api/account/ai-credentials/gemini', {
        apiKey: 'gemini key has spaces 123456789',
        expectedVersion: 0,
      }],
      ['/api/account/ai-credentials/openai', {
        apiKey: 'openai-canary-key-123456789',
        expectedVersion: 0,
      }],
    ] as const) {
      const response = await handleAiCredentialRoutes(request(path, 'PUT', body), env, path, 'PUT');
      expect(response?.status).toBe(400);
    }

    const oversized = new Request('https://api.thtohieu.com/api/account/ai-credentials/gemini', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '203.0.113.8',
      },
      body: JSON.stringify({
        apiKey: 'x'.repeat(9000),
        expectedVersion: 0,
      }),
    });
    const oversizedResponse = await handleAiCredentialRoutes(
      oversized,
      env,
      '/api/account/ai-credentials/gemini',
      'PUT',
    );
    expect(oversizedResponse?.status).toBe(413);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

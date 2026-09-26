// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAiProxy } from '../workers/src/routes/aiProxy';
import { encryptCredential } from '../workers/src/services/aiCredentials/crypto';
import { saveCredential } from '../workers/src/services/aiCredentials/repository';
import { createSqliteD1 } from './helpers/sqliteD1';

const authState = vi.hoisted(() => ({
  user: { username: 'teacher-a', role: 'teacher' },
}));
const rateLimitMock = vi.hoisted(() => vi.fn(async () => null as Response | null));

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({ user: authState.user })),
  requireTeacher: vi.fn((user: { role?: string }) => user.role === 'teacher' || user.role === 'admin'),
}));

vi.mock('../workers/src/middleware/rateLimit', () => ({
  rateLimit: rateLimitMock,
}));

const migrationPath = 'workers/migrations/0083_teacher_ai_credentials.sql';
const keyring = (() => {
  const bytes = new Uint8Array(32);
  bytes.forEach((_, index) => { bytes[index] = index + 11; });
  return JSON.stringify({
    activeKeyId: 'v1',
    keys: { v1: btoa(String.fromCharCode(...bytes)) },
  });
})();

let sqlite: DatabaseSync;
let db: D1Database;
let env: any;
let gatewayFetch: ReturnType<typeof vi.fn>;
let fetchSpy: ReturnType<typeof vi.spyOn>;
let actionCounter = 0;

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
    CREATE TABLE teacher_ai_daily_usage (
      username TEXT NOT NULL,
      usage_date TEXT NOT NULL,
      used_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (username, usage_date)
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
    INSERT INTO teachers (username, name) VALUES
      ('teacher-a', 'Teacher A'),
      ('teacher-b', 'Teacher B');
  `);
  sqlite.exec(readFileSync(migrationPath, 'utf8'));
  db = createSqliteD1(sqlite);
};

const enableByok = () => {
  sqlite.prepare("UPDATE feature_flags SET enabled = 1 WHERE flag_key = 'teacher_ai_byok_v1'").run();
  sqlite.prepare("UPDATE feature_flag_rules SET percentage = 100 WHERE flag_key = 'teacher_ai_byok_v1'").run();
};

const seedCredential = async (
  provider: 'gemini' | 'deepseek',
  apiKey: string,
  expectedVersion = 0,
) => {
  const cipher = await encryptCredential(keyring, 'teacher-a', provider, apiKey);
  return saveCredential(db, 'teacher-a', provider, cipher, apiKey.slice(-4), expectedVersion);
};

const nextActionId = () => `ai-byok-action-${String(++actionCounter).padStart(10, '0')}-abcdef`;

const request = (body: Record<string, unknown>) => new Request('https://api.thtohieu.com/api/ai/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'CF-Connecting-IP': '203.0.113.9',
  },
  body: JSON.stringify(body),
});

const personalBody = (
  source: 'gemini-personal' | 'deepseek-personal',
  actionId = nextActionId(),
  stage: 'GENERATE' | 'REVIEW' = 'GENERATE',
  overrides: Record<string, unknown> = {},
) => ({
  source,
  model: 'gemini-2.5-flash',
  messages: [
    { role: 'system', content: 'Return JSON.' },
    { role: 'user', content: [{ type: 'text', text: 'Create a short quiz.' }] },
  ],
  temperature: 0.4,
  response_format: { type: 'json_object' },
  _meta: {
    actionId,
    workflow: 'QUIZ_CREATE',
    stage,
  },
  ...overrides,
});

beforeEach(() => {
  setupDatabase();
  enableByok();
  gatewayFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    choices: [{ message: { content: 'system-result' } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  env = {
    DB: db,
    AI_GATEWAY: { fetch: gatewayFetch },
    CLIPROXY_API: 'https://ai-gateway.internal/v1',
    CLIPROXY_TOKEN: 'system-token',
    JWT_SECRET: 'test-secret',
    AI_CREDENTIAL_KEYRING: keyring,
  };
  rateLimitMock.mockReset();
  rateLimitMock.mockResolvedValue(null);
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    choices: [{ message: { content: '{"questions":[]}' } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
});

afterEach(() => {
  fetchSpy.mockRestore();
  sqlite.close();
});

describe('/api/ai/chat personal BYOK dispatch', () => {
  it('keeps source omitted on the existing system gateway path', async () => {
    const response = await handleAiProxy(request({
      model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: 'system' }],
      _meta: { actionId: nextActionId(), workflow: 'QUIZ_CREATE', stage: 'GENERATE' },
    }), env, '/api/ai/chat', 'POST');

    expect(response?.status).toBe(200);
    expect(gatewayFetch).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('loads the authenticated teacher Gemini key server-side and never uses the system gateway as fallback', async () => {
    await seedCredential('gemini', 'gemini-personal-secret-123456789');
    const body = personalBody('gemini-personal');
    const actionId = (body._meta as any).actionId;

    const response = await handleAiProxy(request(body), env, '/api/ai/chat', 'POST');

    expect(response?.status).toBe(200);
    expect(gatewayFetch).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer gemini-personal-secret-123456789');
    const upstream = JSON.parse(String(init?.body));
    expect(upstream.model).toBe('gemini-3.8-flash');
    expect(upstream.source).toBeUndefined();
    expect(upstream._meta).toBeUndefined();
    expect(upstream.stream).toBe(false);
    await expect(response?.json()).resolves.toEqual({
      choices: [{ message: { content: '{"questions":[]}' } }],
    });

    expect(sqlite.prepare(`
      SELECT source, credential_version, ai_model, generate_calls, active_stage
      FROM ai_generation_actions WHERE action_id = ?
    `).get(actionId)).toEqual({
      source: 'gemini-personal',
      credential_version: 1,
      ai_model: 'gemini-3.8-flash',
      generate_calls: 1,
      active_stage: null,
    });
  });

  it('fails closed for disabled BYOK, missing key, missing vault, unsupported workflow/input/model without upstream calls', async () => {
    await seedCredential('gemini', 'gemini-personal-secret-123456789');
    const cases: Array<{
      label: string;
      prepare?: () => void;
      body: Record<string, unknown>;
      status: number;
      code: string;
    }> = [
      {
        label: 'disabled',
        prepare: () => sqlite.prepare("UPDATE feature_flags SET enabled = 0 WHERE flag_key = 'teacher_ai_byok_v1'").run(),
        body: personalBody('gemini-personal'),
        status: 403,
        code: 'AI_BYOK_DISABLED',
      },
      {
        label: 'generic workflow',
        body: {
          ...personalBody('gemini-personal'),
          _meta: { actionId: nextActionId(), workflow: 'GENERIC', stage: 'GENERIC' },
        },
        status: 400,
        code: 'AI_CAPABILITY_UNSUPPORTED',
      },
      {
        label: 'image input',
        body: personalBody('gemini-personal', nextActionId(), 'GENERATE', {
          messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } }] }],
        }),
        status: 400,
        code: 'AI_CAPABILITY_UNSUPPORTED',
      },
      {
        label: 'forged model',
        body: personalBody('gemini-personal', nextActionId(), 'GENERATE', { model: 'attacker-controlled-model' }),
        status: 400,
        code: 'AI_CAPABILITY_UNSUPPORTED',
      },
    ];

    for (const item of cases) {
      sqlite.prepare("UPDATE feature_flags SET enabled = 1 WHERE flag_key = 'teacher_ai_byok_v1'").run();
      item.prepare?.();
      fetchSpy.mockClear();
      gatewayFetch.mockClear();
      const response = await handleAiProxy(request(item.body), env, '/api/ai/chat', 'POST');
      expect(response?.status, item.label).toBe(item.status);
      await expect(response?.json()).resolves.toMatchObject({ code: item.code });
      expect(fetchSpy, item.label).not.toHaveBeenCalled();
      expect(gatewayFetch, item.label).not.toHaveBeenCalled();
    }

    sqlite.prepare("UPDATE feature_flags SET enabled = 1 WHERE flag_key = 'teacher_ai_byok_v1'").run();
    sqlite.prepare("DELETE FROM teacher_ai_credentials WHERE username = 'teacher-a' AND provider = 'gemini'").run();
    const missing = await handleAiProxy(
      request(personalBody('gemini-personal')),
      env,
      '/api/ai/chat',
      'POST',
    );
    expect(missing?.status).toBe(404);
    await expect(missing?.json()).resolves.toMatchObject({ code: 'AI_KEY_MISSING' });

    await seedCredential('gemini', 'gemini-personal-secret-123456789');
    env.AI_CREDENTIAL_KEYRING = undefined;
    const noVault = await handleAiProxy(
      request(personalBody('gemini-personal')),
      env,
      '/api/ai/chat',
      'POST',
    );
    expect(noVault?.status).toBe(503);
    await expect(noVault?.json()).resolves.toMatchObject({ code: 'AI_VAULT_UNAVAILABLE' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(gatewayFetch).not.toHaveBeenCalled();
  });

  it('binds source, credential version and model to the action so replacing the key cannot silently change REVIEW', async () => {
    await seedCredential('gemini', 'gemini-personal-secret-version-1');
    const actionId = nextActionId();
    const generated = await handleAiProxy(
      request(personalBody('gemini-personal', actionId, 'GENERATE')),
      env,
      '/api/ai/chat',
      'POST',
    );
    expect(generated?.status).toBe(200);

    await seedCredential('gemini', 'gemini-personal-secret-version-2', 1);
    fetchSpy.mockClear();

    const review = await handleAiProxy(
      request(personalBody('gemini-personal', actionId, 'REVIEW')),
      env,
      '/api/ai/chat',
      'POST',
    );
    expect(review?.status).toBe(409);
    await expect(review?.json()).resolves.toMatchObject({ code: 'AI_ACTION_CONFLICT' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns an action conflict when the bound credential is deleted between GENERATE and REVIEW', async () => {
    await seedCredential('gemini', 'gemini-personal-secret-123456789');
    const actionId = nextActionId();

    expect((await handleAiProxy(
      request(personalBody('gemini-personal', actionId, 'GENERATE')),
      env,
      '/api/ai/chat',
      'POST',
    ))?.status).toBe(200);

    sqlite.prepare(
      "DELETE FROM teacher_ai_credentials WHERE username = 'teacher-a' AND provider = 'gemini'",
    ).run();
    fetchSpy.mockClear();

    const review = await handleAiProxy(
      request(personalBody('gemini-personal', actionId, 'REVIEW')),
      env,
      '/api/ai/chat',
      'POST',
    );

    expect(review?.status).toBe(409);
    await expect(review?.json()).resolves.toMatchObject({ code: 'AI_ACTION_CONFLICT' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(gatewayFetch).not.toHaveBeenCalled();
  });

  it('rejects switching provider during an action', async () => {
    await seedCredential('gemini', 'gemini-personal-secret-123456789');
    await seedCredential('deepseek', 'deepseek-personal-secret-1234567');
    const actionId = nextActionId();

    expect((await handleAiProxy(
      request(personalBody('gemini-personal', actionId, 'GENERATE')),
      env,
      '/api/ai/chat',
      'POST',
    ))?.status).toBe(200);

    fetchSpy.mockClear();
    const review = await handleAiProxy(
      request(personalBody('deepseek-personal', actionId, 'REVIEW')),
      env,
      '/api/ai/chat',
      'POST',
    );
    expect(review?.status).toBe(409);
    await expect(review?.json()).resolves.toMatchObject({ code: 'AI_ACTION_CONFLICT' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reserves a personal stage atomically so concurrent replay performs one provider call', async () => {
    await seedCredential('gemini', 'gemini-personal-secret-123456789');
    const actionId = nextActionId();
    let resolveProvider!: (response: Response) => void;
    fetchSpy.mockImplementationOnce(() => new Promise<Response>((resolve) => {
      resolveProvider = resolve;
    }));
    const body = personalBody('gemini-personal', actionId, 'GENERATE');

    const firstPromise = handleAiProxy(request(body), env, '/api/ai/chat', 'POST');
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    const second = await handleAiProxy(request(body), env, '/api/ai/chat', 'POST');
    expect(second?.status).toBe(409);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    resolveProvider(new Response(JSON.stringify({
      choices: [{ message: { content: '{"questions":[]}' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const first = await firstPromise;
    expect(first?.status).toBe(200);
  });

  it('records only allowlisted provider diagnostics and releases the failed action', async () => {
    const apiKey = 'gemini-personal-secret-never-log';
    const providerSecret = 'provider-response-secret-never-log';
    await seedCredential('gemini', apiKey);
    const body = personalBody('gemini-personal');
    const actionId = (body._meta as any).actionId;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      error: {
        code: 400,
        status: 'INVALID_ARGUMENT',
        message: providerSecret,
      },
    }), { status: 400, headers: { 'Content-Type': 'application/json' } }));

    const response = await handleAiProxy(request(body), env, '/api/ai/chat', 'POST');

    expect(response?.status).toBe(502);
    await expect(response?.json()).resolves.toMatchObject({
      code: 'AI_PROVIDER_REQUEST_REJECTED',
    });
    expect(sqlite.prepare(`
      SELECT status, failure_code FROM ai_generation_actions WHERE action_id = ?
    `).get(actionId)).toEqual({
      status: 'FAILED',
      failure_code: 'AI_PROVIDER_REQUEST_REJECTED',
    });
    const logs = JSON.stringify(warnSpy.mock.calls);
    expect(logs).toContain('personal_ai_provider_failure');
    expect(logs).toContain('AI_PROVIDER_REQUEST_REJECTED');
    expect(logs).toContain('provider=gemini');
    expect(logs).toContain('phase=upstream');
    expect(logs).toContain('status=400');
    expect(logs).not.toContain(apiKey);
    expect(logs).not.toContain(providerSecret);
  });
});

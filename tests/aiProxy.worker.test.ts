import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AiRequestPolicyError,
  authorizeAiStage,
  parseAiRequestMeta,
  recordAiStageSuccess,
  type AiRequestMeta,
} from '../workers/src/services/aiRequestPolicy';
import { handleAiProxy } from '../workers/src/routes/aiProxy';
import { expectConsoleError, expectConsoleMessage } from './helpers/expectedConsole';

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

type ActionRow = {
  action_id: string;
  username: string;
  workflow: AiRequestMeta['workflow'];
  status: 'RESERVED' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
  usage_date: string;
  upstream_calls: number;
  ocr_calls: number;
  generate_calls: number;
  review_calls: number;
  repair_calls: number;
  failure_code: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim().toUpperCase();

class FakeStatement {
  private values: unknown[] = [];

  constructor(
    private readonly sql: string,
    private readonly db: FakeAiDb,
  ) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return this.db.first(this.sql, this.values) as T | null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.db.all(this.sql, this.values) as T[] };
  }

  async run(): Promise<{ success: true; meta: { changes: number } }> {
    return { success: true, meta: { changes: this.db.run(this.sql, this.values) } };
  }
}

class FakeAiDb {
  usedCount = 0;
  actions = new Map<string, ActionRow>();

  prepare(sql: string) {
    return new FakeStatement(sql, this);
  }

  seedAction(meta: AiRequestMeta, username = 'teacher-a') {
    const timestamp = '2026-07-22T02:00:00.000Z';
    this.actions.set(meta.actionId, {
      action_id: meta.actionId,
      username,
      workflow: meta.workflow,
      status: 'RESERVED',
      usage_date: '2026-07-22',
      upstream_calls: 0,
      ocr_calls: 0,
      generate_calls: 0,
      review_calls: 0,
      repair_calls: 0,
      failure_code: null,
      created_at: timestamp,
      updated_at: timestamp,
      completed_at: null,
    });
  }

  first(sql: string, values: unknown[]): unknown {
    const normalized = normalizeSql(sql);

    if (normalized.startsWith('SELECT') && normalized.includes('FROM AI_GENERATION_ACTIONS')) {
      const action = this.actions.get(String(values[0]));
      if (!action) return null;
      if (values.length > 1 && action.username !== String(values[1])) return null;
      return { ...action };
    }

    if (normalized.startsWith('SELECT') && normalized.includes('FROM TEACHER_AI_DAILY_USAGE')) {
      return { used_count: this.usedCount };
    }

    if (
      normalized.startsWith('UPDATE AI_GENERATION_ACTIONS')
      && normalized.includes("STATUS = 'RESERVED'")
      && normalized.includes('FAILURE_CODE = NULL')
    ) {
      return this.reactivate(values);
    }

    if (normalized.startsWith('UPDATE AI_GENERATION_ACTIONS') && normalized.includes("STATUS = 'SUCCEEDED'")) {
      return this.transition(values, 'SUCCEEDED', null);
    }

    if (normalized.startsWith('UPDATE AI_GENERATION_ACTIONS') && normalized.includes("STATUS = 'FAILED'")) {
      return this.transition(values, 'FAILED', String(values[0]));
    }

    if (normalized.startsWith('UPDATE AI_GENERATION_ACTIONS') && normalized.includes("STATUS = 'EXPIRED'")) {
      return this.transition(values, 'EXPIRED', 'RESERVATION_EXPIRED');
    }

    if (normalized.startsWith('UPDATE AI_GENERATION_ACTIONS') && normalized.includes('UPSTREAM_CALLS = UPSTREAM_CALLS + 1')) {
      const actionId = String(values.at(-2));
      const username = String(values.at(-1));
      const action = this.actions.get(actionId);
      if (!action || action.username !== username) return null;

      const stageColumn = ['OCR_CALLS', 'GENERATE_CALLS', 'REVIEW_CALLS', 'REPAIR_CALLS']
        .find((column) => normalized.includes(`${column} = ${column} + 1`));
      if (!stageColumn) return null;
      const property = stageColumn.toLowerCase() as 'ocr_calls' | 'generate_calls' | 'review_calls' | 'repair_calls';
      action[property] += 1;
      action.upstream_calls += 1;
      action.updated_at = String(values[0]);
      return { action_id: actionId };
    }

    return null;
  }

  all(sql: string, values: unknown[]): unknown[] {
    const normalized = normalizeSql(sql);
    if (normalized.includes('FROM AI_GENERATION_ACTIONS') && normalized.includes("STATUS = 'RESERVED'")) {
      const username = String(values[0]);
      const threshold = String(values[1]);
      return [...this.actions.values()].filter(
        (action) => action.username === username
          && action.status === 'RESERVED'
          && action.updated_at < threshold,
      );
    }
    return [];
  }

  run(sql: string, values: unknown[]): number {
    const normalized = normalizeSql(sql);

    if (normalized.startsWith('INSERT INTO TEACHER_AI_DAILY_USAGE')) return 1;

    if (normalized.startsWith('UPDATE TEACHER_AI_DAILY_USAGE') && normalized.includes('USED_COUNT = USED_COUNT + 1')) {
      if (this.usedCount >= 5) return 0;
      this.usedCount += 1;
      return 1;
    }

    if (normalized.startsWith('UPDATE TEACHER_AI_DAILY_USAGE') && normalized.includes('USED_COUNT')) {
      this.usedCount = Math.max(0, this.usedCount - 1);
      return 1;
    }

    if (normalized.startsWith('INSERT INTO AI_GENERATION_ACTIONS')) {
      const [actionId, username, workflow, usageDate, createdAt, updatedAt] = values.map(String);
      if (this.actions.has(actionId)) return 0;
      this.actions.set(actionId, {
        action_id: actionId,
        username,
        workflow: workflow as AiRequestMeta['workflow'],
        status: 'RESERVED',
        usage_date: usageDate,
        upstream_calls: 0,
        ocr_calls: 0,
        generate_calls: 0,
        review_calls: 0,
        repair_calls: 0,
        failure_code: null,
        created_at: createdAt,
        updated_at: updatedAt,
        completed_at: null,
      });
      return 1;
    }

    return 0;
  }

  private reactivate(values: unknown[]): ActionRow | null {
    const [usageDate, timestamp, actionId, username, workflow] = values.map(String);
    const action = this.actions.get(actionId);
    if (
      !action
      || action.username !== username
      || action.workflow !== workflow
      || (action.status !== 'FAILED' && action.status !== 'EXPIRED')
    ) {
      return null;
    }

    action.status = 'RESERVED';
    action.usage_date = usageDate;
    action.failure_code = null;
    action.updated_at = timestamp;
    action.completed_at = null;
    return { ...action };
  }

  private transition(
    values: unknown[],
    status: ActionRow['status'],
    failureCode: string | null,
  ): Pick<ActionRow, 'usage_date'> | null {
    const isFailure = status === 'FAILED';
    const actionId = String(values[isFailure ? 3 : 2]);
    const username = String(values[isFailure ? 4 : 3]);
    const timestamp = String(values[isFailure ? 2 : 1]);
    const action = this.actions.get(actionId);
    if (!action || action.username !== username || action.status !== 'RESERVED') return null;
    action.status = status;
    action.failure_code = failureCode;
    action.updated_at = timestamp;
    action.completed_at = timestamp;
    return { usage_date: action.usage_date };
  }
}

const actionId = 'ai-1234567890abcdefghij';
const request = (body: Record<string, unknown>) => new Request('https://www.thtohieu.com/api/ai/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'CF-Connecting-IP': '1.2.3.4',
  },
  body: JSON.stringify(body),
});

let fakeDb: FakeAiDb;
let env: any;
let gatewayFetch: ReturnType<typeof vi.fn>;
let globalFetchSpy: ReturnType<typeof vi.spyOn>;

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  fakeDb = new FakeAiDb();
  gatewayFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));
  env = {
    DB: fakeDb as unknown as D1Database,
    AI_GATEWAY: { fetch: gatewayFetch },
    CLIPROXY_API: 'https://ai-gateway.internal/v1',
    CLIPROXY_TOKEN: 'test-token',
    JWT_SECRET: 'test-secret',
  };
  authState.user = { username: 'teacher-a', role: 'teacher' };
  rateLimitMock.mockReset();
  rateLimitMock.mockResolvedValue(null);
  globalFetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
    new Error('AI proxy must use the AI_GATEWAY service binding'),
  );
});

describe('AI request policy', () => {
  it('rejects missing and malformed metadata', () => {
    expect(() => parseAiRequestMeta(undefined)).toThrowError(expect.objectContaining({ code: 'AI_META_REQUIRED' }));
    expect(() => parseAiRequestMeta({ actionId: 'bad', workflow: 'QUIZ_CREATE', stage: 'GENERATE' }))
      .toThrowError(expect.objectContaining({ code: 'AI_META_INVALID' }));
  });

  it('allows at most OCR -> GENERATE -> REVIEW for one quiz action', async () => {
    const base = { actionId, workflow: 'QUIZ_CREATE' as const };
    fakeDb.seedAction({ ...base, stage: 'OCR' });

    for (const stage of ['OCR', 'GENERATE', 'REVIEW'] as const) {
      const meta = { ...base, stage };
      await authorizeAiStage(env.DB, 'teacher-a', meta);
      await recordAiStageSuccess(env.DB, 'teacher-a', meta);
    }

    await expect(authorizeAiStage(env.DB, 'teacher-a', { ...base, stage: 'REVIEW' }))
      .rejects.toMatchObject({ code: 'AI_STAGE_CONFLICT' });
  });

  it('requires generation before review or repair', async () => {
    const meta = { actionId, workflow: 'QUIZ_CREATE' as const, stage: 'REVIEW' as const };
    fakeDb.seedAction(meta);

    await expect(authorizeAiStage(env.DB, 'teacher-a', meta))
      .rejects.toBeInstanceOf(AiRequestPolicyError);
  });
});

describe('/api/ai/chat', () => {
  it('rejects teacher AI requests without metadata', async () => {
    const response = await handleAiProxy(
      request({ model: 'gemini-2.5-flash', messages: [{}] }),
      env,
      '/api/ai/chat',
      'POST',
    );

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({ code: 'AI_META_REQUIRED' });
    expect(gatewayFetch).not.toHaveBeenCalled();
  });

  it('returns 403 when a student requests QUIZ_CREATE', async () => {
    authState.user = { username: 'student-a', role: 'student' };
    const response = await handleAiProxy(
      request({
        model: 'gemini-2.5-flash',
        messages: [{}],
        _meta: { actionId, workflow: 'QUIZ_CREATE', stage: 'GENERATE' },
      }),
      env,
      '/api/ai/chat',
      'POST',
    );

    expect(response?.status).toBe(403);
    expect(gatewayFetch).not.toHaveBeenCalled();
  });

  it('releases the reservation on upstream 503 during GENERATE', async () => {
    const errorSpy = expectConsoleError();
    gatewayFetch.mockResolvedValueOnce(new Response('down', { status: 503 }));

    const response = await handleAiProxy(
      request({
        model: 'gemini-2.5-flash',
        messages: [{}],
        _meta: { actionId, workflow: 'QUIZ_CREATE', stage: 'GENERATE' },
      }),
      env,
      '/api/ai/chat',
      'POST',
    );

    expect(response?.status).toBe(503);
    expect(fakeDb.actions.get(actionId)?.status).toBe('FAILED');
    expect(fakeDb.usedCount).toBe(0);
    expectConsoleMessage(errorSpy, 'Downstream error (503)');
  });

  it('reopens a failed action so a transient upstream failure can retry with the same action id', async () => {
    const errorSpy = expectConsoleError();
    gatewayFetch
      .mockResolvedValueOnce(new Response('temporary tunnel failure', { status: 522 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    const body = {
      model: 'gemini-2.5-flash',
      messages: [{}],
      _meta: { actionId, workflow: 'QUIZ_CREATE', stage: 'GENERATE' },
    };

    const failed = await handleAiProxy(request(body), env, '/api/ai/chat', 'POST');
    const retried = await handleAiProxy(request(body), env, '/api/ai/chat', 'POST');

    expect(failed?.status).toBe(522);
    expect(retried?.status).toBe(200);
    expect(gatewayFetch).toHaveBeenCalledTimes(2);
    expect(fakeDb.actions.get(actionId)).toMatchObject({
      status: 'SUCCEEDED',
      generate_calls: 1,
      failure_code: null,
    });
    expect(globalFetchSpy).not.toHaveBeenCalled();
    expectConsoleMessage(errorSpy, 'Downstream error (522)');
  });

  it('applies the closed AI rate limit after authentication without using the username in its key', async () => {
    await handleAiProxy(
      request({
        model: 'gemini-2.5-flash',
        messages: [{}],
        _meta: { actionId, workflow: 'QUIZ_CREATE', stage: 'GENERATE' },
      }),
      env,
      '/api/ai/chat',
      'POST',
    );

    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.any(Request),
      env,
      expect.objectContaining({ failureMode: 'closed', maxRequests: 10 }),
    );
    const options = rateLimitMock.mock.calls[0][2];
    const key = options.keyGenerator(request({}));
    expect(key).toContain('teacher');
    expect(key).toContain('/api/ai/chat');
    expect(key).not.toContain('teacher-a');
  });

  it('accepts allow-listed V3 diagnostics without logging prompt content', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const response = await handleAiProxy(
      request({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: 'SECRET QUESTION CONTENT' }],
        _meta: {
          actionId,
          workflow: 'QUIZ_CREATE',
          stage: 'GENERATE',
          promptVersion: 'ai-blueprint-v3',
          blueprintVersion: 3,
          slotCount: 13,
          prompt: 'SECRET META CONTENT',
        },
      }),
      env,
      '/api/ai/chat',
      'POST',
    );

    expect(response?.status).toBe(200);
    expect(JSON.stringify(infoSpy.mock.calls)).toContain('ai-blueprint-v3');
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain('SECRET');
    const upstreamBody = JSON.parse(String(gatewayFetch.mock.calls[0][1]?.body));
    expect(String(gatewayFetch.mock.calls[0][0])).toBe('https://ai-gateway.internal/v1/chat/completions');
    expect(globalFetchSpy).not.toHaveBeenCalled();
    expect(upstreamBody._meta).toBeUndefined();
  });

  it('rejects invalid V3 diagnostic values', async () => {
    const response = await handleAiProxy(
      request({
        model: 'gemini-2.5-flash',
        messages: [{}],
        _meta: {
          actionId,
          workflow: 'QUIZ_CREATE',
          stage: 'GENERATE',
          promptVersion: 'ai-blueprint-v3',
          blueprintVersion: 3,
          slotCount: 41,
        },
      }),
      env,
      '/api/ai/chat',
      'POST',
    );

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toMatchObject({ code: 'AI_META_INVALID' });
    expect(gatewayFetch).not.toHaveBeenCalled();
  });

  it('does not forward internal action metadata to the upstream provider', async () => {
    await handleAiProxy(
      request({
        model: 'gemini-2.5-flash',
        messages: [{}],
        _meta: { actionId, workflow: 'QUIZ_CREATE', stage: 'GENERATE' },
      }),
      env,
      '/api/ai/chat',
      'POST',
    );

    const upstreamBody = JSON.parse(String(gatewayFetch.mock.calls[0][1]?.body));
    expect(String(gatewayFetch.mock.calls[0][0])).toBe('https://ai-gateway.internal/v1/chat/completions');
    expect(globalFetchSpy).not.toHaveBeenCalled();
    expect(upstreamBody._meta).toBeUndefined();
  });
});

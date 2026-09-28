// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signJWT } from '../workers/src/utils/jwt';
import { createSqliteD1 } from './helpers/sqliteD1';
import {
  handleQuizGenerationRoute,
  type QuizGenerationRouteDependencies,
} from '../workers/src/routes/quizGeneration';
import { ServerQuizOrchestratorError } from '../workers/src/services/quizGeneration/orchestrator';

const secret = 'server-quiz-route-test-secret-that-is-long-enough';
let sqlite: DatabaseSync;
let env: any;

const featureConfig = {
  key: 'server_quiz_generation_v1',
  description: 'test',
  enabled: true,
  audience: 'teacher' as const,
  percentage: 100,
  allowUsers: [],
  allowClasses: [],
  startsAt: null,
  endsAt: null,
  owner: 'ai-platform',
  reason: 'test',
  stopConditions: {},
  version: 1,
  updatedBy: 'test',
  updatedAt: '2026-09-27T00:00:00.000Z',
};

const validBody = {
  actionId: 'route-quiz-action-0001',
  source: 'system' as const,
  title: 'Đề Toán lớp 3',
  topic: 'Phép nhân',
  classLevel: '3',
  content: 'Nội dung tham khảo.',
  intent: 'EXAM' as const,
  sourceMode: 'TOPIC' as const,
  questionCount: 2,
  typeAllocations: [{ type: 'MCQ' as const, count: 2 }],
  difficultyLevels: { level1: 1, level2: 1, level3: 0 },
  promptProfile: { useThongTu27: true, learnerMode: 'default' as const },
  diagramMode: 'off' as const,
};

const successPayload = {
  status: 'success' as const,
  actionId: validBody.actionId,
  source: 'system' as const,
  promptVersion: 'ai-blueprint-v3' as const,
  blueprintVersion: 3 as const,
  orchestratorVersion: 'server-quiz-v1' as const,
  quiz: {
    promptVersion: 'ai-blueprint-v3' as const,
    blueprintVersion: 3 as const,
    title: validBody.title,
    questions: [],
  },
};

const makeDeps = (
  overrides: Partial<QuizGenerationRouteDependencies> = {},
): QuizGenerationRouteDependencies => ({
  getFeatureFlag: vi.fn(async () => featureConfig),
  resolveFeatureFlag: vi.fn(async () => ({
    key: featureConfig.key,
    enabled: true,
    reason: 'percentage' as const,
    bucket: 0,
    version: 1,
  })),
  rateLimit: vi.fn(async () => null),
  generateQuiz: vi.fn(async () => successPayload),
  ...overrides,
});

const cookieFor = async (payload: Record<string, unknown>) => {
  const token = await signJWT({
    ...payload,
    tokenVersion: 1,
    purpose: 'session',
  }, secret, '1d');
  return `auth_token=${token}`;
};

const request = async (
  body: unknown = validBody,
  role: 'teacher' | 'admin' | 'student' | 'anonymous' = 'teacher',
  method = 'POST',
): Promise<Request> => {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (role !== 'anonymous') {
    headers.set('Cookie', await cookieFor({
      ...(role === 'student' ? { id: 'student-1' } : {}),
      username: role === 'student' ? 'student-1' : role === 'admin' ? 'admin-a' : 'teacher-a',
      role,
    }));
  }
  return new Request('https://api.test/api/ai/quiz/generate', {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
};

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE teachers (
      username TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      token_version INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO teachers (username) VALUES ('teacher-a'), ('admin-a');
  `);
  env = {
    DB: createSqliteD1(sqlite),
    JWT_SECRET: secret,
  };
});

afterEach(() => {
  sqlite.close();
  vi.restoreAllMocks();
});

describe('server quiz generation route', () => {
  it('ignores unrelated paths', async () => {
    const deps = makeDeps();
    const response = await handleQuizGenerationRoute(
      new Request('https://api.test/api/ai/chat', { method: 'POST' }),
      env,
      '/api/ai/chat',
      'POST',
      deps,
    );

    expect(response).toBeNull();
    expect(deps.generateQuiz).not.toHaveBeenCalled();
  });

  it('rejects anonymous and student callers before generation', async () => {
    for (const role of ['anonymous', 'student'] as const) {
      const deps = makeDeps();
      const response = await handleQuizGenerationRoute(
        await request(validBody, role),
        env,
        '/api/ai/quiz/generate',
        'POST',
        deps,
      );

      expect(response?.status).toBe(role === 'anonymous' ? 401 : 403);
      expect(deps.generateQuiz).not.toHaveBeenCalled();
    }
  });

  it('returns not available while the canary feature flag is disabled', async () => {
    const deps = makeDeps({
      resolveFeatureFlag: vi.fn(async () => ({
        key: featureConfig.key,
        enabled: false,
        reason: 'disabled' as const,
        bucket: null,
        version: 1,
      })),
    });

    const response = await handleQuizGenerationRoute(
      await request(),
      env,
      '/api/ai/quiz/generate',
      'POST',
      deps,
    );
    const payload = await response?.json() as any;

    expect(response?.status).toBe(404);
    expect(payload.code).toBe('QUIZ_SOURCE_UNAVAILABLE');
    expect(deps.generateQuiz).not.toHaveBeenCalled();
  });

  it('rejects browser-controlled model/messages/apiKey fields before generation', async () => {
    for (const field of ['model', 'messages', 'apiKey', 'providerEndpoint']) {
      const deps = makeDeps();
      const response = await handleQuizGenerationRoute(
        await request({ ...validBody, [field]: 'forbidden' }),
        env,
        '/api/ai/quiz/generate',
        'POST',
        deps,
      );
      const payload = await response?.json() as any;

      expect(response?.status, field).toBe(400);
      expect(payload.code, field).toBe('QUIZ_REQUEST_INVALID');
      expect(deps.generateQuiz).not.toHaveBeenCalled();
    }
  });

  it('rejects a body larger than 300 KiB without calling the orchestrator', async () => {
    const deps = makeDeps();
    const response = await handleQuizGenerationRoute(
      await request({ ...validBody, content: 'x'.repeat(301 * 1024) }),
      env,
      '/api/ai/quiz/generate',
      'POST',
      deps,
    );
    const payload = await response?.json() as any;

    expect(response?.status).toBe(413);
    expect(payload.code).toBe('QUIZ_REQUEST_INVALID');
    expect(deps.generateQuiz).not.toHaveBeenCalled();
  });

  it('rate limits the high-level action and returns a no-store success payload', async () => {
    const deps = makeDeps();

    const response = await handleQuizGenerationRoute(
      await request(),
      env,
      '/api/ai/quiz/generate',
      'POST',
      deps,
    );
    const payload = await response?.json();

    expect(response?.status).toBe(200);
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
    expect(payload).toEqual(successPayload);
    expect(deps.rateLimit).toHaveBeenCalledWith(
      expect.any(Request),
      env,
      expect.objectContaining({
        windowMs: 60 * 1000,
        maxRequests: 10,
        failureMode: 'closed',
      }),
    );
    expect(deps.generateQuiz).toHaveBeenCalledTimes(1);
    expect(deps.generateQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: { username: 'teacher-a', role: 'teacher' },
        request: expect.objectContaining({ actionId: validBody.actionId }),
      }),
    );
  });

  it('maps orchestrator failures without leaking internal provider messages', async () => {
    const internalSecret = 'provider raw body secret';
    const deps = makeDeps({
      generateQuiz: vi.fn(async () => {
        throw new ServerQuizOrchestratorError('AI_PROVIDER_UNAVAILABLE', internalSecret);
      }),
    });

    const response = await handleQuizGenerationRoute(
      await request(),
      env,
      '/api/ai/quiz/generate',
      'POST',
      deps,
    );
    const text = await response?.text();

    expect(response?.status).toBe(503);
    expect(text).toContain('AI_PROVIDER_UNAVAILABLE');
    expect(text).not.toContain(internalSecret);
  });

  it('maps explicit output truncation to a stable actionable response', async () => {
    const deps = makeDeps({
      generateQuiz: vi.fn(async () => {
        throw new ServerQuizOrchestratorError('AI_PROVIDER_OUTPUT_TRUNCATED', 'private provider detail');
      }),
    });

    const response = await handleQuizGenerationRoute(
      await request(),
      env,
      '/api/ai/quiz/generate',
      'POST',
      deps,
    );

    expect(response?.status).toBe(502);
    await expect(response?.json()).resolves.toMatchObject({
      code: 'AI_PROVIDER_OUTPUT_TRUNCATED',
      message: 'Phản hồi AI bị cắt do giới hạn đầu ra. Hãy thử tạo ít câu hơn trong một lần.',
    });
  });
});

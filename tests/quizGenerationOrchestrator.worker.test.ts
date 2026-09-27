// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBlueprintV3Fixture, makeGeneratedQuizV3Fixture } from './helpers/aiBlueprintV3Fixtures';
import { createSqliteD1 } from './helpers/sqliteD1';
import {
  generateQuizOnServer,
  type ServerQuizOrchestratorDependencies,
} from '../workers/src/services/quizGeneration/orchestrator';
import { QuizProviderStageError } from '../workers/src/services/quizGeneration/retryPolicy';

const migration83 = 'workers/migrations/0083_teacher_ai_credentials.sql';
const migration84 = 'workers/migrations/0084_teacher_ai_preferences.sql';
const migration85 = 'workers/migrations/0085_server_quiz_generation.sql';

let sqlite: DatabaseSync;
let db: D1Database;
let env: any;

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
  sqlite.exec(readFileSync(migration83, 'utf8'));
  sqlite.exec(readFileSync(migration84, 'utf8'));
  sqlite.exec(readFileSync(migration85, 'utf8'));
  db = createSqliteD1(sqlite);
};

const request = {
  actionId: 'server-quiz-action-0001',
  source: 'system' as const,
  title: 'Đề phân số lớp 4',
  topic: 'Phân số',
  classLevel: '4',
  content: 'Nội dung phân số lớp 4.',
  intent: 'PRACTICE' as const,
  sourceMode: 'TOPIC' as const,
  questionCount: 4,
  typeAllocations: [
    { type: 'MCQ' as const, count: 2 },
    { type: 'MATCHING' as const, count: 1 },
    { type: 'SHORT_ANSWER' as const, count: 1 },
  ],
  difficultyLevels: { level1: 1, level2: 2, level3: 1 },
  promptProfile: { useThongTu27: true, learnerMode: 'default' as const },
  subject: 'math',
  skillCode: 'phan_so',
  diagramMode: 'off' as const,
};

const makeValidQuiz = () => makeGeneratedQuizV3Fixture(makeBlueprintV3Fixture());

const makeDependencies = (
  executeStage: ServerQuizOrchestratorDependencies['executeStage'],
): ServerQuizOrchestratorDependencies => ({
  executeStage,
  resolveDefaultSource: vi.fn(async () => 'system'),
  resolvePersonalCredential: vi.fn(),
});

beforeEach(() => {
  setupDatabase();
  env = {
    DB: db,
    AI_GATEWAY: { fetch: vi.fn() },
    CLIPROXY_API: 'https://ai-gateway.internal/v1',
    CLIPROXY_TOKEN: 'system-token',
    JWT_SECRET: 'test-secret',
  };
});

afterEach(() => {
  sqlite.close();
  vi.restoreAllMocks();
});

describe('server quiz generation orchestrator', () => {
  it('rejects concurrent replay of the same action so only one generation reaches the provider', async () => {
    const quiz = makeValidQuiz();
    let releaseGenerate!: () => void;
    const blockedGenerate = new Promise<void>((resolve) => { releaseGenerate = resolve; });
    let generateCalls = 0;

    const executeStage = vi.fn(async (_env: any, _owner: any, stageInput: any) => {
      if (stageInput.stage === 'GENERATE') {
        generateCalls += 1;
        await blockedGenerate;
      }
      return {
        text: JSON.stringify(quiz),
        provider: 'system-gateway' as const,
        model: 'gemini-2.5-flash',
        attempts: 1,
      };
    });
    const deps = makeDependencies(executeStage);

    const first = generateQuizOnServer({
      env,
      owner: { username: 'teacher-a', role: 'teacher' },
      request,
    }, deps);

    await vi.waitFor(() => expect(generateCalls).toBe(1));

    await expect(generateQuizOnServer({
      env,
      owner: { username: 'teacher-a', role: 'teacher' },
      request,
    }, deps)).rejects.toMatchObject({ code: 'AI_ACTION_CONFLICT' });

    expect(generateCalls).toBe(1);
    releaseGenerate();
    await expect(first).resolves.toMatchObject({ status: 'success' });
  });

  it('rejects an action id already owned by another account before any upstream call', async () => {
    const quiz = makeValidQuiz();
    const executeStage = vi.fn(async () => ({
      text: JSON.stringify(quiz),
      provider: 'system-gateway' as const,
      model: 'gemini-2.5-flash',
      attempts: 1,
    }));
    const deps = makeDependencies(executeStage);

    await generateQuizOnServer({
      env,
      owner: { username: 'teacher-a', role: 'teacher' },
      request,
    }, deps);

    executeStage.mockClear();
    await expect(generateQuizOnServer({
      env,
      owner: { username: 'teacher-b', role: 'teacher' },
      request,
    }, deps)).rejects.toMatchObject({ code: 'AI_ACTION_CONFLICT' });

    expect(executeStage).not.toHaveBeenCalled();
  });

  it('consumes one website quota action while internal review stays inside the same action', async () => {
    const quiz = makeValidQuiz();
    const executeStage = vi.fn(async () => ({
      text: JSON.stringify(quiz),
      provider: 'system-gateway' as const,
      model: 'gemini-2.5-flash',
      attempts: 1,
    }));

    const response = await generateQuizOnServer({
      env,
      owner: { username: 'teacher-a', role: 'teacher' },
      request,
    }, makeDependencies(executeStage));

    expect(response.status).toBe('success');
    expect(executeStage.mock.calls.map((call) => call[2].stage)).toEqual(['GENERATE', 'REVIEW']);
    expect(sqlite.prepare('SELECT used_count FROM teacher_ai_daily_usage WHERE username = ?').get('teacher-a'))
      .toEqual({ used_count: 1 });
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM ai_generation_actions WHERE username = ?').get('teacher-a'))
      .toEqual({ count: 1 });
  });

  it('releases one quota slot and stores bounded diagnostics on terminal provider failure', async () => {
    const executeStage = vi.fn(async () => {
      throw new QuizProviderStageError('AI_PROVIDER_UNAVAILABLE', {
        provider: 'system-gateway',
        phase: 'upstream',
        upstreamStatus: 503,
      });
    });

    await expect(generateQuizOnServer({
      env,
      owner: { username: 'teacher-a', role: 'teacher' },
      request,
    }, makeDependencies(executeStage))).rejects.toMatchObject({
      code: 'AI_PROVIDER_UNAVAILABLE',
    });

    expect(sqlite.prepare(
      'SELECT used_count FROM teacher_ai_daily_usage WHERE username = ?',
    ).get('teacher-a')).toEqual({ used_count: 0 });
    expect(sqlite.prepare(`
      SELECT status, active_stage, provider_attempts, last_provider_error_code,
             last_provider_status, last_provider_phase
      FROM ai_generation_actions WHERE action_id = ?
    `).get(request.actionId)).toEqual({
      status: 'FAILED',
      active_stage: null,
      provider_attempts: 1,
      last_provider_error_code: 'AI_PROVIDER_UNAVAILABLE',
      last_provider_status: 503,
      last_provider_phase: 'upstream',
    });
  });

  it('includes a failed repair attempt after successful generation in provider diagnostics', async () => {
    const executeStage = vi.fn(async (_env: any, _owner: any, stageInput: any) => {
      if (stageInput.stage === 'GENERATE') {
        return {
          text: 'not-json',
          provider: 'system-gateway' as const,
          model: 'gemini-2.5-flash',
          attempts: 2,
        };
      }
      throw new QuizProviderStageError('AI_PROVIDER_UNAVAILABLE', {
        provider: 'system-gateway',
        phase: 'upstream',
        upstreamStatus: 503,
      });
    });

    await expect(generateQuizOnServer({
      env,
      owner: { username: 'teacher-a', role: 'teacher' },
      request,
    }, makeDependencies(executeStage))).rejects.toMatchObject({
      code: 'AI_PROVIDER_UNAVAILABLE',
    });

    expect(sqlite.prepare(`
      SELECT status, provider_attempts, last_provider_status
      FROM ai_generation_actions WHERE action_id = ?
    `).get(request.actionId)).toEqual({
      status: 'FAILED',
      provider_attempts: 3,
      last_provider_status: 503,
    });
  });

  it('rejects image-required requests when the account default is a personal text-only source', async () => {
    const { source: _source, ...requestWithoutSource } = request;
    const executeStage = vi.fn();
    const resolvePersonalCredential = vi.fn();
    const deps: ServerQuizOrchestratorDependencies = {
      executeStage,
      resolveDefaultSource: vi.fn(async () => 'gemini-personal' as const),
      resolvePersonalCredential,
    };

    await expect(generateQuizOnServer({
      env,
      owner: { username: 'teacher-a', role: 'teacher' },
      request: {
        ...requestWithoutSource,
        typeAllocations: [{ type: 'IMAGE_QUESTION' as const, count: 4 }],
      },
    }, deps)).rejects.toMatchObject({ code: 'QUIZ_CAPABILITY_UNSUPPORTED' });

    expect(resolvePersonalCredential).not.toHaveBeenCalled();
    expect(executeStage).not.toHaveBeenCalled();
  });

  it('stores only bounded retry diagnostics and clears the action lock on success', async () => {
    const quiz = makeValidQuiz();
    const executeStage = vi.fn(async (_env: any, _owner: any, stageInput: any) => ({
      text: JSON.stringify(quiz),
      provider: 'system-gateway' as const,
      model: 'gemini-2.5-flash',
      attempts: stageInput.stage === 'GENERATE' ? 2 : 1,
      lastTransientError: stageInput.stage === 'GENERATE' ? {
        code: 'AI_PROVIDER_UNAVAILABLE' as const,
        phase: 'upstream' as const,
        upstreamStatus: 503,
      } : undefined,
    }));

    await generateQuizOnServer({
      env,
      owner: { username: 'teacher-a', role: 'teacher' },
      request,
    }, makeDependencies(executeStage));

    const row = sqlite.prepare(`
      SELECT status, active_stage, orchestrator_version, provider_attempts,
             last_provider_error_code, last_provider_status, last_provider_phase
      FROM ai_generation_actions WHERE action_id = ?
    `).get(request.actionId);

    expect(row).toEqual({
      status: 'SUCCEEDED',
      active_stage: null,
      orchestrator_version: 'server-quiz-v1',
      provider_attempts: 3,
      last_provider_error_code: 'AI_PROVIDER_UNAVAILABLE',
      last_provider_status: 503,
      last_provider_phase: 'upstream',
    });
  });
});

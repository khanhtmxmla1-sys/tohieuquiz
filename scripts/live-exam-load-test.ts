import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { SignJWT } from 'jose';

const JWT_ISSUER = 'tohieuquiz-api';
const JWT_AUDIENCE = 'tohieuquiz-web';
const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;
const DEFAULT_STATUS_ROUNDS = 3;

export interface LoadStudentFixture {
  name?: string;
  id?: string;
  username?: string;
  tokenVersion?: number;
  cookie?: string;
  authToken?: string;
  answers?: Record<string, unknown>;
}

interface LoadTestConfig {
  baseUrl: string;
  sessionId: string;
  students: LoadStudentFixture[];
  defaultAnswers?: Record<string, unknown>;
  statusRounds?: number;
  requestTimeoutMs?: number;
  warmupRequests?: number;
  probeAnswerKey?: string;
}

interface TimedResponse {
  ok: boolean;
  status: number;
  durationMs: number;
  body: unknown;
  error?: string;
}

export interface AcceptanceMetrics {
  statusP95Ms: number;
  submitP95Ms: number;
  lostAnswers: number;
  duplicateFailures: number;
  d1OverloadErrors: number;
  app5xx: number;
  requestErrors?: number;
}

interface LoadSummary extends AcceptanceMetrics {
  concurrency: number;
  statusRequests: number;
  autosaveWrites: number;
  submitRequests: number;
  duplicateRequests: number;
  statusP50Ms: number;
  submitP50Ms: number;
  elapsedMs: number;
}

interface AcceptanceResult {
  passed: boolean;
  failures: string[];
}

interface CliOptions {
  configPath: string;
  concurrency: number;
  statusRounds?: number;
}

export function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.max(1, Math.ceil((Math.min(100, Math.max(0, percentileValue)) / 100) * sorted.length));
  return sorted[rank - 1] ?? 0;
}

export function evaluateAcceptance(metrics: AcceptanceMetrics): AcceptanceResult {
  const failures: string[] = [];
  if (metrics.statusP95Ms >= 500) failures.push(`status p95 ${metrics.statusP95Ms.toFixed(1)}ms must be <500ms`);
  if (metrics.submitP95Ms >= 2_000) failures.push(`submit p95 ${metrics.submitP95Ms.toFixed(1)}ms must be <2000ms`);
  if (metrics.lostAnswers !== 0) failures.push(`lost answers: ${metrics.lostAnswers}`);
  if (metrics.duplicateFailures !== 0) failures.push(`duplicate submission failures: ${metrics.duplicateFailures}`);
  if (metrics.d1OverloadErrors !== 0) failures.push(`D1 overload signals: ${metrics.d1OverloadErrors}`);
  if (metrics.app5xx !== 0) failures.push(`app 5xx responses: ${metrics.app5xx}`);
  if ((metrics.requestErrors ?? 0) !== 0) failures.push(`request/network errors: ${metrics.requestErrors}`);
  return { passed: failures.length === 0, failures };
}

export function normalizeAuthCookie(student: Pick<LoadStudentFixture, 'cookie' | 'authToken'>): string | null {
  if (student.cookie?.trim()) return student.cookie.trim();
  if (student.authToken?.trim()) return `auth_token=${student.authToken.trim()}`;
  return null;
}

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
};

const equalJson = (left: unknown, right: unknown): boolean => (
  JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right))
);

const responseText = (response: TimedResponse): string => {
  if (typeof response.body === 'string') return response.body;
  try {
    return JSON.stringify(response.body);
  } catch {
    return response.error || '';
  }
};

const isD1Overload = (response: TimedResponse): boolean => {
  if (response.status === 429) return true;
  const text = responseText(response);
  return /\bD1\b|database\s+(?:busy|overload|locked)|too many (?:queries|requests)/i.test(text);
};

const signStudentToken = async (student: LoadStudentFixture, secret: string): Promise<string> => {
  if (!student.id || !student.username) {
    throw new Error('Generated load-test JWTs require both student.id and student.username');
  }
  const key = new TextEncoder().encode(secret);
  return new SignJWT({
    id: student.id,
    username: student.username,
    role: 'student',
    tokenVersion: student.tokenVersion ?? 0,
    purpose: 'session',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(key);
};

const resolveStudentCookie = async (student: LoadStudentFixture): Promise<string> => {
  const existing = normalizeAuthCookie(student);
  if (existing) return existing;
  const secret = process.env.LIVE_EXAM_LOAD_JWT_SECRET?.trim();
  if (!secret) {
    throw new Error(
      `Student ${student.name || student.username || student.id || '(unknown)'} has no cookie/authToken. `
      + 'Set LIVE_EXAM_LOAD_JWT_SECRET only for an authorized local/staging target if generated JWTs are intended.',
    );
  }
  return `auth_token=${await signStudentToken(student, secret)}`;
};

const timedJsonRequest = async (
  url: string,
  cookie: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<TimedResponse> => {
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Cookie: cookie,
        ...options.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const contentType = response.headers.get('content-type') || '';
    let body: unknown;
    if (contentType.includes('application/json')) {
      body = await response.json().catch(() => null);
    } else {
      body = await response.text().catch(() => '');
    }
    return {
      ok: response.ok,
      status: response.status,
      durationMs: performance.now() - startedAt,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      durationMs: performance.now() - startedAt,
      body: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const getArg = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const parsePositiveInt = (value: string | undefined, fallback: number, label: string): number => {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`);
  return parsed;
};

const parseCli = (args: string[]): CliOptions => {
  const configPath = getArg(args, '--config') || process.env.LIVE_EXAM_LOAD_CONFIG;
  if (!configPath) {
    throw new Error('Provide --config <path> or set LIVE_EXAM_LOAD_CONFIG');
  }
  return {
    configPath: resolve(configPath),
    concurrency: parsePositiveInt(getArg(args, '--concurrency'), 100, 'concurrency'),
    statusRounds: getArg(args, '--status-rounds') === undefined
      ? undefined
      : parsePositiveInt(getArg(args, '--status-rounds'), DEFAULT_STATUS_ROUNDS, 'status rounds'),
  };
};

const readConfig = async (path: string): Promise<LoadTestConfig> => {
  const parsed = JSON.parse(await readFile(path, 'utf8')) as LoadTestConfig;
  if (!parsed.baseUrl?.trim()) throw new Error('config.baseUrl is required');
  if (!parsed.sessionId?.trim()) throw new Error('config.sessionId is required');
  if (!Array.isArray(parsed.students) || parsed.students.length === 0) throw new Error('config.students must not be empty');
  return parsed;
};

const summarizeHttpFailures = (responses: TimedResponse[]) => ({
  app5xx: responses.filter((response) => response.status >= 500 && response.status <= 599).length,
  d1OverloadErrors: responses.filter(isD1Overload).length,
  requestErrors: responses.filter((response) => !response.ok).length,
});

const compareSubmissionReplay = (first: TimedResponse, replay: TimedResponse): boolean => {
  if (!first.ok || !replay.ok) return false;
  const firstParticipant = (first.body as any)?.participant;
  const replayParticipant = (replay.body as any)?.participant;
  if (!firstParticipant || !replayParticipant) return false;
  return equalJson(
    {
      score: firstParticipant.score,
      correctCount: firstParticipant.correctCount,
      wrongCount: firstParticipant.wrongCount,
      submittedAt: firstParticipant.submittedAt,
    },
    {
      score: replayParticipant.score,
      correctCount: replayParticipant.correctCount,
      wrongCount: replayParticipant.wrongCount,
      submittedAt: replayParticipant.submittedAt,
    },
  );
};

export async function runLiveExamLoadTest(options: CliOptions): Promise<{
  summary: LoadSummary;
  acceptance: AcceptanceResult;
}> {
  const config = await readConfig(options.configPath);
  if (config.students.length < options.concurrency) {
    throw new Error(`Need at least ${options.concurrency} student fixtures; config has ${config.students.length}`);
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const sessionId = encodeURIComponent(config.sessionId);
  const requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const statusRounds = options.statusRounds ?? config.statusRounds ?? DEFAULT_STATUS_ROUNDS;
  const students = config.students.slice(0, options.concurrency);
  const cookies = await Promise.all(students.map(resolveStudentCookie));
  const runId = Date.now().toString(36);
  const probeKey = config.probeAnswerKey || '__load_probe__';
  const startedAt = performance.now();
  const allResponses: TimedResponse[] = [];

  const requestFor = (
    index: number,
    path: string,
    init: RequestInit = {},
  ) => timedJsonRequest(`${baseUrl}${path}`, cookies[index]!, init, requestTimeoutMs);

  const warmupCount = Math.min(options.concurrency, Math.max(0, config.warmupRequests ?? 5));
  if (warmupCount > 0) {
    await Promise.all(Array.from({ length: warmupCount }, (_, index) => (
      requestFor(index, `/api/live-exam/${sessionId}/status`)
    )));
  }

  const statusResponses: TimedResponse[] = [];
  for (let round = 0; round < statusRounds; round += 1) {
    const roundResponses = await Promise.all(students.map((_, index) => (
      requestFor(index, `/api/live-exam/${sessionId}/status`)
    )));
    statusResponses.push(...roundResponses);
    allResponses.push(...roundResponses);
  }

  const initialSnapshots = await Promise.all(students.map((_, index) => (
    requestFor(index, `/api/live-exam/${sessionId}/autosave`)
  )));
  allResponses.push(...initialSnapshots);

  const expectedAnswers = students.map((student, index) => ({
    ...(config.defaultAnswers || {}),
    ...(student.answers || {}),
    [probeKey]: `${runId}:${index}`,
  }));
  const autosaveVersions = initialSnapshots.map((response) => {
    const current = Number((response.body as any)?.snapshot?.attemptVersion ?? 0);
    return Number.isFinite(current) && current >= 0 ? current + 1 : 1;
  });

  const autosaveWrites = await Promise.all(students.map((_, index) => requestFor(
    index,
    `/api/live-exam/${sessionId}/autosave`,
    {
      method: 'PUT',
      body: JSON.stringify({
        attemptVersion: autosaveVersions[index],
        idempotencyKey: `load-autosave:${runId}:${index}:${autosaveVersions[index]}`,
        answers: expectedAnswers[index],
      }),
      headers: { 'Idempotency-Key': `load-autosave:${runId}:${index}:${autosaveVersions[index]}` },
    },
  )));
  allResponses.push(...autosaveWrites);

  const verifiedSnapshots = await Promise.all(students.map((_, index) => (
    requestFor(index, `/api/live-exam/${sessionId}/autosave`)
  )));
  allResponses.push(...verifiedSnapshots);
  const lostAnswers = verifiedSnapshots.reduce((count, response, index) => {
    if (!response.ok) return count + 1;
    const snapshot = (response.body as any)?.snapshot;
    if (!snapshot || Number(snapshot.attemptVersion) !== autosaveVersions[index]) return count + 1;
    return equalJson(snapshot.answers, expectedAnswers[index]) ? count : count + 1;
  }, 0);

  const idempotencyKeys = students.map((_, index) => `load-submit:${runId}:${index}:attempt`);
  const submitResponses = await Promise.all(students.map((_, index) => requestFor(
    index,
    `/api/live-exam/${sessionId}/submit`,
    {
      method: 'POST',
      body: JSON.stringify({
        answers: expectedAnswers[index],
        idempotencyKey: idempotencyKeys[index],
      }),
      headers: { 'Idempotency-Key': idempotencyKeys[index] },
    },
  )));
  allResponses.push(...submitResponses);

  const duplicateResponses = await Promise.all(students.map((_, index) => requestFor(
    index,
    `/api/live-exam/${sessionId}/submit`,
    {
      method: 'POST',
      body: JSON.stringify({
        answers: expectedAnswers[index],
        idempotencyKey: idempotencyKeys[index],
      }),
      headers: { 'Idempotency-Key': idempotencyKeys[index] },
    },
  )));
  allResponses.push(...duplicateResponses);
  const duplicateFailures = duplicateResponses.reduce((count, response, index) => (
    compareSubmissionReplay(submitResponses[index]!, response) ? count : count + 1
  ), 0);

  const httpFailures = summarizeHttpFailures(allResponses);
  const statusLatencies = statusResponses.map((response) => response.durationMs);
  const submitLatencies = submitResponses.map((response) => response.durationMs);
  const summary: LoadSummary = {
    concurrency: options.concurrency,
    statusRequests: statusResponses.length,
    autosaveWrites: autosaveWrites.length,
    submitRequests: submitResponses.length,
    duplicateRequests: duplicateResponses.length,
    statusP50Ms: percentile(statusLatencies, 50),
    statusP95Ms: percentile(statusLatencies, 95),
    submitP50Ms: percentile(submitLatencies, 50),
    submitP95Ms: percentile(submitLatencies, 95),
    lostAnswers,
    duplicateFailures,
    d1OverloadErrors: httpFailures.d1OverloadErrors,
    app5xx: httpFailures.app5xx,
    requestErrors: httpFailures.requestErrors,
    elapsedMs: performance.now() - startedAt,
  };
  const acceptance = evaluateAcceptance(summary);
  return { summary, acceptance };
}

const printRun = (summary: LoadSummary, acceptance: AcceptanceResult) => {
  console.log('\nLive Exam load test');
  console.log(JSON.stringify({
    ...summary,
    statusP50Ms: Number(summary.statusP50Ms.toFixed(1)),
    statusP95Ms: Number(summary.statusP95Ms.toFixed(1)),
    submitP50Ms: Number(summary.submitP50Ms.toFixed(1)),
    submitP95Ms: Number(summary.submitP95Ms.toFixed(1)),
    elapsedMs: Number(summary.elapsedMs.toFixed(1)),
    passed: acceptance.passed,
    failures: acceptance.failures,
  }, null, 2));
};

const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1]!)).href;
if (isMain) {
  try {
    const options = parseCli(process.argv.slice(2));
    const { summary, acceptance } = await runLiveExamLoadTest(options);
    printRun(summary, acceptance);
    if (!acceptance.passed) process.exitCode = 1;
  } catch (error) {
    console.error('[live-exam-load-test]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

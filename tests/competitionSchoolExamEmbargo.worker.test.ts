// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({ user: currentUser })),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
  isStudent: vi.fn((user: JWTPayload) => user.role === 'student'),
}));

import * as LiveExamService from '../workers/src/services/liveExamService';
import { handleLiveExamRoutes } from '../workers/src/routes/liveExam';

class FakeStatement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, readonly db: FakeDB) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { this.db.executed.push(this); return this.db.first(this.sql, this.bindings) as T | null; }
  async all<T>() { this.db.executed.push(this); return { results: this.db.all(this.sql, this.bindings) as T[] }; }
  async run() { this.db.executed.push(this); return this.db.run(this.sql, this.bindings); }
}

class FakeDB {
  executed: FakeStatement[] = [];
  first: (sql: string, bindings: unknown[]) => unknown = () => null;
  all: (sql: string, bindings: unknown[]) => unknown[] = () => [];
  run: (sql: string, bindings: unknown[]) => unknown = () => ({ success: true, meta: { changes: 1 } });
  prepare(sql: string) { return new FakeStatement(sql, this); }
}

const sessionRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'live-school-1',
  title: 'School exam',
  quiz_id: 'quiz-1',
  quiz_title: 'Tiếng Việt 4',
  teacher_id: 'admin',
  class_id: null,
  class_name: null,
  participant_scope_type: 'SCHOOL_EXAM_ROOM',
  participant_scope_id: 'room-1',
  result_visibility: 'WITHHELD',
  duration: 45,
  scheduled_at: null,
  started_at: '2026-08-20T08:00:00.000Z',
  ends_at: '2099-08-20T08:45:00.000Z',
  closed_at: null,
  settings: JSON.stringify({ randomizeAnswers: false, showLeaderboard: true, allowLateJoin: true }),
  status: 'active',
  access_code: 'ABC123',
  chat_enabled: 1,
  archived_at: null,
  created_at: '2026-08-20T07:00:00.000Z',
  updated_at: '2026-08-20T08:00:00.000Z',
  ...overrides,
});

const classSessionRow = (overrides: Record<string, unknown> = {}) => sessionRow({
  id: 'live-class-1',
  class_id: 'class-4a',
  class_name: '4A',
  participant_scope_type: 'CLASS',
  participant_scope_id: 'class-4a',
  result_visibility: 'PUBLISHED',
  ...overrides,
});

const forbiddenResultKeyPattern = /"(?:score|rank|correctCount|wrongCount|rewards|leaderboard|awardedCoins|awardedExp|newCoins)"\s*:/;

const expectNoEmbargoedResultFields = (payload: unknown) => {
  expect(JSON.stringify(payload)).not.toMatch(forbiddenResultKeyPattern);
};

const makeSessionDb = (row: Record<string, unknown>) => {
  const db = new FakeDB();
  db.first = (sql) => {
    if (sql.includes('FROM live_exam_sessions s')) return row;
    return null;
  };
  return db;
};

describe('competition school exam server-side result embargo', () => {
  beforeEach(() => {
    currentUser = { id: 'student-a', username: 'student-a', role: 'student' };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns RESULTS_WITHHELD for closed school-exam results before publication without reading score-bearing rows', async () => {
    const db = makeSessionDb(sessionRow({
      status: 'closed',
      closed_at: '2026-08-20T08:45:00.000Z',
    }));
    db.first = (sql) => {
      if (sql.includes('FROM live_exam_sessions s')) {
        return sessionRow({ status: 'closed', closed_at: '2026-08-20T08:45:00.000Z' });
      }
      if (sql.includes('FROM live_exam_participants')) {
        return {
          id: 'participant-a', student_id: 'student-a', score: 9.5, rank: 1,
          correct_count: 19, wrong_count: 1, submitted_at: '2026-08-20T08:40:00.000Z',
        };
      }
      if (sql.includes('FROM student_reward_ledger')) {
        return { coins_delta: 509, exp_delta: 95, payload_json: '{"awardedCoins":509}' };
      }
      if (sql.includes('SELECT coins') && sql.includes('FROM students')) return { coins: 609 };
      return null;
    };
    db.all = () => [{ username: 'student-a', score: 9.5, rank: 1 }];

    const response = await handleLiveExamRoutes(
      new Request('https://test/api/live-exam/live-school-1/results'),
      { DB: db, JWT_SECRET: 'test' } as any,
      '/api/live-exam/live-school-1/results',
      'GET',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({ status: 'error', code: 'RESULTS_WITHHELD' });
    expectNoEmbargoedResultFields(payload);
    expect(db.executed.some((statement) => statement.sql.includes('FROM live_exam_participants'))).toBe(false);
    expect(db.executed.some((statement) => statement.sql.includes('FROM student_reward_ledger'))).toBe(false);
  });

  it('returns acknowledgement only when a WITHHELD school-exam submission is accepted', async () => {
    const db = makeSessionDb(sessionRow());
    vi.spyOn(LiveExamService, 'submitAnswers').mockResolvedValue({
      score: 10,
      correctCount: 20,
      wrongCount: 0,
      submittedAt: '2026-08-20T08:40:00.000Z',
    });

    const response = await handleLiveExamRoutes(
      new Request('https://test/api/live-exam/live-school-1/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: { 'q-1': 'B' }, idempotencyKey: 'live-exam-submit:school-1' }),
      }),
      { DB: db, JWT_SECRET: 'test' } as any,
      '/api/live-exam/live-school-1/submit',
      'POST',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload).toEqual({ success: true, message: 'Answers submitted successfully' });
    expectNoEmbargoedResultFields(payload);
  });

  it('keeps raw results withheld after submission until canonical publication', async () => {
    let currentSession = sessionRow();
    const db = new FakeDB();
    db.first = (sql) => sql.includes('FROM live_exam_sessions s') ? currentSession : null;
    vi.spyOn(LiveExamService, 'submitAnswers').mockResolvedValue({
      score: 10,
      correctCount: 20,
      wrongCount: 0,
      submittedAt: '2026-08-20T08:40:00.000Z',
    });

    const submitResponse = await handleLiveExamRoutes(
      new Request('https://test/api/live-exam/live-school-1/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: { 'q-1': 'B' }, idempotencyKey: 'live-exam-submit:school-1' }),
      }),
      { DB: db, JWT_SECRET: 'test' } as any,
      '/api/live-exam/live-school-1/submit',
      'POST',
    );
    expect(submitResponse.status).toBe(200);
    expect(await submitResponse.json()).toEqual({
      success: true,
      message: 'Answers submitted successfully',
    });

    currentSession = sessionRow({ status: 'closed', closed_at: '2026-08-20T08:45:00.000Z' });
    const resultsResponse = await handleLiveExamRoutes(
      new Request('https://test/api/live-exam/live-school-1/results'),
      { DB: db, JWT_SECRET: 'test' } as any,
      '/api/live-exam/live-school-1/results',
      'GET',
    );
    const resultsPayload = await resultsResponse.json() as any;

    expect(resultsResponse.status).toBe(409);
    expect(resultsPayload).toMatchObject({ status: 'error', code: 'RESULTS_WITHHELD' });
    expectNoEmbargoedResultFields(resultsPayload);
    expect(db.executed.some((statement) => statement.sql.includes('FROM live_exam_participants'))).toBe(false);
  });

  it('preserves the CLASS Live Exam submit response', async () => {
    const db = makeSessionDb(classSessionRow());
    vi.spyOn(LiveExamService, 'submitAnswers').mockResolvedValue({
      score: 8.5,
      correctCount: 17,
      wrongCount: 3,
      submittedAt: '2026-08-20T08:40:00.000Z',
    });

    const response = await handleLiveExamRoutes(
      new Request('https://test/api/live-exam/live-class-1/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: { 'q-1': 'B' }, idempotencyKey: 'live-exam-submit:class-1' }),
      }),
      { DB: db, JWT_SECRET: 'test' } as any,
      '/api/live-exam/live-class-1/submit',
      'POST',
    );
    const payload = await response.json() as any;

    expect(payload).toMatchObject({
      success: true,
      participant: { score: 8.5, correctCount: 17, wrongCount: 3 },
    });
  });

  it('does not leak a previously computed score when a school-exam participant re-joins', async () => {
    const db = makeSessionDb(sessionRow());
    vi.spyOn(LiveExamService, 'joinSession').mockResolvedValue({
      id: 'participant-a',
      liveExamId: 'live-school-1',
      studentId: 'student-a',
      username: 'student-a',
      joinedAt: '2026-08-20T08:00:00.000Z',
      submittedAt: '2026-08-20T08:40:00.000Z',
      answers: { 'q-1': 'B' },
      score: 10,
      correctCount: 20,
      wrongCount: 0,
      rank: 1,
      tabSwitches: 0,
      createdAt: '2026-08-20T08:00:00.000Z',
      updatedAt: '2026-08-20T08:40:00.000Z',
    });

    const response = await handleLiveExamRoutes(
      new Request('https://test/api/live-exam/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accessCode: 'ABC123' }),
      }),
      { DB: db, JWT_SECRET: 'test' } as any,
      '/api/live-exam/join',
      'POST',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.participant).toMatchObject({
      id: 'participant-a',
      liveExamId: 'live-school-1',
      studentId: 'student-a',
      username: 'student-a',
    });
    expectNoEmbargoedResultFields(payload);
  });

  it('enumerates every student-facing Live Exam route so new response paths cannot bypass embargo review', () => {
    const routeDirectory = fileURLToPath(new URL('../workers/src/routes/liveExam/', import.meta.url));
    const studentFacingRouteFiles = readdirSync(routeDirectory)
      .filter((file) => file.endsWith('Route.ts'))
      .filter((file) => {
        const source = readFileSync(`${routeDirectory}/${file}`, 'utf8');
        return source.includes('authenticateStudent(context)') || source.includes('isStudent(auth.data)');
      })
      .sort();

    expect(studentFacingRouteFiles).toEqual([
      'activityRoute.ts',
      'autosaveRoute.ts',
      'chatMessageRoute.ts',
      'chatReadRoute.ts',
      'joinRoute.ts',
      'resultsRoute.ts',
      'statusRoute.ts',
      'submitRoute.ts',
      'timingRoute.ts',
    ]);

    const responseSensitiveFiles = new Set(['joinRoute.ts', 'resultsRoute.ts', 'submitRoute.ts']);
    for (const file of studentFacingRouteFiles) {
      if (responseSensitiveFiles.has(file)) continue;
      const source = readFileSync(`${routeDirectory}/${file}`, 'utf8');
      expect(source, `${file} must not serialize result-bearing fields`).not.toMatch(
        /\b(score|rank|correct_count|wrong_count|rewards?|leaderboard|awardedCoins|awardedExp|newCoins)\b/i,
      );
    }
  });
});

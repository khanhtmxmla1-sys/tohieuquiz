import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({ user: currentUser })),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
  isStudent: vi.fn((user: JWTPayload) => user.role === 'student'),
}));

import * as LiveExamService from '../workers/src/services/liveExamService';
import { handleLiveExamRoutes } from '../workers/src/routes/liveExam';
import { liveExamErrorResponse } from '../workers/src/routes/liveExam/responses';

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
  async batch(statements: FakeStatement[]) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}

const activeSessionRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'live-1',
  title: 'Kiểm tra trực tiếp',
  quiz_id: 'quiz-1',
  quiz_title: 'Toán 4',
  teacher_id: 'teacher-a',
  class_id: 'class-a',
  class_name: '4A',
  duration: 30,
  scheduled_at: null,
  started_at: '2026-07-15T00:00:00.000Z',
  ends_at: '2099-07-15T00:30:00.000Z',
  closed_at: null,
  settings: JSON.stringify({ randomizeAnswers: false, showLeaderboard: true, allowLateJoin: false }),
  status: 'active',
  access_code: 'ABC123',
  chat_enabled: 1,
  archived_at: null,
  created_at: '2026-07-15T00:00:00.000Z',
  updated_at: '2026-07-15T00:00:00.000Z',
  ...overrides,
});

const createParams = (overrides: Partial<LiveExamService.CreateLiveExamParams> = {}): LiveExamService.CreateLiveExamParams => ({
  title: 'Kiểm tra Toán',
  quizId: 'quiz-1',
  teacherId: 'teacher-a',
  classId: 'class-a',
  actorRole: 'teacher',
  duration: 30,
  settings: { randomizeAnswers: false, showLeaderboard: true, allowLateJoin: false },
  ...overrides,
});

function expectServiceError(error: unknown, status: number, message: RegExp) {
  expect(error).toBeInstanceOf(LiveExamService.LiveExamServiceError);
  expect((error as LiveExamService.LiveExamServiceError).status).toBe(status);
  expect((error as Error).message).toMatch(message);
}

describe('live exam P0 authorization and integrity', () => {
  beforeEach(() => {
    currentUser = { id: 'teacher-a', username: 'teacher-a', role: 'teacher' };
  });

  it('rejects creating a session from another teacher quiz', async () => {
    const db = new FakeDB();
    db.first = (sql) => {
      if (sql.includes('FROM teachers t')) {
        return { username: 'teacher-a', full_name: 'Cô A', full_name_count: 1 };
      }
      if (sql.includes('SELECT id, title, created_by FROM quizzes')) {
        return { id: 'quiz-1', title: 'Đề người khác', created_by: 'teacher-b' };
      }
      return null;
    };

    await expect(LiveExamService.createLiveExam(db as any, createParams())).rejects.toSatisfy((error: unknown) => {
      expectServiceError(error, 403, /do not own this quiz/i);
      return true;
    });
    expect(db.executed.some((statement) => statement.sql.includes('INSERT INTO live_exam_sessions'))).toBe(false);
  });

  it('rejects creating a session for another teacher class', async () => {
    const db = new FakeDB();
    db.first = (sql) => {
      if (sql.includes('FROM teachers t')) return { username: 'teacher-a', full_name: 'Cô A', full_name_count: 1 };
      if (sql.includes('SELECT id, title, created_by FROM quizzes')) return { id: 'quiz-1', title: 'Toán', created_by: 'teacher-a' };
      if (sql.includes('SELECT id, name, teacher_username FROM classes')) return { id: 'class-a', name: '4A', teacher_username: 'teacher-b' };
      return null;
    };

    await expect(LiveExamService.createLiveExam(db as any, createParams())).rejects.toSatisfy((error: unknown) => {
      expectServiceError(error, 403, /do not own this class/i);
      return true;
    });
  });

  it('creates a session from a uniquely matched legacy display-name owner', async () => {
    const db = new FakeDB();
    db.first = (sql) => {
      if (sql.includes('FROM teachers t')) return { username: 'teacher-a', full_name: 'Cô A', full_name_count: 1 };
      if (sql.includes('SELECT id, title, created_by FROM quizzes')) return { id: 'quiz-1', title: 'Toán', created_by: 'Cô A' };
      if (sql.includes('SELECT id, name, teacher_username FROM classes')) return { id: 'class-a', name: '4A', teacher_username: 'teacher-a' };
      return null;
    };

    const result = await LiveExamService.createLiveExam(db as any, createParams());

    expect(result).toMatchObject({ quizId: 'quiz-1', teacherId: 'teacher-a', classId: 'class-a' });
    expect(db.executed.some((statement) => statement.sql.includes('INSERT INTO live_exam_sessions'))).toBe(true);
  });

  it('does not allow joining while a session is only scheduled', async () => {
    const db = new FakeDB();
    db.first = (sql) => sql.includes('WHERE s.access_code') ? activeSessionRow({ status: 'scheduled' }) : null;

    await expect(LiveExamService.joinSession(db as any, { accessCode: 'ABC123', studentId: 'student-a', username: 'student-a' }))
      .rejects.toSatisfy((error: unknown) => {
        expectServiceError(error, 409, /not open for joining/i);
        return true;
      });
  });

  it('rejects a student outside the assigned class', async () => {
    const db = new FakeDB();
    db.first = (sql) => {
      if (sql.includes('WHERE s.access_code')) return activeSessionRow({ status: 'waiting' });
      if (sql.includes('FROM students')) return { id: 'student-a', class_id: 'class-b' };
      return null;
    };

    await expect(LiveExamService.joinSession(db as any, { accessCode: 'ABC123', studentId: 'student-a', username: 'student-a' }))
      .rejects.toSatisfy((error: unknown) => {
        expectServiceError(error, 403, /not in the assigned class/i);
        return true;
      });
  });

  it('rejects submission when the exam is not active', async () => {
    const db = new FakeDB();
    db.first = (sql) => sql.includes('FROM live_exam_sessions s') ? activeSessionRow({ status: 'waiting' }) : null;

    await expect(LiveExamService.submitAnswers(db as any, { liveExamId: 'live-1', studentId: 'student-a', answers: {} }))
      .rejects.toSatisfy((error: unknown) => {
        expectServiceError(error, 409, /not active/i);
        return true;
      });
  });

  it('rejects submission after the server deadline', async () => {
    const db = new FakeDB();
    db.first = (sql) => sql.includes('FROM live_exam_sessions s')
      ? activeSessionRow({ ends_at: '2020-01-01T00:00:00.000Z' })
      : null;

    await expect(LiveExamService.submitAnswers(db as any, { liveExamId: 'live-1', studentId: 'student-a', answers: {} }))
      .rejects.toSatisfy((error: unknown) => {
        expectServiceError(error, 409, /time has ended/i);
        return true;
      });
  });

  it('grades with the shared 0-10 engine and uses an atomic first-submit update', async () => {
    const db = new FakeDB();
    db.first = (sql) => {
      if (sql.includes('FROM live_exam_sessions s')) return activeSessionRow();
      if (sql.includes('SELECT id, submitted_at FROM live_exam_participants')) return { id: 'participant-a', submitted_at: null };
      if (sql.includes('SELECT id, title, class_level')) return { id: 'quiz-1', title: 'Toán 4', class_level: '4', time_limit: 30, created_at: '', created_by: 'teacher-a' };
      return null;
    };
    db.all = (sql) => sql.includes('FROM questions')
      ? [{ id: 'q-1', type: 'MCQ', question: '1 + 1?', options: '1|2|3', correct_answer: 'B', items: '', blanks: '', distractors: '', words: '', correct_word_indexes: '' }]
      : [];

    const result = await LiveExamService.submitAnswers(db as any, {
      liveExamId: 'live-1',
      studentId: 'student-a',
      answers: { 'q-1': 'B' },
    });

    expect(result).toMatchObject({ score: 10, correctCount: 1, wrongCount: 0 });
    const update = db.executed.find((statement) => statement.sql.includes('UPDATE live_exam_participants') && statement.sql.includes('submitted_at IS NULL'));
    expect(update).toBeDefined();
  });

  it('rejects a raced duplicate when the atomic update changes no row', async () => {
    const db = new FakeDB();
    db.first = (sql) => {
      if (sql.includes('FROM live_exam_sessions s')) return activeSessionRow();
      if (sql.includes('SELECT id, submitted_at FROM live_exam_participants')) return { id: 'participant-a', submitted_at: null };
      if (sql.includes('SELECT id, title, class_level')) return { id: 'quiz-1', title: 'Toán 4', class_level: '4', time_limit: 30, created_at: '', created_by: 'teacher-a' };
      return null;
    };
    db.all = (sql) => sql.includes('FROM questions')
      ? [{ id: 'q-1', type: 'MCQ', question: '1 + 1?', options: '1|2', correct_answer: 'B' }]
      : [];
    db.run = (sql) => sql.includes('submitted_at IS NULL')
      ? { success: true, meta: { changes: 0 } }
      : { success: true, meta: { changes: 1 } };

    await expect(LiveExamService.submitAnswers(db as any, {
      liveExamId: 'live-1', studentId: 'student-a', answers: { 'q-1': 'B' },
    })).rejects.toSatisfy((error: unknown) => {
      expectServiceError(error, 409, /already submitted/i);
      return true;
    });
  });

  it('blocks archiving an active session and soft-archives a closed session', async () => {
    const activeDb = new FakeDB();
    activeDb.first = (sql) => sql.includes('FROM live_exam_sessions s') ? activeSessionRow() : null;
    await expect(LiveExamService.deleteLiveExam(activeDb as any, 'live-1', 'teacher-a'))
      .rejects.toSatisfy((error: unknown) => {
        expectServiceError(error, 409, /cannot archive/i);
        return true;
      });

    const closedDb = new FakeDB();
    closedDb.first = (sql) => sql.includes('FROM live_exam_sessions s') ? activeSessionRow({ status: 'closed', closed_at: '2026-07-15T00:30:00.000Z' }) : null;
    await LiveExamService.deleteLiveExam(closedDb as any, 'live-1', 'teacher-a');
    expect(closedDb.executed.some((statement) => statement.sql.includes('SET archived_at'))).toBe(true);
    expect(closedDb.executed.some((statement) => statement.sql.includes('DELETE FROM live_exam'))).toBe(false);
  });

  it('starts a waiting session with server-controlled timestamps', async () => {
    const db = new FakeDB();
    db.first = (sql) => sql.includes('FROM live_exam_sessions s')
      ? activeSessionRow({ status: 'waiting', started_at: null, ends_at: null })
      : null;

    await LiveExamService.startExam(db as any, 'live-1', 'teacher-a');

    const transition = db.executed.find((statement) => statement.sql.includes("SET status = 'active'"));
    expect(transition).toBeDefined();
    expect(transition?.bindings[0]).toEqual(expect.any(String));
    expect(transition?.bindings[1]).toEqual(expect.any(String));
    expect(Date.parse(String(transition?.bindings[1]))).toBeGreaterThan(Date.parse(String(transition?.bindings[0])));
  });

  it('upserts activity only for an active unsubmitted participant', async () => {
    const db = new FakeDB();
    db.first = (sql) => {
      if (sql.includes('FROM live_exam_sessions s')) return activeSessionRow();
      if (sql.includes('SELECT submitted_at FROM live_exam_participants')) return { submitted_at: null };
      return null;
    };

    await LiveExamService.updateActivity(db as any, {
      liveExamId: 'live-1',
      studentId: 'student-a',
      currentQuestion: 2,
      answeredCount: 1,
    });

    const upsert = db.executed.find((statement) => statement.sql.includes('ON CONFLICT(live_exam_id, student_id)'));
    expect(upsert).toBeDefined();
    expect(upsert?.bindings.slice(0, 4)).toEqual(['live-1', 'student-a', 2, 1]);
  });
});

describe('live exam analytics route', () => {
  beforeEach(() => {
    currentUser = { id: 'teacher-a', username: 'teacher-a', role: 'teacher' };
  });

  it('returns analytics for the session owner instead of 404', async () => {
    const db = new FakeDB();
    db.first = (sql) => {
      if (sql.includes('FROM live_exam_sessions s')) return activeSessionRow({ status: 'closed', closed_at: '2026-07-15T00:30:00.000Z' });
      if (sql.includes('SELECT id, title, status, quiz_id')) return { id: 'live-1', title: 'Kiểm tra', status: 'closed', quiz_id: 'quiz-1' };
      if (sql.includes('SELECT id, title, class_level')) return { id: 'quiz-1', title: 'Toán', class_level: '4', time_limit: 30, created_at: '', created_by: 'teacher-a' };
      return null;
    };
    db.all = (sql) => {
      if (sql.includes('FROM questions')) return [{ id: 'q-1', type: 'MCQ', question: '1+1?', options: '1|2', correct_answer: 'B' }];
      if (sql.includes('SELECT username, joined_at')) return [{ username: 'student-a', joined_at: '2026-07-15T00:00:00.000Z', submitted_at: '2026-07-15T00:10:00.000Z' }];
      if (sql.includes('SELECT score')) return [{ score: 10 }];
      if (sql.includes('SELECT answers')) return [{ answers: JSON.stringify({ 'q-1': 'B' }) }];
      return [];
    };

    const response = await handleLiveExamRoutes(
      new Request('https://test/api/live-exam/live-1/analytics'),
      { DB: db, JWT_SECRET: 'test' } as any,
      '/api/live-exam/live-1/analytics',
      'GET',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.analytics.session.totalQuestions).toBe(1);
    expect(payload.analytics.scores.average).toBe(10);
    expect(payload.analytics.questions[0].correctRate).toBe(1);
  });

  it('filters archived sessions from the teacher list query', async () => {
    const db = new FakeDB();
    const response = await handleLiveExamRoutes(
      new Request('https://test/api/live-exam/teacher/teacher-a/sessions'),
      { DB: db, JWT_SECRET: 'test' } as any,
      '/api/live-exam/teacher/teacher-a/sessions',
      'GET',
    );

    expect(response.status).toBe(200);
    expect(db.executed[0].sql).toContain('s.archived_at IS NULL');
  });

  it('keeps business LiveExamServiceError messages but hides unknown 500 details', async () => {
    const request = new Request('https://test/api/live-exam/live-1', {
      headers: { 'x-request-id': 'req-live-1' },
    });
    const business = liveExamErrorResponse(
      new LiveExamService.LiveExamServiceError('Cannot archive an active session', 409),
      request,
      'Failed to archive session',
    );
    await expect(business.json()).resolves.toMatchObject({
      message: 'Cannot archive an active session',
    });
    expect(business.status).toBe(409);

    const internal = liveExamErrorResponse(
      new Error('D1_ERROR: no such table live_exam_sessions'),
      request,
      'Failed to get session',
    );
    const payload = await internal.json() as any;
    expect(internal.status).toBe(500);
    expect(payload.message).toBe('Failed to get session');
    expect(payload.requestId).toBe('req-live-1');
    expect(JSON.stringify(payload)).not.toContain('live_exam_sessions');
  });

  it('does not expose raw errors from the teacher sessions route', async () => {
    const db = new FakeDB();
    db.all = () => { throw new Error('D1_ERROR: no such column secret_score'); };
    const response = await handleLiveExamRoutes(
      new Request('https://test/api/live-exam/teacher/teacher-a/sessions', {
        headers: { 'x-request-id': 'req-live-list-1' },
      }),
      { DB: db, JWT_SECRET: 'test' } as any,
      '/api/live-exam/teacher/teacher-a/sessions',
      'GET',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(500);
    expect(payload.message).toBe('Failed to get sessions');
    expect(payload.requestId).toBe('req-live-list-1');
    expect(JSON.stringify(payload)).not.toContain('secret_score');
  });
});

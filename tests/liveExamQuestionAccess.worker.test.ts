// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload = { id: 'student-a', username: 'student-a', role: 'student' };
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({ user: currentUser })),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
  isStudent: vi.fn((user: JWTPayload) => user.role === 'student'),
}));

import { handleLiveExamRoutes } from '../workers/src/routes/liveExam';
import * as LiveExamService from '../workers/src/services/liveExamService';

const sessionRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'session-a', title: 'Live exam', quiz_id: 'quiz-a', teacher_id: 'teacher-a', class_id: 'class-a',
  class_name: '4A', quiz_title: 'Quiz A', duration: 30, status: 'active', access_code: 'ABC123',
  settings: JSON.stringify({ randomizeAnswers: true, showLeaderboard: true, allowLateJoin: false }),
  started_at: '2099-01-01T00:00:00.000Z', ends_at: '2099-01-01T01:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
  participant_scope_type: 'CLASS', result_visibility: 'PUBLISHED', ...overrides,
});

const questionRows = [
  {
    id: 'match-1', type: 'MATCHING', question: 'Nối', options: '', correct_answer: '',
    items: JSON.stringify([{ left: 'A', right: 'X' }, { left: 'B', right: 'Y' }]),
    text_field: '', blanks: '', distractors: '', sentence: '', words: '', correct_word_indexes: '',
    image: '', svg_content: '', svg_alt: '', difficulty: 1,
  },
  {
    id: 'drag-1', type: 'DRAG_DROP', question: 'Kéo', options: '', correct_answer: '', items: '',
    text_field: 'Chọn [1]', blanks: JSON.stringify([{ id: 'blank-a', correctAnswer: 'X' }]),
    distractors: JSON.stringify(['Y']), sentence: '', words: '', correct_word_indexes: '',
    image: '', svg_content: '', svg_alt: '', difficulty: 1,
  },
];

class FakeStatement {
  bindings: unknown[] = [];
  constructor(private readonly sql: string, private readonly db: FakeDb) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { return this.db.first<T>(this.sql, this.bindings); }
  async all<T>() { return { results: this.db.all<T>(this.sql, this.bindings) }; }
  async run() { this.db.mutations += 1; return { success: true, meta: { changes: 1 } }; }
}

class FakeDb {
  mutations = 0;
  questionReads = 0;
  session = sessionRow();
  participant: Record<string, unknown> | null = { id: 'participant-a', student_id: 'student-a', submitted_at: null, individual_ends_at: null };
  first<T>(sql: string): T | null {
    if (sql.includes('FROM live_exam_sessions s')) return this.session as T;
    if (sql.includes('FROM live_exam_participants') && sql.includes('individual_ends_at')) return this.participant as T;
    if (sql.includes('FROM live_exam_participants')) return this.participant as T;
    if (sql.includes('SELECT revision FROM quizzes')) return { revision: 4 } as T;
    if (sql.includes('FROM quizzes WHERE id = ?')) return { id: 'quiz-a', title: 'Quiz A', class_level: '4', time_limit: 30, created_at: '', created_by: 'teacher-a' } as T;
    return null;
  }
  all<T>(sql: string): T[] {
    if (sql.includes('FROM questions')) { this.questionReads += 1; return questionRows as T[]; }
    return [];
  }
  prepare(sql: string) { return new FakeStatement(sql, this); }
}

const env = { JWT_SECRET: 'live-dto-test-secret' } as any;

describe('GET live exam question access', () => {
  beforeEach(() => {
    currentUser = { id: 'student-a', username: 'student-a', role: 'student' };
  });

  it('detects only structured opaque answer IDs, never arbitrary answer content', async () => {
    const { hasOpaqueStudentAnswerIds } = await import('../workers/src/services/liveExamQuestionContract');
    expect(hasOpaqueStudentAnswerIds({
      'short-1': 'sq1_content-is-not-an-id',
      'drag-1': { type: 'DRAG_DROP', values: { blank: 'sq1_content-is-not-an-id' } },
    })).toBe(false);
    expect(hasOpaqueStudentAnswerIds({
      'match-1': { type: 'MATCHING', pairs: { sq1_left: 'right-0' } },
    })).toBe(true);
    expect(hasOpaqueStudentAnswerIds({
      'drag-1': { selectedAnswer: { type: 'DRAG_DROP', values: { sq1_blank: 'X' } } },
    })).toBe(true);
    expect(hasOpaqueStudentAnswerIds({
      'match-1': { sq1_left: 'sq1_right' },
      'drag-1': { sq1_blank: 'X' },
    })).toBe(true);
    expect(hasOpaqueStudentAnswerIds({
      'short-1': { value: 'sq1_content-is-not-an-id' },
      'drag-1': { 'blank-a': 'sq1_content-is-not-an-id' },
    })).toBe(false);
  });

  it('denies an unjoined student before reading questions', async () => {
    const db = new FakeDb(); db.participant = null;
    const response = await request(db);
    expect(response.status).toBe(403);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(db.questionReads).toBe(0);
  });

  it.each([
    ['waiting', 409], ['paused', 409], ['closed', 409],
  ])('denies a session in %s state', async (status, expected) => {
    const db = new FakeDb(); db.session = sessionRow({ status });
    const response = await request(db);
    expect(response.status).toBe(expected);
    expect(db.questionReads).toBe(0);
  });

  it('denies an expired participant deadline without querying the quiz', async () => {
    const db = new FakeDb(); db.participant = { id: 'participant-a', student_id: 'student-a', submitted_at: null, individual_ends_at: '2020-01-01T00:00:00.000Z' };
    const response = await request(db);
    expect(response.status).toBe(409);
    expect(db.questionReads).toBe(0);
  });

  it('uses the session quiz, returns a private safe DTO, and does not mutate state', async () => {
    const db = new FakeDb();
    const before = db.mutations;
    const response = await request(db, '?quizId=attacker-quiz');
    const body = await response.json() as any;
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(body.quizId).toBe('quiz-a');
    expect(body.revision).toBe(4);
    expect(body.questions).toHaveLength(2);
    expect(body.questions[0]).not.toHaveProperty('pairs');
    expect(body.questions[0].leftItems.every((item: any) => item.id.startsWith('sq1_'))).toBe(true);
    expect(body.questions[1].blanks).toEqual([{ id: expect.stringMatching(/^sq1_/) }]);
    expect(JSON.stringify(body)).not.toContain('correctAnswer');
    expect(JSON.stringify(body)).not.toContain('correct_answer');
    expect(JSON.stringify(body)).not.toContain('distractors');
    expect(JSON.stringify(body)).not.toContain('score');
    expect(db.questionReads).toBe(1);
    expect(db.mutations).toBe(before);
  });

  it('keeps live scope separate from the quiz scope', async () => {
    const db = new FakeDb();
    const response = await request(db);
    const body = await response.json() as any;
    const { deriveStudentQuizDtoKey } = await import('../workers/src/services/studentQuizQuestionDto');
    const wrongScope = { quizId: 'quiz-a', revision: 4, scope: 'student-question-dto-v1|student:student-a|quiz-a|public', key: await deriveStudentQuizDtoKey(env.JWT_SECRET) };
    const dto = body.questions[0];
    const { decodeStudentAnswersForGrading } = await import('../workers/src/services/studentQuizQuestionDto');
    await expect(decodeStudentAnswersForGrading([questionRows[0]], {
      [dto.id]: { type: 'MATCHING', pairs: { [dto.leftItems[0].id]: dto.rightItems[0].id } },
    }, wrongScope)).rejects.toMatchObject({ code: 'STUDENT_ANSWER_SCOPE_INVALID' });
  });

  it('validates autosave opaque IDs but preserves the opaque snapshot envelope', async () => {
    const db = new FakeDb();
    const initial = await request(db);
    const body = await initial.json() as any;
    const selectedAnswers = {
      'match-1': { [body.questions[0].leftItems[0].id]: body.questions[0].rightItems[0].id },
      'drag-1': { [body.questions[1].blanks[0].id]: 'X' },
    };
    const saveSpy = vi.spyOn(LiveExamService, 'saveAnswerSnapshot').mockResolvedValue({
      attemptVersion: 1, answers: selectedAnswers as any, updatedAt: '2099-01-01T00:00:00.000Z',
    });
    const response = await handleLiveExamRoutes(
      new Request('https://test/api/live-exam/session-a/autosave', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveExamId: 'session-a', attemptVersion: 1, idempotencyKey: 'autosave-key-000001', answers: selectedAnswers }),
      }), envWithDb(db), '/api/live-exam/session-a/autosave', 'PUT',
    );
    expect(response.status).toBe(200);
    const savedParams = saveSpy.mock.calls[0][1] as any;
    const expectedCanonicalRight = body.questions[0].rightItems[0].content === 'X' ? 'right-0' : 'right-1';
    expect(savedParams.answers.__tohieuquiz_student_dto_v1).toEqual({ quizId: 'quiz-a', revision: 4, version: 1 });
    expect(savedParams.answers.answers).toEqual({
      'match-1': { type: 'MATCHING', pairs: { 'left-0': expectedCanonicalRight } },
      'drag-1': { type: 'DRAG_DROP', values: { 'blank-a': 'X' } },
    });
    const responseBody = await response.json() as any;
    expect(responseBody.snapshot.answers).toEqual(selectedAnswers);
    saveSpy.mockRestore();

    const wrongScope = JSON.parse(JSON.stringify(selectedAnswers));
    wrongScope['match-1'][body.questions[0].leftItems[0].id] = 'sq1_wrong-scope';
    const rejected = await handleLiveExamRoutes(
      new Request('https://test/api/live-exam/session-a/autosave', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveExamId: 'session-a', attemptVersion: 2, idempotencyKey: 'autosave-key-000002', answers: wrongScope }),
      }), envWithDb(db), '/api/live-exam/session-a/autosave', 'PUT',
    );
    expect(rejected.status).toBe(400);
  });

  it('re-encodes a marked canonical snapshot on GET and strips the internal marker', async () => {
    const db = new FakeDb();
    const canonical = {
      'match-1': { 'left-0': 'right-1' },
      'drag-1': { 'blank-a': 'X' },
    };
    const getSpy = vi.spyOn(LiveExamService, 'getAnswerSnapshot').mockResolvedValue({
      attemptVersion: 2,
      answers: {
        __tohieuquiz_student_dto_v1: { version: 1, quizId: 'quiz-a', revision: 4 },
        answers: canonical,
      } as any,
      updatedAt: '2099-01-01T00:00:00.000Z',
    });
    const response = await handleLiveExamRoutes(
      new Request('https://test/api/live-exam/session-a/autosave'), envWithDb(db),
      '/api/live-exam/session-a/autosave', 'GET',
    );
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.snapshot.answers.__tohieuquiz_student_dto_v1).toBeUndefined();
    expect(Object.keys(body.snapshot.answers['match-1'])[0]).toMatch(/^sq1_/);
    expect(Object.values(body.snapshot.answers['match-1'])[0]).toMatch(/^sq1_/);
    const dragKey = Object.keys(body.snapshot.answers['drag-1'])[0];
    expect(dragKey).toMatch(/^sq1_/);
    expect(body.snapshot.answers['drag-1'][dragKey]).toBe('X');
    getSpy.mockRestore();
  });

  it('decodes opaque submit answers before existing live scoring service', async () => {
    const db = new FakeDb();
    const initial = await request(db);
    const body = await initial.json() as any;
    const answers = {
      'match-1': { [body.questions[0].leftItems[0].id]: body.questions[0].rightItems[0].id },
      'drag-1': { [body.questions[1].blanks[0].id]: 'X' },
    };
    const submitSpy = vi.spyOn(LiveExamService, 'submitAnswers').mockResolvedValue({
      score: 10, correctCount: 2, wrongCount: 0, submittedAt: '2099-01-01T00:00:00.000Z',
    });
    const response = await handleLiveExamRoutes(
      new Request('https://test/api/live-exam/session-a/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveExamId: 'session-a', studentId: 'attacker', answers }),
      }), envWithDb(db), '/api/live-exam/session-a/submit', 'POST',
    );
    expect(response.status).toBe(200);
    const canonicalRight = body.questions[0].rightItems[0].content === 'X' ? 'right-0' : 'right-1';
    expect(submitSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      studentId: 'student-a',
      answers: {
        'match-1': { type: 'MATCHING', pairs: { 'left-0': canonicalRight } },
        'drag-1': { type: 'DRAG_DROP', values: { 'blank-a': 'X' } },
      },
    }));
    submitSpy.mockRestore();
  });

  it('keeps committed-submission replay available after the room closes', async () => {
    const db = new FakeDb();
    db.session = sessionRow({ status: 'closed' });
    db.participant = {
      id: 'participant-a', student_id: 'student-a',
      submitted_at: '2099-01-01T00:30:00.000Z', individual_ends_at: null,
    };
    const submitSpy = vi.spyOn(LiveExamService, 'submitAnswers').mockResolvedValue({
      score: 10, correctCount: 2, wrongCount: 0, submittedAt: '2099-01-01T00:30:00.000Z',
    });
    const response = await handleLiveExamRoutes(
      new Request('https://test/api/live-exam/session-a/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          liveExamId: 'session-a', studentId: 'student-a',
          answers: {
            'match-1': { type: 'MATCHING', pairs: { 'left-0': 'right-0' } },
            'drag-1': { type: 'DRAG_DROP', values: { 'blank-a': 'X' } },
          },
        }),
      }), envWithDb(db), '/api/live-exam/session-a/submit', 'POST',
    );
    expect(response.status).toBe(200);
    expect(submitSpy).toHaveBeenCalled();
    submitSpy.mockRestore();
  });
});

function envWithDb(db: FakeDb) { return { ...env, DB: db } as any; }

async function request(db: FakeDb, suffix = '') {
  return handleLiveExamRoutes(
    new Request(`https://test/api/live-exam/session-a/questions${suffix}`), envWithDb(db),
    '/api/live-exam/session-a/questions', 'GET',
  );
}

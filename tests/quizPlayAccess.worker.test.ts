// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
import type { JWTPayload } from '../workers/src/utils/jwt';
import {
  resolveQuizPlayAccess,
  type QuizPlayActor,
} from '../workers/src/services/quizAccessPolicy';
import {
  QUIZ_ACCESS_AUDIENCE,
  QUIZ_ACCESS_ISSUER,
  issueQuizAccessGrant,
  quizAccessGrantLifetimeSeconds,
  verifyQuizAccessGrant,
} from '../workers/src/services/quizAccessGrant';

let currentUser: JWTPayload | null = null;
let authFailure: Response | null = null;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => authFailure ?? (currentUser
    ? { user: currentUser }
    : new Response(JSON.stringify({ status: 'error' }), { status: 401 }))),
  requireAdmin: vi.fn((user: JWTPayload) => user.role === 'admin'),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
}));

import { handleQuizRoutes } from '../workers/src/routes/quizzes';

type QuizRow = {
  id: string;
  revision: number;
  show_on_home: string;
  require_code: string;
  access_code: string;
  time_limit: number;
  created_by?: string;
};

type AssignmentRow = {
  id: string;
  quiz_id: string;
  class_id: string;
  student_id: string;
  deadline: string;
  status: string;
  revoked_at?: string | null;
};

class Statement {
  private bindings: unknown[] = [];

  constructor(private readonly sql: string, private readonly db: FakeDb) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  async first<T>() {
    return this.db.first<T>(this.sql, this.bindings);
  }

  async all<T>() {
    return { results: this.db.all<T>(this.sql, this.bindings) };
  }
}

class FakeDb {
  quiz: QuizRow = {
    id: 'quiz-public',
    revision: 3,
    show_on_home: 'TRUE',
    require_code: 'FALSE',
    access_code: '',
    time_limit: 20,
  };

  assignment: AssignmentRow | null = null;
  studentClassId = 'class-a';
  teacherUsername = 'teacher-a';
  questions = [{
    id: 'question-1',
    quiz_id: 'quiz-public',
    type: 'MCQ',
    question: '2 + 2 = ?',
    options: '["3","4"]',
    correct_answer: '4',
  }];
  questionQueries = 0;
  revisionReads: number[] | null = null;

  prepare(sql: string) {
    return new Statement(sql, this);
  }

  first<T>(sql: string, bindings: unknown[]): T | null {
    if (sql.includes('FROM quizzes WHERE id = ?') && this.revisionReads) {
      const revision = this.revisionReads?.shift() ?? this.quiz.revision;
      return { ...this.quiz, revision } as T;
    }
    if (sql.includes('FROM quizzes') && sql.includes('WHERE id = ?')) {
      return (bindings[0] === this.quiz.id ? this.quiz : null) as T | null;
    }
    if (sql.includes('FROM assignments') && sql.includes('WHERE id = ?')) {
      return (bindings[0] === this.assignment?.id ? this.assignment : null) as T | null;
    }
    if (sql.includes('FROM students') && sql.includes('WHERE id = ?')) {
      return (bindings[0] === 'student-a'
        ? { id: 'student-a', class_id: this.studentClassId }
        : null) as T | null;
    }
    if (sql.includes('FROM students') && sql.includes('WHERE username = ?')) {
      return (bindings[0] === 'student-a'
        ? { id: 'student-a', class_id: this.studentClassId }
        : null) as T | null;
    }
    if (sql.includes('FROM teachers t')) {
      return { username: this.teacherUsername, full_name: this.teacherUsername, full_name_count: 1 } as T;
    }
    if (sql.includes('SELECT created_by FROM quizzes')) {
      return { created_by: this.quiz.created_by || 'teacher-a' } as T;
    }
    return null;
  }

  all<T>(sql: string, bindings: unknown[]): T[] {
    if (sql.includes('FROM questions')) {
      this.questionQueries += 1;
      return (bindings[0] === this.quiz.id ? this.questions : []) as T[];
    }
    return [];
  }
}

const env = (db: FakeDb) => ({ DB: db, JWT_SECRET: 'test-secret' } as any);
const actor = (overrides: Partial<QuizPlayActor> = {}): QuizPlayActor => ({
  role: 'student',
  id: 'student-a',
  username: 'student-a',
  classId: 'class-a',
  ...overrides,
});

describe('quiz play access policy', () => {
  beforeEach(() => { currentUser = null; authFailure = null; });

  it('allows a guest to play only a public quiz without a code', async () => {
    const db = new FakeDb();
    await expect(resolveQuizPlayAccess(db as any, {
      quizId: 'quiz-public',
      actor: null,
      now: new Date('2026-11-17T00:00:00.000Z'),
    })).resolves.toMatchObject({ allowed: true, kind: 'public', revision: 3 });
  });

  it('denies a guest coded quiz until the code has been verified', async () => {
    const db = new FakeDb();
    db.quiz = { ...db.quiz, id: 'quiz-coded', require_code: 'TRUE', access_code: 'ABC123' };
    await expect(resolveQuizPlayAccess(db as any, {
      quizId: 'quiz-coded',
      actor: null,
      now: new Date('2026-11-17T00:00:00.000Z'),
    })).resolves.toMatchObject({ allowed: false, code: 'QUIZ_ACCESS_REQUIRED' });
  });

  it('allows only the assigned student in an open class assignment', async () => {
    const db = new FakeDb();
    db.quiz = { ...db.quiz, id: 'quiz-assigned', show_on_home: 'FALSE' };
    db.assignment = {
      id: 'assignment-a', quiz_id: 'quiz-assigned', class_id: 'class-a', student_id: '',
      deadline: '2099-01-01T00:00:00.000Z', status: 'OPEN',
    };
    await expect(resolveQuizPlayAccess(db as any, {
      quizId: 'quiz-assigned',
      assignmentId: 'assignment-a',
      actor: actor(),
      now: new Date('2026-11-17T00:00:00.000Z'),
    })).resolves.toMatchObject({ allowed: true, kind: 'assigned', assignmentId: 'assignment-a' });

    await expect(resolveQuizPlayAccess(db as any, {
      quizId: 'quiz-assigned',
      assignmentId: 'assignment-a',
      actor: actor({ id: 'student-b', username: 'student-b', classId: 'class-b' }),
      now: new Date('2026-11-17T00:00:00.000Z'),
    })).resolves.toMatchObject({ allowed: false, code: 'ASSIGNMENT_SCOPE_DENIED' });
  });

  it('uses the canonical student class from D1 instead of a stale JWT classId', async () => {
    const db = new FakeDb();
    db.quiz = { ...db.quiz, id: 'quiz-assigned', show_on_home: 'FALSE' };
    db.assignment = {
      id: 'assignment-a', quiz_id: 'quiz-assigned', class_id: 'class-a', student_id: '',
      deadline: '2026-11-18T00:00:00.000Z', status: 'OPEN',
    };
    db.studentClassId = 'class-b';
    await expect(resolveQuizPlayAccess(db as any, {
      quizId: 'quiz-assigned', assignmentId: 'assignment-a', actor: actor({ classId: 'class-a' }),
      now: new Date('2026-11-17T00:00:00.000Z'),
    })).resolves.toMatchObject({ allowed: false, code: 'ASSIGNMENT_SCOPE_DENIED' });

    db.studentClassId = 'class-a';
    await expect(resolveQuizPlayAccess(db as any, {
      quizId: 'quiz-assigned', assignmentId: 'assignment-a', actor: actor({ classId: 'class-b' }),
      now: new Date('2026-11-17T00:00:00.000Z'),
    })).resolves.toMatchObject({ allowed: true, kind: 'assigned' });
  });

  it('falls back to the canonical username lookup for legacy student sessions', async () => {
    const db = new FakeDb();
    db.quiz = { ...db.quiz, id: 'quiz-assigned', show_on_home: 'FALSE' };
    db.assignment = {
      id: 'assignment-a', quiz_id: 'quiz-assigned', class_id: 'class-a', student_id: 'student-a',
      deadline: '2026-11-18T00:00:00.000Z', status: 'OPEN',
    };
    await expect(resolveQuizPlayAccess(db as any, {
      quizId: 'quiz-assigned', assignmentId: 'assignment-a',
      actor: actor({ id: undefined, username: 'student-a', classId: 'stale-class' }),
      now: new Date('2026-11-17T00:00:00.000Z'),
    })).resolves.toMatchObject({ allowed: true, kind: 'assigned' });
  });

  it.each([
    ['closed', { status: 'CLOSED' }],
    ['revoked', { status: 'OPEN', revoked_at: '2026-11-16T00:00:00.000Z' }],
    ['expired', { status: 'OPEN', deadline: '2026-11-16T00:00:00.000Z' }],
    ['malformed deadline', { status: 'OPEN', deadline: 'not-a-date' }],
    ['wrong personal student', { status: 'OPEN', student_id: 'student-b' }],
  ])('denies %s assignments without querying learner questions', async (_label, overrides) => {
    const db = new FakeDb();
    db.quiz = { ...db.quiz, id: 'quiz-assigned', show_on_home: 'FALSE' };
    db.assignment = {
      id: 'assignment-a', quiz_id: 'quiz-assigned', class_id: 'class-a', student_id: '',
      deadline: '2026-11-18T00:00:00.000Z', status: 'OPEN', ...overrides,
    };
    const decision = await resolveQuizPlayAccess(db as any, {
      quizId: 'quiz-assigned', assignmentId: 'assignment-a', actor: actor(),
      now: new Date('2026-11-17T00:00:00.000Z'),
    });
    expect(decision).toMatchObject({ allowed: false, code: 'ASSIGNMENT_SCOPE_DENIED' });
    expect(db.questionQueries).toBe(0);
  });

  it('binds access grants to purpose, quiz revision, assignment, and subject', async () => {
    const token = await issueQuizAccessGrant({
      secret: 'test-secret',
      quizId: 'quiz-coded',
      revision: 7,
      assignmentId: 'assignment-a',
      subject: 'student-a',
      accessCode: 'ABC123',
      expiresInSeconds: 300,
      now: new Date('2026-11-17T00:00:00.000Z'),
    });
    const rawPayload = JSON.parse(Buffer.from(token.grant.split('.')[1], 'base64url').toString('utf8')) as Record<string, unknown>;
    expect(rawPayload).not.toHaveProperty('accessCode');
    expect(rawPayload).not.toHaveProperty('code');
    const plainDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ABC123'));
    const plainHex = Array.from(new Uint8Array(plainDigest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    expect(rawPayload.codeHash).not.toBe(plainHex);
    const wrongPurpose = await new SignJWT({
      quizId: 'quiz-coded', revision: 7, assignmentId: 'assignment-a',
      sub: 'student-a', codeHash: rawPayload.codeHash, purpose: 'wrong-purpose',
    }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(QUIZ_ACCESS_ISSUER).setAudience(QUIZ_ACCESS_AUDIENCE)
      .setIssuedAt(1794873600).setExpirationTime(1794873900)
      .sign(new TextEncoder().encode('test-secret\u0000' + QUIZ_ACCESS_ISSUER + '\u0000v1'));
    await expect(verifyQuizAccessGrant(wrongPurpose, {
      secret: 'test-secret', quizId: 'quiz-coded', revision: 7,
      assignmentId: 'assignment-a', subject: 'student-a', accessCode: 'ABC123',
      now: new Date('2026-11-17T00:01:00.000Z'),
    })).resolves.toBeNull();
    await expect(verifyQuizAccessGrant(token.grant, {
      secret: 'test-secret', quizId: 'quiz-coded', revision: 7,
      assignmentId: 'assignment-a', subject: 'student-a', accessCode: 'ABC123',
      now: new Date('2026-11-17T00:01:00.000Z'),
    })).resolves.toMatchObject({ quizId: 'quiz-coded', revision: 7, assignmentId: 'assignment-a', sub: 'student-a' });
    await expect(verifyQuizAccessGrant(token.grant, {
      secret: 'test-secret', quizId: 'quiz-coded', revision: 7,
      assignmentId: 'assignment-a', subject: 'student-a', accessCode: 'CHANGED',
      now: new Date('2026-11-17T00:01:00.000Z'),
    })).resolves.toBeNull();
    await expect(verifyQuizAccessGrant(token.grant, {
      secret: 'test-secret', quizId: 'quiz-coded', revision: 7,
      assignmentId: 'assignment-a', accessCode: 'ABC123',
      now: new Date('2026-11-17T00:01:00.000Z'),
    })).resolves.toBeNull();
    await expect(verifyQuizAccessGrant(token.grant, {
      secret: 'test-secret', quizId: 'quiz-coded', revision: 7,
      assignmentId: 'assignment-a', subject: 'student-b', accessCode: 'ABC123',
      now: new Date('2026-11-17T00:01:00.000Z'),
    })).resolves.toBeNull();
    await expect(verifyQuizAccessGrant(token.grant, {
      secret: 'test-secret', quizId: 'quiz-coded', revision: 8,
      assignmentId: 'assignment-a', subject: 'student-a',
      now: new Date('2026-11-17T00:01:00.000Z'),
    })).resolves.toBeNull();
    const [grantHeader, grantPayload, grantSignature] = token.grant.split('.');
    const tamperedSignature = `${grantSignature[0] === 'A' ? 'B' : 'A'}${grantSignature.slice(1)}`;
    await expect(verifyQuizAccessGrant([grantHeader, grantPayload, tamperedSignature].join('.'), {
      secret: 'test-secret', quizId: 'quiz-coded', revision: 7,
      assignmentId: 'assignment-a', subject: 'student-a', accessCode: 'ABC123',
      now: new Date('2026-11-17T00:01:00.000Z'),
    })).resolves.toBeNull();
    await expect(verifyQuizAccessGrant(token.grant, {
      secret: 'test-secret', quizId: 'quiz-coded', revision: 7,
      assignmentId: 'assignment-a', subject: 'student-a', accessCode: 'ABC123',
      now: new Date('2026-11-17T00:06:00.000Z'),
    })).resolves.toBeNull();
  });

  it('derives short grant expiry from quiz time limit and caps it', () => {
    expect(quizAccessGrantLifetimeSeconds(10)).toBe(720);
    expect(quizAccessGrantLifetimeSeconds(120)).toBe(3600);
    expect(quizAccessGrantLifetimeSeconds(undefined)).toBe(900);
  });

  it('clamps direct grant callers to the hard maximum lifetime', async () => {
    const token = await issueQuizAccessGrant({
      secret: 'test-secret', quizId: 'quiz-coded', revision: 7,
      accessCode: 'ABC123', expiresInSeconds: 999999,
      now: new Date('2026-11-17T00:00:00.000Z'),
    });
    const payload = JSON.parse(Buffer.from(token.grant.split('.')[1], 'base64url').toString('utf8')) as {
      iat: number;
      exp: number;
    };
    expect(payload.exp - payload.iat).toBe(3600);
  });
});

describe('scope-aware play questions route', () => {
  beforeEach(() => { currentUser = null; authFailure = null; });

  it('returns sanitized questions with a private no-store response', async () => {
    const db = new FakeDb();
    const response = await handleQuizRoutes(
      new Request('https://test/api/quizzes/quiz-public/play-questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      }), env(db), '/api/quizzes/quiz-public/play-questions', 'POST',
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const payload = await response.json() as any;
    expect(payload.quizId).toBe('quiz-public');
    expect(payload.questions[0]).not.toHaveProperty('correct_answer');
    expect(db.questionQueries).toBe(1);
  });

  it('returns legacy pipe-separated options for MCQ and multiple-select questions', async () => {
    const db = new FakeDb();
    db.questions = [
      {
        id: 'mcq-legacy', quiz_id: 'quiz-public', type: 'MCQ', question: 'Chọn một',
        options: 'A|B|C|D', correct_answer: 'B',
      },
      {
        id: 'multi-legacy', quiz_id: 'quiz-public', type: 'MULTIPLE_SELECT', question: 'Chọn nhiều',
        options: 'A|B|C|D', correct_answer: '["A","C"]',
      },
    ];
    const response = await handleQuizRoutes(
      new Request('https://test/api/quizzes/quiz-public/play-questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      }), env(db), '/api/quizzes/quiz-public/play-questions', 'POST',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.questions.map((question: any) => question.options)).toEqual([
      ['A', 'B', 'C', 'D'],
      ['A', 'B', 'C', 'D'],
    ]);
    expect(JSON.stringify(payload)).not.toMatch(/correctAnswer|correct_answer/);
  });

  it('uses the allowlisted DTO for matching and drag-drop questions', async () => {
    const db = new FakeDb();
    db.questions = [
      {
        id: 'matching-1', quiz_id: 'quiz-public', type: 'MATCHING', question: 'Nối',
        items: JSON.stringify([{ left: 'A', right: 'X' }, { left: 'B', right: 'Y' }]),
      },
      {
        id: 'drag-1', quiz_id: 'quiz-public', type: 'DRAG_DROP', question: 'Điền',
        text_field: 'Chọn [1] và [2]',
        blanks: JSON.stringify([{ id: 'drag-a', correctAnswer: 'X' }, { id: 'drag-b', correctAnswer: 'Y' }]),
        distractors: JSON.stringify(['Z']),
      },
    ];
    const response = await handleQuizRoutes(
      new Request('https://test/api/quizzes/quiz-public/play-questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      }), env(db), '/api/quizzes/quiz-public/play-questions', 'POST',
    );
    const payload = await response.json() as any;
    const matching = payload.questions[0];
    const drag = payload.questions[1];
    expect(response.status).toBe(200);
    expect(matching).not.toHaveProperty('pairs');
    expect(matching.leftItems).toHaveLength(2);
    expect(matching.rightItems).toHaveLength(2);
    expect(drag).not.toHaveProperty('distractors');
    expect(drag.blanks).toEqual([
      expect.objectContaining({ id: expect.stringMatching(/^sq1_/) }),
      expect.objectContaining({ id: expect.stringMatching(/^sq1_/) }),
    ]);
    expect(drag.blanks.every((blank: any) => !('correctAnswer' in blank))).toBe(true);
    expect(drag.answerPool).toEqual(expect.arrayContaining(['X', 'Y', 'Z']));
    expect(JSON.stringify(payload)).not.toMatch(/correctAnswer|correct_answer|isCorrect|categoryId/);
  });

  it('lets a guest verify a public code and then play with the returned grant', async () => {
    const db = new FakeDb();
    db.quiz = { ...db.quiz, id: 'quiz-coded', require_code: 'TRUE', access_code: 'ABC123' };
    const verification = await handleQuizRoutes(
      new Request('https://test/api/quizzes/access-verification/quiz-coded', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: 'ABC123' }),
      }), env(db), '/api/quizzes/access-verification/quiz-coded', 'POST',
    );
    const verified = await verification.json() as { grant: string };
    const response = await handleQuizRoutes(
      new Request('https://test/api/quizzes/quiz-coded/play-questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessGrant: verified.grant }),
      }), env(db), '/api/quizzes/quiz-coded/play-questions', 'POST',
    );
    expect(response.status).toBe(200);
    expect(db.questionQueries).toBe(1);
  });

  it('rejects malformed auth cookies instead of treating them as guests', async () => {
    const db = new FakeDb();
    authFailure = new Response(JSON.stringify({ status: 'error' }), { status: 401 });
    const response = await handleQuizRoutes(
      new Request('https://test/api/quizzes/quiz-public/play-questions', {
        method: 'POST', headers: { Cookie: 'auth_token=revoked', 'Content-Type': 'application/json' }, body: '{}',
      }), env(db), '/api/quizzes/quiz-public/play-questions', 'POST',
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(db.questionQueries).toBe(0);
  });

  it('does not query questions for a protected quiz without a verified scope', async () => {
    const db = new FakeDb();
    db.quiz = { ...db.quiz, id: 'quiz-hidden', show_on_home: 'FALSE', require_code: 'TRUE', access_code: 'ABC123' };
    currentUser = actor() as JWTPayload;
    const response = await handleQuizRoutes(
      new Request('https://test/api/quizzes/quiz-hidden/play-questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      }), env(db), '/api/quizzes/quiz-hidden/play-questions', 'POST',
    );
    expect(response.status).toBe(403);
    expect(db.questionQueries).toBe(0);
  });

  it('rejects personal assignments for another student before reading questions', async () => {
    const db = new FakeDb();
    db.quiz = { ...db.quiz, id: 'quiz-assigned', show_on_home: 'FALSE' };
    db.assignment = {
      id: 'assignment-personal', quiz_id: 'quiz-assigned', class_id: 'class-a', student_id: 'student-b',
      deadline: '2026-11-18T00:00:00.000Z', status: 'OPEN',
    };
    currentUser = actor() as JWTPayload;
    const response = await handleQuizRoutes(
      new Request('https://test/api/quizzes/quiz-assigned/play-questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: 'assignment-personal' }),
      }), env(db), '/api/quizzes/quiz-assigned/play-questions', 'POST',
    );
    expect(response.status).toBe(403);
    expect(db.questionQueries).toBe(0);
  });

  it('allows a student in a hidden assigned quiz and denies hidden unassigned access', async () => {
    const db = new FakeDb();
    db.quiz = { ...db.quiz, id: 'quiz-hidden-assigned', show_on_home: 'FALSE' };
    db.assignment = {
      id: 'assignment-class', quiz_id: 'quiz-hidden-assigned', class_id: 'class-a', student_id: '',
      deadline: '2099-01-01T00:00:00.000Z', status: 'OPEN',
    };
    currentUser = actor() as JWTPayload;
    const allowed = await handleQuizRoutes(
      new Request('https://test/api/quizzes/quiz-hidden-assigned/play-questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: 'assignment-class' }),
      }), env(db), '/api/quizzes/quiz-hidden-assigned/play-questions', 'POST',
    );
    expect(allowed.status).toBe(200);

    db.assignment = null;
    const denied = await handleQuizRoutes(
      new Request('https://test/api/quizzes/quiz-hidden-assigned/play-questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      }), env(db), '/api/quizzes/quiz-hidden-assigned/play-questions', 'POST',
    );
    expect(denied.status).toBe(403);
  });

  it('keeps staff playback scoped to the owner while allowing admin access', async () => {
    const db = new FakeDb();
    db.quiz = { ...db.quiz, id: 'quiz-staff', show_on_home: 'FALSE', created_by: 'teacher-a' };
    currentUser = { username: 'teacher-a', role: 'teacher' } as JWTPayload;
    const owner = await handleQuizRoutes(
      new Request('https://test/api/quizzes/quiz-staff/play-questions', { method: 'POST', body: '{}' }),
      env(db), '/api/quizzes/quiz-staff/play-questions', 'POST',
    );
    expect(owner.status).toBe(200);

    db.teacherUsername = 'teacher-b';
    currentUser = { username: 'teacher-b', role: 'teacher' } as JWTPayload;
    const otherTeacher = await handleQuizRoutes(
      new Request('https://test/api/quizzes/quiz-staff/play-questions', { method: 'POST', body: '{}' }),
      env(db), '/api/quizzes/quiz-staff/play-questions', 'POST',
    );
    expect(otherTeacher.status).toBe(403);

    currentUser = { username: 'admin', role: 'admin' } as JWTPayload;
    const admin = await handleQuizRoutes(
      new Request('https://test/api/quizzes/quiz-staff/play-questions', { method: 'POST', body: '{}' }),
      env(db), '/api/quizzes/quiz-staff/play-questions', 'POST',
    );
    expect(admin.status).toBe(200);
  });

  it('rejects a revision change between policy reads before querying questions', async () => {
    const db = new FakeDb();
    db.revisionReads = [3, 4, 5];
    const response = await handleQuizRoutes(
      new Request('https://test/api/quizzes/quiz-public/play-questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      }), env(db), '/api/quizzes/quiz-public/play-questions', 'POST',
    );
    expect(response.status).toBe(409);
    expect(db.questionQueries).toBe(0);
  });

  it('rejects changed code, tampered grant, expired grant, and subject mismatch', async () => {
    const db = new FakeDb();
    db.quiz = { ...db.quiz, id: 'quiz-coded', require_code: 'TRUE', access_code: 'ABC123' };
    const verification = await handleQuizRoutes(
      new Request('https://test/api/quizzes/access-verification/quiz-coded', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: 'ABC123' }),
      }), env(db), '/api/quizzes/access-verification/quiz-coded', 'POST',
    );
    const verified = await verification.json() as { grant: string };
    db.quiz.access_code = 'CHANGED';
    const rotated = await handleQuizRoutes(
      new Request('https://test/api/quizzes/quiz-coded/play-questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessGrant: verified.grant }),
      }), env(db), '/api/quizzes/quiz-coded/play-questions', 'POST',
    );
    expect(rotated.status).toBe(403);
    expect(db.questionQueries).toBe(0);
    db.quiz.access_code = 'ABC123';
    const expired = await issueQuizAccessGrant({
      secret: 'test-secret', quizId: 'quiz-coded', revision: db.quiz.revision,
      accessCode: 'ABC123', expiresInSeconds: 60, now: new Date('2020-01-01T00:00:00.000Z'),
    });
    const [header, payload, signature] = verified.grant.split('.');
    const tamperedSignature = `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
    const tampered = [header, payload, tamperedSignature].join('.');
    for (const [label, token] of [['expired', expired.grant], ['tampered-signature', tampered]] as const) {
      const response = await handleQuizRoutes(
        new Request('https://test/api/quizzes/quiz-coded/play-questions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessGrant: token }),
        }), env(db), '/api/quizzes/quiz-coded/play-questions', 'POST',
      );
      expect(response.status, label).toBe(403);
    }
    expect(db.questionQueries).toBe(0);
  });

  it('does not let a student-bound grant replay as guest or another student', async () => {
    const db = new FakeDb();
    db.quiz = { ...db.quiz, id: 'quiz-coded', require_code: 'TRUE', access_code: 'ABC123' };
    currentUser = actor({ id: 'student-a', username: 'student-a' }) as JWTPayload;
    const verification = await handleQuizRoutes(
      new Request('https://test/api/quizzes/access-verification/quiz-coded', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: 'ABC123' }),
      }), env(db), '/api/quizzes/access-verification/quiz-coded', 'POST',
    );
    const verified = await verification.json() as { grant: string };
    for (const user of [null, actor({ id: 'student-b', username: 'student-b' }) as JWTPayload]) {
      currentUser = user;
      const response = await handleQuizRoutes(
        new Request('https://test/api/quizzes/quiz-coded/play-questions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessGrant: verified.grant }),
        }), env(db), '/api/quizzes/quiz-coded/play-questions', 'POST',
      );
      expect(response.status).toBe(403);
    }
    expect(db.questionQueries).toBe(0);
  });

  it('does not elevate on a database/session failure', async () => {
    const db = new class extends FakeDb {
      override prepare(): never { throw new Error('D1 unavailable'); }
    }();
    await expect(resolveQuizPlayAccess(db as any, {
      quizId: 'quiz-public', actor: actor(), now: new Date('2026-11-17T00:00:00.000Z'),
    })).rejects.toThrow('D1 unavailable');
  });
});

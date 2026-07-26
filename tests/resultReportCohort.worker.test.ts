import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload | null = null;

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => currentUser
    ? { user: currentUser }
    : new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
}));

import { handleResultReportRoutes } from '../workers/src/routes/resultReports';

class Statement {
  bindings: unknown[] = [];

  constructor(readonly sql: string, readonly db: CohortDatabase) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  async first<T>() {
    this.db.executed.push(this);
    return this.db.first(this.sql, this.bindings) as T | null;
  }

  async all<T>() {
    this.db.executed.push(this);
    return { results: this.db.all(this.sql, this.bindings) as T[] };
  }

  async run() {
    this.db.executed.push(this);
    throw new Error('Cohort endpoint must not write');
  }
}

class CohortDatabase {
  executed: Statement[] = [];
  classRow: Record<string, unknown> | null = {
    id: 'class-4a9',
    name: '4A9',
    teacher_username: 'teacher-a',
    archived_at: null,
  };
  quizRow: Record<string, unknown> | null = {
    id: 'quiz-1',
    title: 'Bài 1 – Ôn tập phép nhân',
  };
  quizAccess = true;
  roster: Record<string, unknown>[] = [
    { id: 'student-an', full_name: 'Nguyễn Văn An', username: 'an.4a9', parent_phone: '0901' },
    { id: 'student-binh', full_name: 'Trần Minh Bình', username: 'binh.4a9', parent_phone: null },
    { id: 'student-chi', full_name: 'Lê Thị Chi', username: 'chi.4a9', parent_phone: '0903' },
  ];
  results: Record<string, unknown>[] = [
    {
      id: 'an-old', student_name: 'Nguyễn Văn An', score: 6, correct_count: 6,
      total_questions: 10, submitted_at: '2026-07-10T08:00:00.000Z',
      quiz_title: 'Bài 1 – Ôn tập phép nhân',
    },
    {
      id: 'an-new', student_name: 'NGUYỄN VĂN AN', score: 8, correct_count: 8,
      total_questions: 10, submitted_at: '2026-07-12T08:00:00.000Z',
      quiz_title: 'Bài 1 – Ôn tập phép nhân',
    },
    {
      id: 'binh-one', student_name: 'Trần Minh Bình', score: 9, correct_count: 9,
      total_questions: 10, submitted_at: '2026-07-11T08:00:00.000Z',
      quiz_title: 'Bài 1 – Ôn tập phép nhân',
    },
  ];

  prepare(sql: string) {
    return new Statement(sql, this);
  }

  first(sql: string, _bindings: unknown[]) {
    if (sql.includes('FROM classes') && sql.includes('WHERE id = ?')) return this.classRow;
    if (sql.includes('FROM quizzes') && sql.includes('WHERE id = ?') && !sql.includes('SELECT q.id')) return this.quizRow;
    if (sql.includes('SELECT q.id FROM quizzes q')) return this.quizAccess ? { id: 'quiz-1' } : null;
    return null;
  }

  all(sql: string, _bindings: unknown[]) {
    if (sql.includes('FROM students')) return this.roster;
    if (sql.includes('FROM results')) return this.results;
    return [];
  }
}

const createEnv = (db = new CohortDatabase()) => ({
  DB: db,
  JWT_SECRET: 'test-secret',
} as any);

const cohortRequest = (body: Record<string, unknown> = {}) => new Request(
  'https://example.test/api/result-reports/cohort',
  {
    method: 'POST',
    headers: {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      classId: 'class-4a9',
      quizId: 'quiz-1',
      attemptPolicy: 'latest',
      ...body,
    }),
  },
);

describe('result report cohort API', () => {
  beforeEach(() => {
    currentUser = { username: 'teacher-a', role: 'teacher' };
  });

  it('rejects unauthenticated requests before querying D1', async () => {
    currentUser = null;
    const db = new CohortDatabase();

    const response = await handleResultReportRoutes(
      cohortRequest(), createEnv(db), '/api/result-reports/cohort', 'POST',
    );

    expect(response.status).toBe(401);
    expect(db.executed).toHaveLength(0);
  });

  it('rejects student role with the feature error envelope', async () => {
    currentUser = { id: 'student-an', username: 'an.4a9', role: 'student', classId: 'class-4a9' };
    const db = new CohortDatabase();

    const response = await handleResultReportRoutes(
      cohortRequest(), createEnv(db), '/api/result-reports/cohort', 'POST',
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: 'RESULT_REPORT_FORBIDDEN', message: 'Teacher access required' },
    });
    expect(db.executed).toHaveLength(0);
  });

  it('rejects malformed scope and policy before querying D1', async () => {
    const db = new CohortDatabase();
    const response = await handleResultReportRoutes(
      cohortRequest({ classId: '', quizId: ' '.repeat(2), attemptPolicy: 'best-ever' }),
      createEnv(db), '/api/result-reports/cohort', 'POST',
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'RESULT_REPORT_VALIDATION_ERROR' },
    });
    expect(db.executed).toHaveLength(0);
  });

  it('rejects a class outside the teacher scope', async () => {
    const db = new CohortDatabase();
    db.classRow = { ...db.classRow, teacher_username: 'teacher-b' };

    const response = await handleResultReportRoutes(
      cohortRequest(), createEnv(db), '/api/result-reports/cohort', 'POST',
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: 'RESULT_REPORT_CLASS_FORBIDDEN', message: 'Class is outside your scope' },
    });
  });

  it('rejects a quiz that is neither owned nor assigned to the selected class', async () => {
    const db = new CohortDatabase();
    db.quizAccess = false;

    const response = await handleResultReportRoutes(
      cohortRequest(), createEnv(db), '/api/result-reports/cohort', 'POST',
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: 'RESULT_REPORT_QUIZ_FORBIDDEN', message: 'Quiz is outside your scope' },
    });
  });

  it('returns a server-owned latest-attempt cohort and excludes STARTED rows in SQL', async () => {
    const db = new CohortDatabase();

    const response = await handleResultReportRoutes(
      cohortRequest(), createEnv(db), '/api/result-reports/cohort', 'POST',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      class: { id: 'class-4a9', name: '4A9' },
      quiz: { id: 'quiz-1', title: 'Bài 1 – Ôn tập phép nhân' },
      attemptPolicy: 'latest',
      summary: {
        totalStudents: 3,
        completedStudents: 2,
        notCompletedStudents: 1,
        unresolvedStudents: 0,
        reportCount: 2,
      },
    });
    expect(payload.data.ready.find((item: any) => item.student.id === 'student-an')).toMatchObject({
      attemptCount: 2,
      result: { id: 'an-new', score: 8 },
    });
    expect(payload.data.notCompleted).toEqual([
      expect.objectContaining({ id: 'student-chi', fullName: 'Lê Thị Chi' }),
    ]);

    const rosterQuery = db.executed.find((statement) => statement.sql.includes('FROM students'));
    expect(rosterQuery?.sql).toContain('archived_at IS NULL');
    const resultQuery = db.executed.find((statement) => statement.sql.includes('FROM results'));
    expect(resultQuery?.sql).toContain(`answers != '{"status":"STARTED"}'`);
    expect(resultQuery?.sql).toContain("REPLACE(class_name, 'Lớp ', '')");
    expect(db.executed.every((statement) => !/\bINSERT\b|\bUPDATE\b|\bDELETE\b/i.test(statement.sql))).toBe(true);
  });

  it('passes the highest policy through and surfaces duplicate roster names as unresolved', async () => {
    const db = new CohortDatabase();
    db.roster = [
      ...db.roster,
      { id: 'student-an-2', full_name: ' NGUYỄN VĂN AN ', username: 'an.duplicate', parent_phone: null },
    ];

    const response = await handleResultReportRoutes(
      cohortRequest({ attemptPolicy: 'highest' }), createEnv(db),
      '/api/result-reports/cohort', 'POST',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.data.attemptPolicy).toBe('highest');
    expect(payload.data.summary).toMatchObject({
      totalStudents: 4,
      completedStudents: 1,
      notCompletedStudents: 1,
      unresolvedStudents: 2,
      reportCount: 1,
    });
    expect(payload.data.unresolved.map((item: any) => item.student.id)).toEqual([
      'student-an', 'student-an-2',
    ]);
  });

  it('preserves explicit method and not-found boundaries', async () => {
    const env = createEnv();
    const wrongMethod = await handleResultReportRoutes(
      new Request('https://example.test/api/result-reports/cohort', { method: 'GET' }),
      env, '/api/result-reports/cohort', 'GET',
    );
    expect(wrongMethod.status).toBe(405);

    const unknown = await handleResultReportRoutes(
      new Request('https://example.test/api/result-reports/unknown'),
      env, '/api/result-reports/unknown', 'GET',
    );
    expect(unknown.status).toBe(404);
  });
});

// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload;
vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({ user: currentUser })),
  requireAdmin: vi.fn((user: JWTPayload) => user.role === 'admin'),
  requireTeacher: vi.fn((user: JWTPayload) => user.role === 'teacher' || user.role === 'admin'),
  isStudent: vi.fn((user: JWTPayload) => user.role === 'student'),
}));

import { handleResultRoutes } from '../workers/src/routes/results';

const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
};

class SqliteStatement {
  bindings: unknown[] = [];

  constructor(readonly sql: string, readonly db: AtomicSqliteDatabase) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  async first<T>() {
    this.db.executed.push(this);
    return this.db.first(this.sql, this.bindings) as T;
  }

  async all<T>() {
    this.db.executed.push(this);
    return { results: this.db.all(this.sql, this.bindings) as T[] };
  }

  async run() {
    this.db.executed.push(this);
    return this.db.run(this.sql, this.bindings);
  }
}

class AtomicSqliteDatabase {
  readonly sqlite: DatabaseSync;
  readonly executed: SqliteStatement[] = [];
  readonly parentNotificationWrites: string[] = [];
  readonly activityBatchIds: string[] = [];
  private insertCalls = 0;
  private readonly secondInsertReached = deferred();
  private readonly raceEnabled: boolean;

  constructor(options: { maxAttempts?: number; race?: boolean; path?: string } = {}) {
    this.raceEnabled = options.race ?? true;
    this.sqlite = new DatabaseSync(options.path || ':memory:');

    this.sqlite.exec(`
      CREATE TABLE classes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        teacher_username TEXT NOT NULL
      );
      CREATE TABLE students (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        class_id TEXT NOT NULL,
        archived_at TEXT DEFAULT ''
      );
      CREATE TABLE assignments (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL,
        class_id TEXT NOT NULL,
        student_id TEXT DEFAULT '',
        deadline TEXT NOT NULL,
        max_attempts INTEGER DEFAULT 1,
        status TEXT DEFAULT 'OPEN',
        revoked_at TEXT
      );
      CREATE TABLE quizzes (
        id TEXT PRIMARY KEY,
        revision INTEGER DEFAULT 1,
        show_on_home TEXT DEFAULT 'FALSE',
        require_code TEXT DEFAULT 'FALSE',
        access_code TEXT DEFAULT '',
        time_limit INTEGER DEFAULT 15,
        category TEXT DEFAULT 'math'
      );
      CREATE TABLE questions (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL,
        type TEXT NOT NULL,
        question TEXT NOT NULL,
        question_rich_text TEXT,
        options TEXT DEFAULT '',
        correct_answer TEXT DEFAULT '',
        items TEXT DEFAULT '',
        text_field TEXT DEFAULT '',
        blanks TEXT DEFAULT '',
        distractors TEXT DEFAULT '',
        sentence TEXT DEFAULT '',
        words TEXT DEFAULT '',
        correct_word_indexes TEXT DEFAULT '',
        image TEXT DEFAULT '',
        svg_content TEXT DEFAULT '',
        svg_alt TEXT DEFAULT '',
        difficulty INTEGER DEFAULT 1,
        answer_schema_version INTEGER DEFAULT 1
      );
      CREATE TABLE results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id TEXT,
        assignment_id TEXT,
        class_id TEXT,
        student_name TEXT NOT NULL,
        class_name TEXT DEFAULT '',
        quiz_id TEXT DEFAULT '',
        quiz_title TEXT DEFAULT '',
        score REAL DEFAULT 0,
        correct_count INTEGER DEFAULT 0,
        total_questions INTEGER DEFAULT 0,
        time_taken INTEGER DEFAULT 0,
        submitted_at TEXT NOT NULL,
        answers TEXT DEFAULT '{}',
        grading_version TEXT NOT NULL DEFAULT 'legacy'
      );
      CREATE INDEX idx_results_assignment_student
        ON results(assignment_id, student_id, submitted_at);
    `);
    this.sqlite.prepare('INSERT INTO classes (id, name, teacher_username) VALUES (?, ?, ?)')
      .run('class-4a9', '4A9', 'teacher-a');
    this.sqlite.prepare('INSERT INTO students (id, username, full_name, class_id) VALUES (?, ?, ?, ?)')
      .run('student-1', 'student-1', 'Nguyen Van A', 'class-4a9');
    this.sqlite.prepare(`
      INSERT INTO assignments (id, quiz_id, class_id, student_id, deadline, max_attempts, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('assignment-race', 'quiz-race', 'class-4a9', '', '2099-01-01T00:00:00.000Z', options.maxAttempts ?? 1, 'OPEN');
    this.sqlite.prepare(`
      INSERT INTO quizzes (id, revision, show_on_home, require_code, category)
      VALUES (?, ?, ?, ?, ?)
    `).run('quiz-race', 1, 'FALSE', 'FALSE', 'math');
    this.sqlite.prepare(`
      INSERT INTO questions (id, quiz_id, type, question, options, correct_answer)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('q1', 'quiz-race', 'MCQ', '2 + 2?', '3|4', 'B');
  }

  prepare(sql: string) {
    return new SqliteStatement(sql, this);
  }

  first(sql: string, bindings: unknown[]) {
    if (sql.includes('student_game_activity_events')) return null;
    if (sql.includes('COUNT(*) as cnt')) {
      return this.sqlite.prepare(sql).get(...bindings as any[]);
    }
    if (sql.includes('FROM students') && sql.includes('students.username = ?')) {
      return this.sqlite.prepare(`
        SELECT students.id, students.username, students.full_name, students.class_id,
               classes.name AS class_name
        FROM students LEFT JOIN classes ON classes.id = students.class_id
        WHERE students.username = ?
      `).get(...bindings as any[]);
    }
    if (sql.includes('SELECT id, class_id FROM students')) {
      return this.sqlite.prepare('SELECT id, class_id FROM students WHERE id = ?').get(...bindings as any[]);
    }
    if (sql.includes('SELECT id, full_name') && sql.includes('FROM students')) {
      return this.sqlite.prepare(`
        SELECT id, full_name
        FROM students
        WHERE id = ? AND class_id = ? AND COALESCE(archived_at, '') = ''
        LIMIT 1
      `).get(...bindings as any[]);
    }
    if (sql.includes('FROM assignments') && sql.includes('WHERE a.id = ?')) {
      return this.sqlite.prepare(`
        SELECT a.id, a.quiz_id, a.class_id, COALESCE(a.student_id, '') AS student_id,
               a.max_attempts, a.status, a.deadline, c.name AS class_name
        FROM assignments a JOIN classes c ON c.id = a.class_id
        WHERE a.id = ?
      `).get(...bindings as any[]);
    }
    if (sql.includes('FROM assignments') && sql.includes('WHERE id = ?')) {
      return this.sqlite.prepare('SELECT * FROM assignments WHERE id = ?').get(...bindings as any[]);
    }
    if (sql.includes('FROM classes') && sql.includes('WHERE id = ?')) {
      return this.sqlite.prepare('SELECT id, name, teacher_username FROM classes WHERE id = ?').get(...bindings as any[]);
    }
    if (sql.includes('show_on_home') && sql.includes('FROM quizzes')) {
      return this.sqlite.prepare(`
        SELECT id, revision, show_on_home, require_code, access_code, time_limit
        FROM quizzes WHERE id = ?
      `).get(...bindings as any[]);
    }
    if (sql.includes('SELECT category FROM quizzes')) {
      return this.sqlite.prepare('SELECT category FROM quizzes WHERE id = ?').get(...bindings as any[]);
    }
    return null;
  }

  all(sql: string, bindings: unknown[]) {
    if (sql.includes('FROM questions')) {
      return this.sqlite.prepare(sql).all(...bindings as any[]);
    }
    return [];
  }

  async run(sql: string, bindings: unknown[]) {
    if (sql.includes('INSERT INTO results')) {
      if (this.raceEnabled) {
        this.insertCalls += 1;
        if (this.insertCalls === 1) {
          await this.secondInsertReached.promise;
        } else if (this.insertCalls === 2) {
          this.secondInsertReached.resolve();
        }
      }
      const result = this.sqlite.prepare(sql).run(...bindings as any[]);
      return {
        success: true,
        meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) },
      };
    }
    if (sql.includes('INSERT OR IGNORE INTO parent_notifications')) {
      this.parentNotificationWrites.push(sql);
    }
    return { success: true, meta: { changes: 1, last_row_id: 0 } };
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]) {
    const activityId = (statements[0] as unknown as SqliteStatement)?.bindings[0];
    if (typeof activityId === 'string') this.activityBatchIds.push(activityId);
    return statements.map(() => ({ success: true, results: [] as T[], meta: { changes: 1 } })) as Array<D1Result<T>>;
  }

  close() {
    this.sqlite.close();
  }
}

const request = (overrides: Record<string, unknown> = {}) => new Request('https://example.test/api/results', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    assignmentId: 'assignment-race',
    quizId: 'quiz-race',
    quizTitle: 'Race test',
    timeTaken: 1,
    answers: { q1: { selectedAnswer: 'B' } },
    ...overrides,
  }),
});

describe('assignment result atomicity on real SQLite', () => {
  let db: AtomicSqliteDatabase;
  let tempDirectories: string[];

  beforeEach(() => {
    currentUser = { id: 'student-1', username: 'student-1', role: 'student', classId: 'class-4a9' } as JWTPayload;
    db = new AtomicSqliteDatabase({ race: false });
    tempDirectories = [];
  });

  afterEach(() => {
    db.close();
    for (const directory of tempDirectories) rmSync(directory, { recursive: true, force: true });
  });

  it('executes the route-generated assignment insert atomically under a forced race', async () => {
    db.close();
    db = new AtomicSqliteDatabase({ race: true });
    const responses = await Promise.all([
      handleResultRoutes(request(), { DB: db } as any, '/api/results', 'POST'),
      handleResultRoutes(request(), { DB: db } as any, '/api/results', 'POST'),
    ]);
    const payloads = await Promise.all(responses.map((response) => response.json() as Promise<any>));
    const insert = db.executed.find((statement) => statement.sql.includes('INSERT INTO results'));
    const persisted = db.sqlite.prepare(`
      SELECT COUNT(*) AS count
      FROM results
      WHERE assignment_id = 'assignment-race' AND student_id = 'student-1'
    `).get() as { count: number };

    expect(insert?.sql).toContain('SELECT');
    expect(insert?.sql).toContain('COALESCE(answers, \'\') != \'{"status":"STARTED"}\'');
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(payloads.find((payload) => payload.code === 'ASSIGNMENT_ATTEMPTS_EXHAUSTED')).toMatchObject({
      attemptCount: 1,
      maxAttempts: 1,
    });
    expect(persisted.count).toBe(1);
    expect(db.parentNotificationWrites).toHaveLength(1);
    expect(db.activityBatchIds).toEqual(['1']);
  });

  it('allows only one additional result when two requests race with one attempt remaining', async () => {
    db.close();
    db = new AtomicSqliteDatabase({ maxAttempts: 3 });
    db.sqlite.prepare(`
      INSERT INTO results (
        student_id, assignment_id, class_id, student_name, submitted_at, answers, grading_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('student-1', 'assignment-race', 'class-4a9', 'Nguyen Van A', '2026-11-20T00:00:00.000Z', '{}', 'legacy');
    db.sqlite.prepare(`
      INSERT INTO results (
        student_id, assignment_id, class_id, student_name, submitted_at, answers, grading_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('student-1', 'assignment-race', 'class-4a9', 'Nguyen Van A', '2026-11-20T00:01:00.000Z', '{}', 'legacy');

    const responses = await Promise.all([
      handleResultRoutes(request(), { DB: db } as any, '/api/results', 'POST'),
      handleResultRoutes(request(), { DB: db } as any, '/api/results', 'POST'),
    ]);
    const payloads = await Promise.all(responses.map((response) => response.json() as Promise<any>));
    const persisted = db.sqlite.prepare(`
      SELECT COUNT(*) AS count
      FROM results
      WHERE assignment_id = 'assignment-race' AND student_id = 'student-1'
        AND COALESCE(answers, '') != '{"status":"STARTED"}'
    `).get() as { count: number };

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(payloads.find((payload) => payload.code === 'ASSIGNMENT_ATTEMPTS_EXHAUSTED')).toMatchObject({
      attemptCount: 3,
      maxAttempts: 3,
    });
    expect(persisted.count).toBe(3);
    expect(db.parentNotificationWrites).toHaveLength(1);
    expect(db.activityBatchIds).toEqual(['3']);
  });

  it('keeps attempt limits independent for students and assignments sharing a quiz', async () => {
    db.sqlite.prepare('INSERT INTO students (id, username, full_name, class_id) VALUES (?, ?, ?, ?)')
      .run('student-2', 'student-2', 'Tran Thi B', 'class-4a9');
    db.sqlite.prepare(`
      INSERT INTO assignments (id, quiz_id, class_id, student_id, deadline, max_attempts, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('assignment-race-2', 'quiz-race', 'class-4a9', '', '2099-01-01T00:00:00.000Z', 1, 'OPEN');

    const first = await handleResultRoutes(request(), { DB: db } as any, '/api/results', 'POST');
    currentUser = { id: 'student-2', username: 'student-2', role: 'student', classId: 'class-4a9' } as JWTPayload;
    const secondStudent = await handleResultRoutes(request(), { DB: db } as any, '/api/results', 'POST');
    currentUser = { id: 'student-1', username: 'student-1', role: 'student', classId: 'class-4a9' } as JWTPayload;
    const secondAssignment = await handleResultRoutes(
      request({ assignmentId: 'assignment-race-2' }),
      { DB: db } as any,
      '/api/results',
      'POST',
    );

    expect([first.status, secondStudent.status, secondAssignment.status]).toEqual([200, 200, 200]);
    const rows = db.sqlite.prepare(`
      SELECT assignment_id, student_id, COUNT(*) AS count
      FROM results
      GROUP BY assignment_id, student_id
      ORDER BY assignment_id, student_id
    `).all() as Array<{ assignment_id: string; student_id: string; count: number }>;
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ assignment_id: 'assignment-race', student_id: 'student-1', count: 1 }),
      expect.objectContaining({ assignment_id: 'assignment-race', student_id: 'student-2', count: 1 }),
      expect.objectContaining({ assignment_id: 'assignment-race-2', student_id: 'student-1', count: 1 }),
    ]));
  });

  it('preserves the exact STARTED sentinel exclusion while counting null answers', async () => {
    db.close();
    db = new AtomicSqliteDatabase({ race: true, maxAttempts: 3 });
    db.sqlite.prepare(`
      INSERT INTO results (
        student_id, assignment_id, class_id, student_name, submitted_at, answers, grading_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('student-1', 'assignment-race', 'class-4a9', 'Nguyen Van A', '2026-11-20T00:00:00.000Z', '{"status":"STARTED"}', 'legacy');
    db.sqlite.prepare(`
      INSERT INTO results (
        student_id, assignment_id, class_id, student_name, submitted_at, answers, grading_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('student-1', 'assignment-race', 'class-4a9', 'Nguyen Van A', '2026-11-20T00:01:00.000Z', null, 'legacy');
    db.sqlite.prepare(`
      INSERT INTO results (
        student_id, assignment_id, class_id, student_name, submitted_at, answers, grading_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('student-1', 'assignment-race', 'class-4a9', 'Nguyen Van A', '2026-11-20T00:02:00.000Z', '{}', 'legacy');

    const responses = await Promise.all([
      handleResultRoutes(request(), { DB: db } as any, '/api/results', 'POST'),
      handleResultRoutes(request(), { DB: db } as any, '/api/results', 'POST'),
    ]);
    const payloads = await Promise.all(responses.map((response) => response.json() as Promise<any>));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(payloads.find((payload) => payload.code === 'ASSIGNMENT_ATTEMPTS_EXHAUSTED')).toMatchObject({
      attemptCount: 3,
      maxAttempts: 3,
    });
    expect(db.sqlite.prepare(`
      SELECT COUNT(*) AS count FROM results
      WHERE assignment_id = 'assignment-race' AND student_id = 'student-1'
        AND COALESCE(answers, '') != '{"status":"STARTED"}'
    `).get()).toMatchObject({ count: 3 });
  });

  it('uses the same route-generated predicate across independent SQLite connections', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'quiz-assignment-atomic-'));
    tempDirectories.push(directory);
    const databasePath = join(directory, 'results.sqlite');
    db.close();
    db = new AtomicSqliteDatabase({ path: databasePath, race: false });

    const response = await handleResultRoutes(request(), { DB: db } as any, '/api/results', 'POST');
    expect(response.status).toBe(200);
    const insert = db.executed.find((statement) => statement.sql.includes('INSERT INTO results'));
    expect(insert).toBeDefined();
    db.sqlite.exec('DELETE FROM results');

    const firstConnection = new DatabaseSync(databasePath);
    const secondConnection = new DatabaseSync(databasePath);
    try {
      const firstWrite = firstConnection.prepare(insert!.sql).run(...insert!.bindings as any[]);
      const secondWrite = secondConnection.prepare(insert!.sql).run(...insert!.bindings as any[]);
      expect(Number(firstWrite.changes)).toBe(1);
      expect(Number(secondWrite.changes)).toBe(0);
    } finally {
      firstConnection.close();
      secondConnection.close();
    }

    expect(db.sqlite.prepare(`
      SELECT COUNT(*) AS count FROM results
      WHERE assignment_id = 'assignment-race' AND student_id = 'student-1'
    `).get()).toMatchObject({ count: 1 });
  });

  it('retains unassigned staff submissions as unconditional result inserts', async () => {
    db.sqlite.prepare(`
      INSERT INTO quizzes (id, revision, show_on_home, require_code, category)
      VALUES (?, ?, ?, ?, ?)
    `).run('quiz-unassigned', 1, 'FALSE', 'FALSE', 'math');
    db.sqlite.prepare(`
      INSERT INTO questions (id, quiz_id, type, question, options, correct_answer)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('q-unassigned', 'quiz-unassigned', 'MCQ', '3 + 3?', '5|6', 'B');
    currentUser = { id: 'teacher-a', username: 'teacher-a', role: 'teacher', classId: 'class-4a9' } as JWTPayload;

    const response = await handleResultRoutes(
      request({
        assignmentId: undefined,
        quizId: 'quiz-unassigned',
        classId: 'class-4a9',
        studentId: 'student-1',
        studentName: 'Nguyen Van A',
        className: '4A9',
        answers: { 'q-unassigned': { selectedAnswer: 'B' } },
      }),
      { DB: db } as any,
      '/api/results',
      'POST',
    );
    const payload = await response.json() as any;
    expect(response.status).toBe(200);
    expect(payload.assignmentId).toBeNull();
    expect(db.sqlite.prepare(`
      SELECT COUNT(*) AS count FROM results
      WHERE assignment_id IS NULL AND quiz_id = 'quiz-unassigned' AND student_id = 'student-1'
    `).get()).toMatchObject({ count: 1 });
    const insert = db.executed.find((statement) => statement.sql.includes('INSERT INTO results'));
    expect(insert?.sql).toContain('VALUES');
    expect(insert?.sql).not.toContain('COALESCE(answers');
  });

  it('uses the existing assignment/student index for the atomic count predicate', () => {
    const queryPlan = db.sqlite.prepare(`
      EXPLAIN QUERY PLAN
      SELECT COUNT(*) FROM results
      WHERE assignment_id = ?
        AND student_id = ?
        AND COALESCE(answers, '') != '{"status":"STARTED"}'
    `).all('assignment-race', 'student-1') as Array<{ detail: string }>;

    expect(queryPlan.some((row) => row.detail.includes('idx_results_assignment_student'))).toBe(true);
  });
});

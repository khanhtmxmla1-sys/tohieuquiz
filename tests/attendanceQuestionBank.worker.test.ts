// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let currentUser: any = { id: 'teacher-a', username: 'teacher-a', role: 'teacher' };

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({ user: currentUser })),
  isStudent: vi.fn((user: any) => user.role === 'student'),
  requireTeacher: vi.fn((user: any) => user.role === 'teacher' || user.role === 'admin'),
  requireAdmin: vi.fn((user: any) => user.role === 'admin'),
  requireOwnership: vi.fn((user: any, owner: string) => user.role === 'admin' || user.username === owner),
}));

import { getCurrentDateKey } from '../workers/src/gameLoop/dateKeys';
import { handleClassroomRoutes } from '../workers/src/routes/classroom';
import { handleGamificationRoutes } from '../workers/src/routes/gamification';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, private readonly db: DatabaseSync) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { return this.db.prepare(this.sql).get(...this.bindings as any[]) as T; }
  async all<T>() { return { results: this.db.prepare(this.sql).all(...this.bindings as any[]) as T[] }; }
  async run() { return this.db.prepare(this.sql).run(...this.bindings as any[]); }
  runSync() { return this.db.prepare(this.sql).run(...this.bindings as any[]); }
}

class SqliteD1 {
  constructor(readonly sqlite: DatabaseSync) {}
  prepare(sql: string) { return new Statement(sql, this.sqlite); }
  async batch(statements: Statement[]) {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(statement => statement.runSync());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }
}

let sqlite: DatabaseSync;
let db: SqliteD1;
const today = getCurrentDateKey();

const env = () => ({ DB: db, JWT_SECRET: 'test-secret' } as any);
const request = (url: string, init: RequestInit = {}) => new Request(url, {
  ...init,
  headers: {
    Authorization: 'Bearer test',
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  },
});

beforeEach(() => {
  currentUser = { id: 'teacher-a', username: 'teacher-a', role: 'teacher' };
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      teacher_username TEXT NOT NULL,
      created_at TEXT NOT NULL,
      archived_at TEXT DEFAULT ''
    );
    CREATE TABLE students (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      class_id TEXT NOT NULL,
      coins INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT DEFAULT ''
    );
    CREATE TABLE user_pets (
      username TEXT PRIMARY KEY,
      pet_id TEXT DEFAULT 'cat_01',
      pet_name TEXT DEFAULT 'Mèo Con',
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      exp_to_next INTEGER DEFAULT 100,
      total_exp INTEGER NOT NULL DEFAULT 0,
      mood TEXT DEFAULT 'happy',
      items TEXT DEFAULT '[]',
      last_active TEXT DEFAULT ''
    );
    CREATE TABLE student_reward_ledger (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_key TEXT NOT NULL,
      reward_type TEXT NOT NULL,
      coins_delta INTEGER NOT NULL DEFAULT 0,
      exp_delta INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      UNIQUE(student_id, source_type, source_key)
    );
    CREATE TABLE attendance_claims (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      claim_date TEXT NOT NULL,
      reward_exp INTEGER NOT NULL,
      reward_coins INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(username, claim_date)
    );
    CREATE TABLE class_attendance_settings (
      class_id TEXT PRIMARY KEY,
      is_enabled INTEGER NOT NULL DEFAULT 0,
      updated_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE class_attendance_questions (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT '',
      question_text TEXT NOT NULL,
      question_rich_text TEXT,
      options_json TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      image_url TEXT,
      image_alt TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE attendance_attempts (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      username TEXT NOT NULL,
      class_id TEXT NOT NULL,
      attempt_date TEXT NOT NULL,
      status TEXT NOT NULL,
      correct_count INTEGER NOT NULL DEFAULT 0,
      total_questions INTEGER NOT NULL DEFAULT 2,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      UNIQUE(student_id, attempt_date)
    );
    CREATE TABLE attendance_attempt_items (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL,
      question_id TEXT,
      position INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      question_rich_text TEXT,
      options_json TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      image_url TEXT,
      image_alt TEXT,
      selected_answer TEXT,
      is_correct INTEGER,
      answered_at TEXT,
      UNIQUE(attempt_id, position)
    );

    INSERT INTO classes VALUES ('class-a', '3A1', 'teacher-a', '2026-09-01T00:00:00.000Z', '');
    INSERT INTO classes VALUES ('class-b', '3A2', 'teacher-b', '2026-09-01T00:00:00.000Z', '');
    INSERT INTO students VALUES ('student-a', 'student-a', 'An', 'class-a', 100, '');
    INSERT INTO students VALUES ('student-b', 'student-b', 'Bình', 'class-a', 100, '');
    INSERT INTO user_pets(username, total_exp) VALUES ('student-a', 0);
    INSERT INTO user_pets(username, total_exp) VALUES ('student-b', 0);
  `);
  db = new SqliteD1(sqlite);
});

afterEach(() => sqlite.close());

const teacherCall = (path: string, method: string, body?: unknown) => handleClassroomRoutes(
  request(`https://test${path}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }),
  env(),
  path,
  method,
);

const studentCall = (path: string, method: string, body?: unknown) => handleGamificationRoutes(
  request(`https://test${path}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }),
  env(),
  new URL(`https://test${path}`).pathname,
  method,
);

const seedQuestion = async (question: string, answer = 'B') => {
  const response = await teacherCall('/api/classes/class-a/attendance/questions', 'POST', {
    subject: 'Toán',
    question,
    options: ['1', '2', '3', '4'],
    correctAnswer: answer,
  });
  expect(response.status).toBe(200);
};

describe('teacher attendance question bank', () => {
  it('requires at least two active questions before enabling attendance', async () => {
    await seedQuestion('1 + 1 bằng bao nhiêu?');

    const response = await teacherCall('/api/classes/class-a/attendance', 'PATCH', { enabled: true });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      status: 'error',
      message: expect.stringContaining('ít nhất 2 câu'),
    });
  });

  it('lets the owning teacher manage questions but rejects another teacher', async () => {
    await seedQuestion('1 + 1 bằng bao nhiêu?');
    await seedQuestion('2 + 2 bằng bao nhiêu?', 'D');

    const own = await teacherCall('/api/classes/class-a/attendance', 'GET');
    expect(own.status).toBe(200);
    const payload = await own.json() as any;
    expect(payload.data.questions).toHaveLength(2);
    expect(payload.data.stats.totalStudents).toBe(2);

    currentUser = { id: 'teacher-b', username: 'teacher-b', role: 'teacher' };
    const forbidden = await teacherCall('/api/classes/class-a/attendance', 'GET');
    expect(forbidden.status).toBe(403);
  });
});

describe('student attendance attempt flow', () => {
  beforeEach(async () => {
    await seedQuestion('1 + 1 bằng bao nhiêu?');
    await seedQuestion('2 + 2 bằng bao nhiêu?', 'D');
    await seedQuestion('3 + 3 bằng bao nhiêu?', 'C');
    const enabled = await teacherCall('/api/classes/class-a/attendance', 'PATCH', { enabled: true });
    expect(enabled.status).toBe(200);
    currentUser = { id: 'student-a', username: 'student-a', role: 'student', classId: 'class-a' };
  });

  it('returns exactly two fixed random questions without leaking correct answers', async () => {
    const first = await studentCall('/api/game-state/attendance-start', 'POST', { username: 'student-a' });
    expect(first.status).toBe(200);
    const firstPayload = await first.json() as any;
    expect(firstPayload.data.items).toHaveLength(2);
    expect(new Set(firstPayload.data.items.map((item: any) => item.questionId)).size).toBe(2);
    expect(firstPayload.data.items[0]).not.toHaveProperty('correctAnswer');

    const second = await studentCall('/api/game-state/attendance-start', 'POST', { username: 'student-a' });
    expect(second.status).toBe(200);
    const secondPayload = await second.json() as any;
    expect(secondPayload.data.attemptId).toBe(firstPayload.data.attemptId);
    expect(secondPayload.data.items.map((item: any) => item.id))
      .toEqual(firstPayload.data.items.map((item: any) => item.id));
  });

  it('awards 5 Xu and 10 EXP after two answers even when both are wrong', async () => {
    const start = await studentCall('/api/game-state/attendance-start', 'POST', { username: 'student-a' });
    const started = await start.json() as any;
    const [firstItem, secondItem] = started.data.items;

    const answer1 = await studentCall('/api/game-state/attendance-answer', 'POST', {
      username: 'student-a',
      attemptId: started.data.attemptId,
      itemId: firstItem.id,
      selectedAnswer: 'A',
    });
    expect(answer1.status).toBe(200);
    expect((await answer1.json() as any).data.completed).toBe(false);

    const answer2 = await studentCall('/api/game-state/attendance-answer', 'POST', {
      username: 'student-a',
      attemptId: started.data.attemptId,
      itemId: secondItem.id,
      selectedAnswer: 'A',
    });
    expect(answer2.status).toBe(200);
    const completed = await answer2.json() as any;
    expect(completed.data.completed).toBe(true);
    expect(completed.data.awardedCoins).toBe(5);
    expect(completed.data.awardedExp).toBe(10);

    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 105 });
    expect(sqlite.prepare(`SELECT total_exp FROM user_pets WHERE username='student-a'`).get()).toEqual({ total_exp: 10 });
    expect(sqlite.prepare(`SELECT reward_coins, reward_exp FROM attendance_claims WHERE username='student-a' AND claim_date=?`).get(today))
      .toEqual({ reward_coins: 5, reward_exp: 10 });

    const retry = await studentCall('/api/game-state/attendance-answer', 'POST', {
      username: 'student-a',
      attemptId: started.data.attemptId,
      itemId: secondItem.id,
      selectedAnswer: 'B',
    });
    expect(retry.status).toBe(200);
    expect(sqlite.prepare(`SELECT coins FROM students WHERE id='student-a'`).get()).toEqual({ coins: 105 });
  });

  it('hides attendance immediately when the teacher turns it off', async () => {
    currentUser = { id: 'teacher-a', username: 'teacher-a', role: 'teacher' };
    const disabled = await teacherCall('/api/classes/class-a/attendance', 'PATCH', { enabled: false });
    expect(disabled.status).toBe(200);

    currentUser = { id: 'student-a', username: 'student-a', role: 'student', classId: 'class-a' };
    const status = await studentCall('/api/game-state/attendance-status?username=student-a', 'GET');
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({
      data: {
        enabled: false,
        available: false,
        nextRewardCoins: 5,
        nextRewardExp: 10,
      },
    });

    const start = await studentCall('/api/game-state/attendance-start', 'POST', { username: 'student-a' });
    expect(start.status).toBe(409);
  });

  it('lets an already-started attempt resume and finish after the teacher turns attendance off', async () => {
    const start = await studentCall('/api/game-state/attendance-start', 'POST', { username: 'student-a' });
    expect(start.status).toBe(200);
    const started = await start.json() as any;
    const [firstItem, secondItem] = started.data.items;

    currentUser = { id: 'teacher-a', username: 'teacher-a', role: 'teacher' };
    const disabled = await teacherCall('/api/classes/class-a/attendance', 'PATCH', { enabled: false });
    expect(disabled.status).toBe(200);

    currentUser = { id: 'student-a', username: 'student-a', role: 'student', classId: 'class-a' };
    const resumed = await studentCall('/api/game-state/attendance-start', 'POST', { username: 'student-a' });
    expect(resumed.status).toBe(200);
    const resumedPayload = await resumed.json() as any;
    expect(resumedPayload.data.attemptId).toBe(started.data.attemptId);

    const answer1 = await studentCall('/api/game-state/attendance-answer', 'POST', {
      username: 'student-a',
      attemptId: started.data.attemptId,
      itemId: firstItem.id,
      selectedAnswer: 'A',
    });
    expect(answer1.status).toBe(200);

    const answer2 = await studentCall('/api/game-state/attendance-answer', 'POST', {
      username: 'student-a',
      attemptId: started.data.attemptId,
      itemId: secondItem.id,
      selectedAnswer: 'A',
    });
    expect(answer2.status).toBe(200);
    const completed = await answer2.json() as any;
    expect(completed.data.completed).toBe(true);
    expect(completed.data.awardedCoins).toBe(5);
    expect(completed.data.awardedExp).toBe(10);
  });
});

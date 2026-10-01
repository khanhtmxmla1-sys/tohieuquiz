// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const { authMiddleware } = vi.hoisted(() => ({ authMiddleware: vi.fn() }));

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: authMiddleware,
  isStudent: (user: any) => user?.role === 'student',
}));

import { handleGamificationRoutes } from '../workers/src/routes/gamification';

class Statement {
  private bindings: unknown[] = [];

  constructor(private readonly sql: string, private readonly sqlite: DatabaseSync) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  async first<T>() {
    return this.sqlite.prepare(this.sql).get(...this.bindings as any[]) as T;
  }

  async all<T>() {
    return { results: this.sqlite.prepare(this.sql).all(...this.bindings as any[]) as T[] };
  }
}

class SqliteD1 {
  constructor(readonly sqlite: DatabaseSync) {}

  prepare(sql: string) {
    return new Statement(sql, this.sqlite);
  }
}

let sqlite: DatabaseSync;
let db: SqliteD1;

const requestFor = (path: string) => new Request(`https://test${path}`, {
  method: 'GET',
  headers: { Cookie: 'auth_token=test' },
});

const call = (path: string) => handleGamificationRoutes(
  requestFor(path),
  { DB: db, JWT_SECRET: 'test-secret' } as any,
  new URL(`https://test${path}`).pathname,
  'GET',
);

const addClass = (id: string, name: string, teacher = 'teacher-a', archivedAt = '') => {
  sqlite.prepare('INSERT INTO classes(id, name, teacher_username, archived_at) VALUES (?, ?, ?, ?)')
    .run(id, name, teacher, archivedAt);
};

const addStudent = (id: string, fullName: string, classId: string, coins = 0, archivedAt = '') => {
  sqlite.prepare(`
    INSERT INTO students(id, username, full_name, class_id, avatar, coins, archived_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, id, fullName, classId, `${id}.png`, coins, archivedAt);
};

const addLedger = (
  id: string,
  studentId: string,
  coinsDelta: number,
  sourceType: string,
  createdAt: string,
) => {
  sqlite.prepare(`
    INSERT INTO student_reward_ledger(
      id, student_id, source_type, source_key, reward_type,
      coins_delta, exp_delta, payload_json, created_at
    ) VALUES (?, ?, ?, ?, 'COINS', ?, 0, '{}', ?)
  `).run(id, studentId, sourceType, id, coinsDelta, createdAt);
};

const currentWeekTimestamp = () => new Date().toISOString();

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  db = new SqliteD1(sqlite);
  authMiddleware.mockReset();
  authMiddleware.mockResolvedValue({
    user: { id: 'student-current', username: 'student-current', role: 'student' },
  });
  sqlite.exec(`
    CREATE TABLE classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      teacher_username TEXT NOT NULL,
      archived_at TEXT DEFAULT ''
    );
    CREATE TABLE students (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      class_id TEXT NOT NULL,
      avatar TEXT DEFAULT '',
      coins INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT DEFAULT ''
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
      created_at TEXT NOT NULL
    );
  `);
  addClass('class-a', '3A', 'teacher-a');
  addStudent('student-current', 'Current Student', 'class-a', 0);
});

afterEach(() => sqlite.close());

describe('student gold leaderboard', () => {
  it('requires an authenticated student and never serves teachers', async () => {
    authMiddleware.mockResolvedValueOnce(new Response('unauthorized', { status: 401 }));
    const unauthorized = await call('/api/leaderboard/student');
    expect(unauthorized.status).toBe(401);

    authMiddleware.mockResolvedValueOnce({
      user: { id: 'teacher-a', username: 'teacher-a', role: 'teacher' },
    });
    const forbidden = await call('/api/leaderboard/student');
    expect(forbidden.status).toBe(403);
  });

  it('derives class scope from the authenticated student and excludes non-reward ledger entries', async () => {
    addStudent('classmate', 'Classmate', 'class-a');
    addClass('class-b', '3B', 'teacher-a');
    addStudent('other-class', 'Other Class', 'class-b');
    addClass('class-c', '4A', 'teacher-b');
    addStudent('other-school', 'Other School', 'class-c');

    addLedger('opening-current', 'student-current', 1000, 'BALANCE_OPENING', currentWeekTimestamp());
    addLedger('weekly-current', 'student-current', 500, 'WEEKLY_LEADERBOARD', currentWeekTimestamp());
    addLedger('reward-current', 'student-current', 50, 'QUIZ_RESULT', currentWeekTimestamp());
    addLedger('purchase-current', 'student-current', -10, 'GIFT_PURCHASE', currentWeekTimestamp());
    addLedger('reward-classmate', 'classmate', 40, 'DAILY_ATTENDANCE', currentWeekTimestamp());
    addLedger('reward-other-class', 'other-class', 70, 'QUIZ_RESULT', currentWeekTimestamp());
    addLedger('reward-other-school', 'other-school', 100, 'QUIZ_RESULT', currentWeekTimestamp());

    const response = await call('/api/leaderboard/student?scope=class&period=week&studentId=other-school');
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.status).toBe('success');
    expect(payload.data.scope).toBe('class');
    expect(payload.data.period).toBe('week');
    expect(payload.data.totalStudents).toBe(2);
    expect(payload.data.topStudents.map((student: any) => [student.studentId, student.xu, student.rank]))
      .toEqual([
        ['student-current', 50, 1],
        ['classmate', 40, 2],
      ]);
    expect(payload.data.currentStudent).toMatchObject({ studentId: 'student-current', xu: 50, gapToNext: null });
  });

  it('uses the current class teacher as the school scope boundary', async () => {
    addStudent('classmate', 'Classmate', 'class-a', 25);
    addClass('class-b', '3B', 'teacher-a');
    addStudent('other-class', 'Other Class', 'class-b', 90);
    addClass('class-c', '4A', 'teacher-b');
    addStudent('other-school', 'Other School', 'class-c', 100);

    const response = await call('/api/leaderboard/student?scope=school&period=all');
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.data.totalStudents).toBe(3);
    expect(payload.data.topStudents.map((student: any) => student.studentId))
      .toEqual(['other-class', 'classmate', 'student-current']);
    expect(payload.data.topStudents.every((student: any) => student.studentId !== 'other-school')).toBe(true);
  });

  it('uses all-time wallet coins with dense ranks and includes the current row after the top ten', async () => {
    addClass('class-b', '3B', 'teacher-a');
    addStudent('gold-1', 'Gold One', 'class-b', 100);
    addStudent('gold-2', 'Gold Two', 'class-b', 100);
    addStudent('gold-3', 'Gold Three', 'class-b', 80);
    for (let index = 4; index <= 11; index += 1) {
      addStudent(`gold-${index}`, `Gold ${index}`, 'class-b', 80 - index);
    }
    addStudent('gold-12', 'Gold Twelve', 'class-b', 1);

    const response = await call('/api/leaderboard/student?scope=school&period=all&studentId=gold-1');
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.data.totalStudents).toBe(13);
    expect(payload.data.topStudents).toHaveLength(10);
    expect(payload.data.topStudents.slice(0, 3).map((student: any) => student.rank)).toEqual([1, 1, 2]);
    expect(payload.data.currentStudent).toMatchObject({
      studentId: 'student-current',
      rank: 12,
      xu: 0,
      gapToNext: 1,
    });
  });

  it('returns an empty-safe response when the authenticated student is not in the database', async () => {
    authMiddleware.mockResolvedValueOnce({
      user: { id: 'missing', username: 'missing', role: 'student' },
    });
    const response = await call('/api/leaderboard/student?scope=class&period=week');
    expect(response.status).toBe(404);
  });

  it('returns an empty weekly board when the class has no qualifying reward ledger rows', async () => {
    const response = await call('/api/leaderboard/student?scope=class&period=week');
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.data.topStudents).toEqual([]);
    expect(payload.data.currentStudent).toBeNull();
    expect(payload.data.totalStudents).toBe(0);
  });
});

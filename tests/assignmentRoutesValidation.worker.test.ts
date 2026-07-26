import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../workers/src/classroom/authorization', () => ({
  requireTeacherForAssignment: vi.fn(async () => null),
  requireTeacherForClass: vi.fn(async () => null),
  requireTeacherForStudent: vi.fn(async () => null),
}));

import { handleAssignmentCreateRoute } from '../workers/src/routes/classroom/assignmentCreateRoute';
import { handleAssignmentDeadlineRoute } from '../workers/src/routes/classroom/assignmentDeadlineRoute';

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, readonly db: FakeDatabase) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  async first<T>() { this.db.executed.push(this); return this.db.first(this.sql, this.bindings) as T; }
  async run() { this.db.executed.push(this); return { success: true, meta: { changes: 1 } }; }
  async all<T>() {
    this.db.executed.push(this);
    return { success: true, results: this.db.all(this.sql) as T[] };
  }
}

class FakeDatabase {
  executed: Statement[] = [];
  quizExists = true;
  studentMatchesClass = true;
  duplicateAssignmentId = '';
  prepare(sql: string) { return new Statement(sql, this); }
  batch(statements: Statement[]) {
    return Promise.all(statements.map((statement) => statement.run()));
  }
  first(sql: string, _bindings: unknown[]) {
    if (sql.includes('FROM quizzes')) return this.quizExists ? { id: 'quiz-1', title: 'Ôn tập Toán 4' } : null;
    if (sql.includes('FROM students') && sql.includes('class_id')) return this.studentMatchesClass ? { id: 'student-1' } : null;
    if (sql.includes('FROM assignments') && sql.includes("status = 'OPEN'")) {
      return this.duplicateAssignmentId ? { id: this.duplicateAssignmentId } : null;
    }
    return null;
  }
  all(sql: string) {
    if (sql.includes('SELECT id FROM students')) {
      return [{ id: 'student-1' }, { id: 'student-2' }];
    }
    return [];
  }
}

const teacher = { id: 'teacher-1', username: 'teacher-1', role: 'teacher' } as any;
const makeContext = (db: FakeDatabase, body: Record<string, unknown>, path = '/api/assignments', method = 'POST') => ({
  request: new Request(`https://example.test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  env: { DB: db },
  path,
  method,
  db,
  url: new URL(`https://example.test${path}`),
  nowIso: '2026-07-23T00:00:00.000Z',
  user: teacher,
}) as any;

const validPayload = {
  quizId: 'quiz-1',
  classId: 'class-1',
  deadline: '2099-01-01T00:00:00.000Z',
  maxAttempts: 3,
};

describe('assignment route validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [{ ...validPayload, quizId: '' }, 'quizId'],
    [{ ...validPayload, deadline: 'not-a-date' }, 'deadline'],
    [{ ...validPayload, deadline: '2020-01-01T00:00:00.000Z' }, 'future'],
    [{ ...validPayload, maxAttempts: 11 }, 'maxAttempts'],
  ])('rejects invalid create payload %#', async (payload, messagePart) => {
    const db = new FakeDatabase();
    const response = await handleAssignmentCreateRoute(makeContext(db, payload));
    const body = await response?.json() as any;

    expect(response?.status).toBe(400);
    expect(body.message).toContain(messagePart);
    expect(db.executed.some(statement => statement.sql.includes('INSERT INTO assignments'))).toBe(false);
  });

  it('rejects a student that does not belong to the selected class', async () => {
    const db = new FakeDatabase();
    db.studentMatchesClass = false;
    const response = await handleAssignmentCreateRoute(makeContext(db, { ...validPayload, studentId: 'student-1' }));

    expect(response?.status).toBe(400);
  });

  it('rejects an overlapping open assignment for the same audience', async () => {
    const db = new FakeDatabase();
    db.duplicateAssignmentId = 'assignment-existing';
    const response = await handleAssignmentCreateRoute(makeContext(db, validPayload));
    const body = await response?.json() as any;

    expect(response?.status).toBe(409);
    expect(body.existingAssignmentId).toBe('assignment-existing');
  });

  it('fans out one deduplicated notification per active student after creating an assignment', async () => {
    const db = new FakeDatabase();
    const response = await handleAssignmentCreateRoute(makeContext(db, validPayload));
    const notifications = db.executed.filter((statement) => (
      statement.sql.includes('INSERT OR IGNORE INTO notifications')
    ));

    expect(response?.status).toBe(200);
    expect(notifications).toHaveLength(2);
    expect(notifications.map((statement) => statement.bindings[1])).toEqual([
      'student-1',
      'student-2',
    ]);
    expect(notifications.every((statement) => statement.bindings[3] === 'assignment_created')).toBe(true);
  });

  it.each(['not-a-date', '2020-01-01T00:00:00.000Z'])('rejects invalid or past deadline updates: %s', async newDeadline => {
    const db = new FakeDatabase();
    const path = '/api/assignments/assignment-1/deadline';
    const response = await handleAssignmentDeadlineRoute(makeContext(db, { newDeadline }, path, 'PUT'));

    expect(response?.status).toBe(400);
    expect(db.executed.some(statement => statement.sql.includes('UPDATE assignments'))).toBe(false);
  });
});

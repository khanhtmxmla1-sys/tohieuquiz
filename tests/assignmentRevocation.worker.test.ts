// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authorization = vi.hoisted(() => ({
  requireTeacherForAssignment: vi.fn(async () => null),
}));

vi.mock('../workers/src/classroom/authorization', () => ({
  requireTeacherForAssignment: authorization.requireTeacherForAssignment,
}));

import { handleAssignmentRevokeRoute } from '../workers/src/routes/classroom/assignmentRevokeRoute';

class SQLiteStatement {
  private bindings: unknown[] = [];
  constructor(private readonly statement: ReturnType<DatabaseSync['prepare']>) {}
  bind(...bindings: unknown[]) { this.bindings = bindings; return this; }
  async first<T>() { return (this.statement.get(...this.bindings as any[]) ?? null) as T | null; }
  async all<T>() { return { success: true, results: this.statement.all(...this.bindings as any[]) as T[] }; }
  async run() {
    const result = this.statement.run(...this.bindings as any[]);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

class SQLiteD1 {
  constructor(readonly sqlite: DatabaseSync) {}
  prepare(sql: string) { return new SQLiteStatement(this.sqlite.prepare(sql)); }
}

let sqlite: DatabaseSync | null = null;

const setup = (status = 'OPEN') => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE assignments (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      student_id TEXT DEFAULT '',
      deadline TEXT NOT NULL,
      max_attempts INTEGER DEFAULT 1,
      status TEXT DEFAULT 'OPEN',
      created_at TEXT NOT NULL,
      revoked_at TEXT,
      revoked_by TEXT,
      revoked_reason TEXT,
      previous_status TEXT,
      submission_count_at_revoke INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE results (
      id TEXT PRIMARY KEY,
      assignment_id TEXT,
      answers TEXT,
      student_id TEXT,
      student_name TEXT
    );
    INSERT INTO assignments (
      id, quiz_id, class_id, deadline, status, created_at
    ) VALUES (
      'assignment-1', 'quiz-1', 'class-1', '2099-01-01T00:00:00.000Z', '${status}', '2026-08-03T00:00:00.000Z'
    );
  `);
  return new SQLiteD1(sqlite) as unknown as D1Database;
};

const context = (db: D1Database, body: Record<string, unknown> = {
  reason: 'Phát hiện câu hỏi hoặc đáp án chưa chính xác',
}) => ({
  request: new Request('https://example.test/api/assignments/assignment-1/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  env: { DB: db },
  path: '/api/assignments/assignment-1/revoke',
  method: 'POST',
  db,
  url: new URL('https://example.test/api/assignments/assignment-1/revoke'),
  nowIso: '2026-08-03T16:00:00.000Z',
  user: { username: 'teacher-a', role: 'teacher' },
}) as any;

afterEach(() => {
  sqlite?.close();
  sqlite = null;
});

beforeEach(() => {
  vi.clearAllMocks();
  authorization.requireTeacherForAssignment.mockResolvedValue(null);
});

describe('assignment revoke route', () => {
  it('requires a meaningful reason without mutating the assignment', async () => {
    const db = setup();
    const response = await handleAssignmentRevokeRoute(context(db, { reason: 'sai' }));
    const payload = await response?.json() as any;

    expect(response?.status).toBe(400);
    expect(payload.code).toBe('ASSIGNMENT_REVOKE_REASON_INVALID');
    expect(sqlite!.prepare("SELECT status FROM assignments WHERE id='assignment-1'").get()).toEqual({ status: 'OPEN' });
  });

  it.each(['OPEN', 'CLOSED'])('revokes a %s assignment with no completed submissions', async status => {
    const db = setup(status);
    const response = await handleAssignmentRevokeRoute(context(db));
    const payload = await response?.json() as any;
    const saved = sqlite!.prepare("SELECT * FROM assignments WHERE id='assignment-1'").get() as any;

    expect(response?.status).toBe(200);
    expect(payload).toMatchObject({
      status: 'success',
      data: {
        assignmentId: 'assignment-1',
        status: 'REVOKED',
        previousStatus: status,
        revokedAt: '2026-08-03T16:00:00.000Z',
        revokedBy: 'teacher-a',
        submissionCountAtRevoke: 0,
        replayed: false,
      },
    });
    expect(saved).toMatchObject({
      status: 'REVOKED',
      previous_status: status,
      revoked_by: 'teacher-a',
      submission_count_at_revoke: 0,
    });
  });

  it('allows started placeholders but blocks any completed submission', async () => {
    const db = setup();
    sqlite!.exec(`
      INSERT INTO results VALUES ('started', 'assignment-1', '{"status":"STARTED"}', 'student-1', 'Lan');
      INSERT INTO results VALUES ('done', 'assignment-1', '{"q1":"A"}', 'student-1', 'Lan');
    `);

    const response = await handleAssignmentRevokeRoute(context(db));
    const payload = await response?.json() as any;

    expect(response?.status).toBe(409);
    expect(payload).toMatchObject({
      status: 'error',
      code: 'ASSIGNMENT_REVOKE_HAS_SUBMISSIONS',
      data: { submissionCount: 1 },
    });
    expect(sqlite!.prepare("SELECT status FROM assignments WHERE id='assignment-1'").get()).toEqual({ status: 'OPEN' });
  });

  it('is idempotent when the same assignment is revoked again', async () => {
    const db = setup();
    const first = await handleAssignmentRevokeRoute(context(db));
    expect(first?.status).toBe(200);

    const second = await handleAssignmentRevokeRoute(context(db, { reason: 'Lý do mới không được ghi đè lịch sử cũ' }));
    const payload = await second?.json() as any;

    expect(second?.status).toBe(200);
    expect(payload.data.replayed).toBe(true);
    expect(payload.data.revokedReason).toBe('Phát hiện câu hỏi hoặc đáp án chưa chính xác');
  });

  it('delegates assignment ownership authorization before changing state', async () => {
    const db = setup();
    authorization.requireTeacherForAssignment.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'error', message: 'Forbidden' }), { status: 403 }),
    );

    const response = await handleAssignmentRevokeRoute(context(db));

    expect(response?.status).toBe(403);
    expect(authorization.requireTeacherForAssignment).toHaveBeenCalledWith(db, expect.anything(), 'assignment-1');
    expect(sqlite!.prepare("SELECT status FROM assignments WHERE id='assignment-1'").get()).toEqual({ status: 'OPEN' });
  });
});

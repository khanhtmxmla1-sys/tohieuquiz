// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { loadTeacherActionCenter } from '../workers/src/services/actionCenterService';

interface FakeRows {
  assignments?: Record<string, unknown>;
  drafts?: Record<string, unknown>;
  giftOrders?: Record<string, unknown>;
  liveExams?: Record<string, unknown>;
}

class FakeStatement {
  private bindings: unknown[] = [];

  constructor(private readonly db: FakeDatabase, private readonly sql: string) {}

  bind(...bindings: unknown[]) {
    this.bindings = bindings;
    return this;
  }

  async first<T>() {
    this.db.calls.push({ sql: this.sql, bindings: this.bindings });
    if (this.sql.includes('action-center:assignments')) return this.db.rows.assignments as T;
    if (this.sql.includes('action-center:drafts')) return this.db.rows.drafts as T;
    if (this.sql.includes('action-center:gift-orders')) return this.db.rows.giftOrders as T;
    if (this.sql.includes('action-center:live-exams')) return this.db.rows.liveExams as T;
    throw new Error(`Unexpected query: ${this.sql}`);
  }
}

class FakeDatabase {
  readonly calls: Array<{ sql: string; bindings: unknown[] }> = [];

  constructor(readonly rows: FakeRows) {}

  prepare(sql: string) {
    return new FakeStatement(this, sql);
  }
}

class SQLiteD1Adapter {
  constructor(private readonly database: DatabaseSync) {}

  prepare(sql: string) {
    let bindings: unknown[] = [];
    return {
      bind: (...values: unknown[]) => {
        bindings = values;
        return {
          first: async <T>() => this.database.prepare(sql).get(...bindings) as T | null,
        };
      },
      first: async <T>() => this.database.prepare(sql).get(...bindings) as T | null,
    };
  }
}

const now = new Date('2026-07-28T08:00:00.000Z');

const populatedRows: FakeRows = {
  assignments: {
    action_count: 2,
    affected_count: 7,
    next_at: '2026-07-28T12:00:00.000Z',
  },
  drafts: {
    action_count: 3,
    next_id: 'draft-latest',
    next_at: '2026-07-27T07:00:00.000Z',
  },
  giftOrders: {
    action_count: 2,
    next_at: '2026-07-28T06:00:00.000Z',
  },
  liveExams: {
    action_count: 1,
    next_at: '2026-07-28T16:00:00.000Z',
  },
};

describe('loadTeacherActionCenter', () => {
  it('returns actionable items in priority order with exact internal CTAs', async () => {
    const db = new FakeDatabase(populatedRows);

    const center = await loadTeacherActionCenter(
      db as unknown as D1Database,
      { role: 'teacher', username: 'teacher-a' },
      now,
    );

    expect(center.generatedAt).toBe(now.toISOString());
    expect(center.items.map((item) => [item.kind, item.severity, item.count])).toEqual([
      ['assignment_at_risk', 'critical', 2],
      ['gift_order_pending', 'warning', 2],
      ['draft_unpublished', 'info', 3],
      ['live_exam_upcoming', 'info', 1],
    ]);
    expect(center.items[0].explanation).toContain('7 học sinh chưa nộp');
    expect(center.items.map((item) => item.cta.url)).toEqual([
      '/teacher/assignments?status=OPEN&due=48',
      '/teacher/gift-shop?status=VOUCHER_ISSUED',
      '/teacher/quizzes/manual/new?draftId=draft-latest',
      '/teacher/live-exams?status=scheduled&window=24',
    ]);
    expect(center.items).toHaveLength(4);
  });

  it('scopes every teacher query with the authenticated username', async () => {
    const db = new FakeDatabase(populatedRows);

    await loadTeacherActionCenter(
      db as unknown as D1Database,
      { role: 'teacher', username: 'teacher-a' },
      now,
    );

    expect(db.calls).toHaveLength(4);
    expect(db.calls.every((call) => call.bindings.includes('teacher-a'))).toBe(true);
    expect(db.calls.find((call) => call.sql.includes('action-center:assignments'))?.sql)
      .toContain('c.teacher_username = ?');
    expect(db.calls.find((call) => call.sql.includes('action-center:drafts'))?.sql)
      .toContain('owner_username = ?');
    expect(db.calls.find((call) => call.sql.includes('action-center:gift-orders'))?.sql)
      .toContain('c.teacher_username = ?');
    expect(db.calls.find((call) => call.sql.includes('action-center:live-exams'))?.sql)
      .toContain('teacher_id = ?');
  });

  it('allows an admin school-wide view without a forged teacher binding', async () => {
    const db = new FakeDatabase(populatedRows);

    await loadTeacherActionCenter(
      db as unknown as D1Database,
      { role: 'admin' },
      now,
    );

    expect(db.calls).toHaveLength(4);
    expect(db.calls.every((call) => !call.bindings.includes('teacher-a'))).toBe(true);
    expect(db.calls.every((call) => !call.sql.includes('c.teacher_username = ?'))).toBe(true);
    expect(db.calls.every((call) => !call.sql.includes('owner_username = ?'))).toBe(true);
    expect(db.calls.every((call) => !call.sql.includes('teacher_id = ?'))).toBe(true);
  });

  it('fails closed before querying when a teacher identity is missing', async () => {
    const db = new FakeDatabase(populatedRows);

    await expect(loadTeacherActionCenter(
      db as unknown as D1Database,
      { role: 'teacher' },
      now,
    )).rejects.toThrow('Teacher username is required');
    expect(db.calls).toHaveLength(0);
  });

  it('excludes another teacher\'s classes and records against a real SQLite database', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE classes (id TEXT PRIMARY KEY, teacher_username TEXT, archived_at TEXT);
      CREATE TABLE students (id TEXT PRIMARY KEY, class_id TEXT, archived_at TEXT);
      CREATE TABLE assignments (id TEXT PRIMARY KEY, class_id TEXT, student_id TEXT, deadline TEXT, status TEXT);
      CREATE TABLE results (assignment_id TEXT, student_id TEXT);
      CREATE TABLE quiz_drafts (id TEXT PRIMARY KEY, owner_username TEXT, updated_at TEXT, expires_at TEXT);
      CREATE TABLE gift_orders (id TEXT PRIMARY KEY, class_id TEXT, status TEXT, created_at TEXT);
      CREATE TABLE live_exam_sessions (id TEXT PRIMARY KEY, teacher_id TEXT, status TEXT, scheduled_at TEXT, archived_at TEXT);

      INSERT INTO classes VALUES ('class-a', 'teacher-a', NULL), ('class-b', 'teacher-b', NULL);
      INSERT INTO students VALUES ('student-a1', 'class-a', NULL), ('student-a2', 'class-a', NULL), ('student-b1', 'class-b', NULL);
      INSERT INTO assignments VALUES
        ('assignment-a', 'class-a', '', '2026-07-29T08:00:00.000Z', 'OPEN'),
        ('assignment-b', 'class-b', '', '2026-07-29T08:00:00.000Z', 'OPEN');
      INSERT INTO results VALUES ('assignment-a', 'student-a1');
      INSERT INTO quiz_drafts VALUES
        ('draft-a', 'teacher-a', '2026-07-28T07:00:00.000Z', NULL),
        ('draft-b', 'teacher-b', '2026-07-28T07:30:00.000Z', NULL);
      INSERT INTO gift_orders VALUES
        ('gift-a', 'class-a', 'VOUCHER_ISSUED', '2026-07-28T06:00:00.000Z'),
        ('gift-b', 'class-b', 'VOUCHER_ISSUED', '2026-07-28T06:30:00.000Z');
      INSERT INTO live_exam_sessions VALUES
        ('live-a', 'teacher-a', 'scheduled', '2026-07-28T16:00:00.000Z', NULL),
        ('live-b', 'teacher-b', 'scheduled', '2026-07-28T17:00:00.000Z', NULL);
    `);

    const center = await loadTeacherActionCenter(
      new SQLiteD1Adapter(sqlite) as unknown as D1Database,
      { role: 'teacher', username: 'teacher-a' },
      now,
    );

    expect(center.items.map((item) => [item.kind, item.count])).toEqual([
      ['assignment_at_risk', 1],
      ['gift_order_pending', 1],
      ['draft_unpublished', 1],
      ['live_exam_upcoming', 1],
    ]);
    expect(center.items.find((item) => item.kind === 'assignment_at_risk')?.explanation)
      .toContain('1 học sinh chưa nộp');
    expect(center.items.find((item) => item.kind === 'draft_unpublished')?.cta.url)
      .toBe('/teacher/quizzes/manual/new?draftId=draft-a');

    sqlite.close();
  });

  it('omits zero-count categories instead of showing non-actionable cards', async () => {
    const db = new FakeDatabase({
      assignments: { action_count: 0, affected_count: 0 },
      drafts: { action_count: 0 },
      giftOrders: { action_count: 0 },
      liveExams: { action_count: 0 },
    });

    const center = await loadTeacherActionCenter(
      db as unknown as D1Database,
      { role: 'teacher', username: 'teacher-a' },
      now,
    );

    expect(center.items).toEqual([]);
  });
});

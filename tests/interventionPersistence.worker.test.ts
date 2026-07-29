// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import {
  addInterventionNote,
  createInterventionAssignments,
} from '../workers/src/services/interventionService';

class SQLiteStatement {
  private bindings: unknown[] = [];

  constructor(
    private readonly database: DatabaseSync,
    private readonly sql: string,
  ) {}

  bind(...bindings: unknown[]) {
    this.bindings = bindings;
    return this;
  }

  async first<T>() {
    return this.database.prepare(this.sql).get(...this.bindings as any[]) as T | null;
  }

  async all<T>() {
    return { results: this.database.prepare(this.sql).all(...this.bindings as any[]) as T[] };
  }

  async run() {
    const result = this.database.prepare(this.sql).run(...this.bindings as any[]);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

class SQLiteD1Adapter {
  constructor(private readonly database: DatabaseSync) {}

  prepare(sql: string) {
    return new SQLiteStatement(this.database, sql);
  }

  async batch(statements: SQLiteStatement[]) {
    return Promise.all(statements.map((statement) => statement.run()));
  }
}

const setup = () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE teachers (username TEXT PRIMARY KEY);
    CREATE TABLE classes (id TEXT PRIMARY KEY, name TEXT NOT NULL, teacher_username TEXT, archived_at TEXT);
    CREATE TABLE students (id TEXT PRIMARY KEY, full_name TEXT NOT NULL, class_id TEXT, archived_at TEXT);
    CREATE TABLE quizzes (id TEXT PRIMARY KEY, title TEXT NOT NULL);
    CREATE TABLE assignments (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      student_id TEXT DEFAULT '',
      deadline TEXT NOT NULL,
      max_attempts INTEGER DEFAULT 1,
      status TEXT DEFAULT 'OPEN',
      created_at TEXT NOT NULL
    );
    CREATE TABLE notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_role TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      data TEXT NOT NULL DEFAULT '{}',
      priority TEXT NOT NULL DEFAULT 'INFO',
      severity TEXT NOT NULL DEFAULT 'informational',
      source_type TEXT,
      source_id TEXT,
      dedupe_key TEXT,
      action_url TEXT,
      available_at TEXT,
      expires_at TEXT,
      read_at TEXT,
      clicked_at TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, user_role, dedupe_key)
    );
  `);
  sqlite.exec(readFileSync('workers/migrations/0047_results_intervention_center.sql', 'utf8'));
  sqlite.exec(`
    INSERT INTO teachers(username) VALUES ('teacher-a'), ('teacher-b');
    INSERT INTO classes(id, name, teacher_username, archived_at) VALUES ('class-1', '4A', 'teacher-a', NULL);
    INSERT INTO students(id, full_name, class_id, archived_at) VALUES
      ('student-1', 'Lan', 'class-1', NULL),
      ('student-2', 'Minh', 'class-1', NULL);
    INSERT INTO quizzes(id, title) VALUES ('quiz-1', 'Luyện tập phân số');
    INSERT INTO intervention_groups(
      id, teacher_username, name, status, class_id, subject, subject_label,
      skill_code, skill_label, sample_size, confidence, source_filter_json,
      created_at, updated_at
    ) VALUES
      (
        'group-1', 'teacher-a', 'Cần hỗ trợ ở Phân số', 'ACTIVE', 'class-1',
        'math', 'Toán', 'phan_so', 'Phân số', 6, 0.6, '{}',
        '2026-07-29T08:00:00.000Z', '2026-07-29T08:00:00.000Z'
      ),
      (
        'group-2', 'teacher-a', 'Cần hỗ trợ ở Hình học', 'ACTIVE', 'class-1',
        'math', 'Toán', 'hinh_hoc', 'Hình học', 4, 0.7, '{}',
        '2026-07-29T08:00:00.000Z', '2026-07-29T08:00:00.000Z'
      );
    INSERT INTO intervention_group_members(
      group_id, student_id, latest_result_id, latest_submitted_at,
      first_attempt_score, latest_attempt_score, score_delta, attempt_count,
      skill_accuracy, skill_sample_size, confidence, trend_json, added_at
    ) VALUES
      ('group-1', 'student-1', 'r1', '2026-07-28T08:00:00.000Z', 4, 6, 2, 3, 33, 3, 0.6, '[]', '2026-07-29T08:00:00.000Z'),
      ('group-1', 'student-2', 'r2', '2026-07-28T08:00:00.000Z', 3, 4, 1, 3, 0, 3, 0.6, '[]', '2026-07-29T08:00:00.000Z');
  `);
  return { sqlite, db: new SQLiteD1Adapter(sqlite) as unknown as D1Database };
};

const teacher = (username: string) => ({ username, role: 'teacher' as const });

describe('Results Intervention persistence', () => {
  it('keeps private notes scoped to the group owner', async () => {
    const { sqlite, db } = setup();
    const note = await addInterventionNote(
      db,
      teacher('teacher-a') as any,
      'group-1',
      { note: 'Trao đổi riêng với phụ huynh vào cuối tuần.' },
      'request-note',
      '2026-07-29T09:00:00.000Z',
    );

    expect(note.note).toContain('phụ huynh');
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM intervention_notes').get()).toEqual({ count: 1 });
    expect(sqlite.prepare("SELECT action FROM intervention_audit WHERE action = 'NOTE_CREATED'").get())
      .toEqual({ action: 'NOTE_CREATED' });

    await expect(addInterventionNote(
      db,
      teacher('teacher-b') as any,
      'group-1',
      { note: 'Không được phép xem hoặc ghi.' },
      'request-other',
      '2026-07-29T09:01:00.000Z',
    )).rejects.toThrow('not found');
  });

  it('creates one personal assignment per member and replays the same idempotency key safely', async () => {
    const { sqlite, db } = setup();
    const payload = {
      quizId: 'quiz-1',
      deadline: '2026-08-05T16:59:00.000Z',
      maxAttempts: 2,
      idempotencyKey: 'group-1-quiz-1-2026-08-05',
    };

    const first = await createInterventionAssignments(
      db,
      teacher('teacher-a') as any,
      'group-1',
      payload,
      'request-assign-1',
      '2026-07-29T09:00:00.000Z',
    );
    const replay = await createInterventionAssignments(
      db,
      teacher('teacher-a') as any,
      'group-1',
      payload,
      'request-assign-2',
      '2026-07-29T09:01:00.000Z',
    );

    expect(first).toEqual(expect.objectContaining({ replayed: false }));
    expect(first.assignmentIds).toHaveLength(2);
    expect(replay).toEqual({ ...first, replayed: true });
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM assignments').get()).toEqual({ count: 2 });
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM intervention_assignment_batches').get()).toEqual({ count: 1 });
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM notifications').get()).toEqual({ count: 2 });
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM intervention_audit WHERE action = 'ASSIGNMENT_BATCH_CREATED'").get())
      .toEqual({ count: 1 });

    await expect(createInterventionAssignments(
      db,
      teacher('teacher-a') as any,
      'group-2',
      payload,
      'request-wrong-group',
      '2026-07-29T09:02:00.000Z',
    )).rejects.toThrow('another intervention group');
  });

  it('reuses an open class-wide assignment instead of creating duplicate personal assignments', async () => {
    const { sqlite, db } = setup();
    sqlite.prepare(`
      INSERT INTO assignments(
        id, quiz_id, class_id, student_id, deadline, max_attempts,
        intervention_group_id, status, created_at
      ) VALUES (?, ?, ?, '', ?, 1, NULL, 'OPEN', ?)
    `).run(
      'assignment-class-wide',
      'quiz-1',
      'class-1',
      '2026-08-06T16:59:00.000Z',
      '2026-07-29T08:30:00.000Z',
    );

    const result = await createInterventionAssignments(
      db,
      teacher('teacher-a') as any,
      'group-1',
      {
        quizId: 'quiz-1',
        deadline: '2026-08-05T16:59:00.000Z',
        maxAttempts: 1,
        idempotencyKey: 'group-1-class-wide-reuse',
      },
      'request-class-wide',
      '2026-07-29T09:00:00.000Z',
    );

    expect(result.assignmentIds).toEqual([]);
    expect(result.skippedAssignmentIds).toEqual(['assignment-class-wide']);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM assignments').get()).toEqual({ count: 1 });
  });
});

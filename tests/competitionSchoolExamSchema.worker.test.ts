// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const liveExamMigration = readFileSync(
  new URL('../workers/migrations/0016_add_live_exam_tables.sql', import.meta.url),
  'utf8',
);
const competitionCoreMigration = readFileSync(
  new URL('../workers/migrations/0069_competition_core.sql', import.meta.url),
  'utf8',
);
const schoolExamMigrationUrl = new URL(
  '../workers/migrations/0070_competition_school_exam.sql',
  import.meta.url,
);
const schoolExamRollbackUrl = new URL(
  '../workers/migrations/rollback/0070_competition_school_exam.rollback.sql',
  import.meta.url,
);

let db: DatabaseSync | null = null;

afterEach(() => {
  db?.close();
  db = null;
});

function createBaseSchema(database: DatabaseSync): void {
  database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE teachers (
      username TEXT PRIMARY KEY
    );

    CREATE TABLE classes (
      id TEXT PRIMARY KEY,
      teacher_username TEXT
    );

    CREATE TABLE students (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL
    );

    CREATE TABLE quizzes (
      id TEXT PRIMARY KEY
    );

    CREATE TABLE results (
      id INTEGER PRIMARY KEY AUTOINCREMENT
    );

    INSERT INTO teachers (username) VALUES ('admin');
    INSERT INTO classes (id, teacher_username) VALUES ('class-4a', 'admin');
    INSERT INTO students (id, class_id) VALUES ('student-1', 'class-4a');
    INSERT INTO quizzes (id) VALUES ('quiz-1');
  `);
}

function schoolExamMigration(): string {
  expect(existsSync(schoolExamMigrationUrl)).toBe(true);
  if (!existsSync(schoolExamMigrationUrl)) return '';
  return readFileSync(schoolExamMigrationUrl, 'utf8');
}

function schoolExamRollback(): string {
  expect(existsSync(schoolExamRollbackUrl)).toBe(true);
  if (!existsSync(schoolExamRollbackUrl)) return '';
  return readFileSync(schoolExamRollbackUrl, 'utf8');
}

function insertCampaignAndEligibility(database: DatabaseSync): void {
  database.prepare(`
    INSERT INTO competition_campaigns (
      id, title, school_year, timezone, status, audience_rule_json,
      eligibility_policy_json, starts_at, ends_at, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'campaign-1',
    'Competition 2026-2027',
    '2026-2027',
    'Asia/Ho_Chi_Minh',
    'ELIGIBILITY_LOCKED',
    '{"gradeLevels":[4]}',
    '{"requiredRounds":6,"requiredPassedRounds":6}',
    '2026-09-01T00:00:00.000Z',
    '2027-05-31T23:59:59.000Z',
    'admin',
    '2026-08-20T07:00:00.000Z',
    '2026-08-20T07:00:00.000Z',
  );

  database.prepare(`
    INSERT INTO competition_eligibility (
      id, campaign_id, eligibility_snapshot_version, student_id, qualified,
      reason_codes_json, qualified_at, computed_at, progress_digest
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'eligibility-1',
    'campaign-1',
    1,
    'student-1',
    1,
    '["QUALIFIED"]',
    '2026-08-20T08:00:00.000Z',
    '2026-08-20T08:00:00.000Z',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  );
}

describe('Competition school exam migration 0070', () => {
  it('extends legacy class Live Exam sessions additively with CLASS + PUBLISHED scope defaults', () => {
    db = new DatabaseSync(':memory:');
    createBaseSchema(db);
    db.exec(liveExamMigration);

    db.prepare(`
      INSERT INTO live_exam_sessions (
        id, title, quiz_id, teacher_id, class_id, duration, settings, status,
        access_code, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'live-class-1', 'Class exam', 'quiz-1', 'admin', 'class-4a', 30, '{}',
      'scheduled', 'CLS001', '2026-08-20T08:00:00.000Z', '2026-08-20T08:00:00.000Z',
    );

    db.exec(schoolExamMigration());

    const row = db.prepare(`
      SELECT participant_scope_type, participant_scope_id, result_visibility
      FROM live_exam_sessions
      WHERE id = 'live-class-1'
    `).get();

    expect(row).toEqual({
      participant_scope_type: 'CLASS',
      participant_scope_id: 'class-4a',
      result_visibility: 'PUBLISHED',
    });

    db.prepare(`
      INSERT INTO live_exam_sessions (
        id, title, quiz_id, teacher_id, class_id, duration, settings, status,
        access_code, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'live-class-2', 'Class exam 2', 'quiz-1', 'admin', 'class-4a', 30, '{}',
      'scheduled', 'CLS002', '2026-08-20T08:05:00.000Z', '2026-08-20T08:05:00.000Z',
    );

    expect(db.prepare(`
      SELECT participant_scope_type, participant_scope_id, result_visibility
      FROM live_exam_sessions
      WHERE id = 'live-class-2'
    `).get()).toEqual({
      participant_scope_type: 'CLASS',
      participant_scope_id: 'class-4a',
      result_visibility: 'PUBLISHED',
    });
  });

  it('creates the school-exam persistence graph and pins events to an existing immutable eligibility version', () => {
    db = new DatabaseSync(':memory:');
    createBaseSchema(db);
    db.exec(liveExamMigration);
    db.exec(competitionCoreMigration);
    insertCampaignAndEligibility(db);
    db.exec(schoolExamMigration());

    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name LIKE 'competition_school_exam_%'
      ORDER BY name
    `).all() as Array<{ name: string }>;

    expect(tables.map(({ name }) => name)).toEqual(expect.arrayContaining([
      'competition_school_exam_events',
      'competition_school_exam_rooms',
      'competition_school_exam_members',
      'competition_school_exam_results',
      'competition_school_exam_incidents',
      'competition_school_exam_retests',
      'competition_school_exam_reconcile_runs',
      'competition_school_exam_publications',
      'competition_school_exam_exports',
      'competition_school_exam_certificate_batches',
      'competition_school_exam_audit',
    ]));

    expect(() => db!.prepare(`
      INSERT INTO competition_school_exam_events (
        id, campaign_id, eligibility_snapshot_version, title, exam_date, status,
        ranking_policy, exam_form_policy, created_by, created_at, updated_at
      ) VALUES ('event-bad', 'campaign-1', 2, 'School exam',
        '2027-05-10T01:00:00.000Z', 'DRAFT', 'SCORE_CORRECT_TIME', 'SAME_FORM',
        'admin', '2026-08-20T08:00:00.000Z', '2026-08-20T08:00:00.000Z')
    `).run()).toThrow(/ELIGIBILITY_SNAPSHOT_VERSION_NOT_FOUND/);

    expect(() => db!.prepare(`
      INSERT INTO competition_school_exam_events (
        id, campaign_id, eligibility_snapshot_version, title, exam_date, status,
        ranking_policy, exam_form_policy, created_by, created_at, updated_at
      ) VALUES ('event-1', 'campaign-1', 1, 'School exam',
        '2027-05-10T01:00:00.000Z', 'DRAFT', 'SCORE_CORRECT_TIME', 'SAME_FORM',
        'admin', '2026-08-20T08:00:00.000Z', '2026-08-20T08:00:00.000Z')
    `).run()).not.toThrow();

    expect(() => db!.prepare(`
      UPDATE competition_school_exam_events
      SET eligibility_snapshot_version = 2
      WHERE id = 'event-1'
    `).run()).toThrow(/ELIGIBILITY_REFERENCE_IMMUTABLE/);
  });

  it('preserves original class identity for a multi-class school-exam room without creating a synthetic class', () => {
    db = new DatabaseSync(':memory:');
    createBaseSchema(db);
    db.exec(`
      INSERT INTO classes (id, teacher_username) VALUES
        ('class-4b', 'admin'),
        ('class-4c', 'admin');
      INSERT INTO students (id, class_id) VALUES
        ('student-2', 'class-4b'),
        ('student-3', 'class-4c');
    `);
    db.exec(liveExamMigration);
    db.exec(competitionCoreMigration);
    insertCampaignAndEligibility(db);
    db.exec(schoolExamMigration());

    db.prepare(`
      INSERT INTO competition_school_exam_events (
        id, campaign_id, eligibility_snapshot_version, title, exam_date, status,
        ranking_policy, exam_form_policy, created_by, created_at, updated_at
      ) VALUES ('event-multi', 'campaign-1', 1, 'School exam',
        '2027-05-10T01:00:00.000Z', 'DRAFT', 'SCORE_CORRECT_TIME', 'SAME_FORM',
        'admin', '2026-08-20T08:00:00.000Z', '2026-08-20T08:00:00.000Z')
    `).run();
    db.prepare(`
      INSERT INTO competition_school_exam_rooms (
        id, event_id, name, room_code, scheduled_at, duration_minutes,
        check_in_lead_minutes, close_drain_minutes, form_code, quiz_id,
        status, created_at, updated_at
      ) VALUES ('room-multi', 'event-multi', 'Room Multi', 'RM01',
        '2027-05-10T01:00:00.000Z', 45, 15, 10, 'A', 'quiz-1', 'DRAFT',
        '2026-08-20T08:00:00.000Z', '2026-08-20T08:00:00.000Z')
    `).run();

    const classCountBefore = db.prepare('SELECT COUNT(*) AS count FROM classes').get() as { count: number };
    for (const [id, studentId, originalClassId] of [
      ['member-1', 'student-1', 'class-4a'],
      ['member-2', 'student-2', 'class-4b'],
      ['member-3', 'student-3', 'class-4c'],
    ] as const) {
      db.prepare(`
        INSERT INTO competition_school_exam_members (
          id, event_id, room_id, student_id, original_class_id,
          eligibility_snapshot_version, status, assigned_at, updated_at
        ) VALUES (?, 'event-multi', 'room-multi', ?, ?, 1, 'ASSIGNED',
          '2026-08-20T08:00:00.000Z', '2026-08-20T08:00:00.000Z')
      `).run(id, studentId, originalClassId);
    }

    expect(db.prepare(`
      SELECT student_id, original_class_id
      FROM competition_school_exam_members
      WHERE room_id = 'room-multi'
      ORDER BY student_id
    `).all()).toEqual([
      { student_id: 'student-1', original_class_id: 'class-4a' },
      { student_id: 'student-2', original_class_id: 'class-4b' },
      { student_id: 'student-3', original_class_id: 'class-4c' },
    ]);

    const resultColumns = db.prepare(`PRAGMA table_info('competition_school_exam_results')`).all() as Array<{ name: string }>;
    expect(resultColumns.map(({ name }) => name)).toContain('original_class_id');
    expect(db.prepare('SELECT COUNT(*) AS count FROM classes').get()).toEqual(classCountBefore);
  });

  it('rolls back school-exam tables safely while retaining additive Live Exam columns', () => {
    db = new DatabaseSync(':memory:');
    createBaseSchema(db);
    db.exec(liveExamMigration);
    db.exec(competitionCoreMigration);
    insertCampaignAndEligibility(db);
    db.exec(schoolExamMigration());
    db.exec(schoolExamRollback());

    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name LIKE 'competition_school_exam_%'
    `).all();
    expect(tables).toEqual([]);

    const liveExamColumns = db.prepare(`PRAGMA table_info('live_exam_sessions')`).all() as Array<{ name: string }>;
    expect(liveExamColumns.map(({ name }) => name)).toEqual(expect.arrayContaining([
      'participant_scope_type',
      'participant_scope_id',
      'result_visibility',
    ]));
  });

  it('enforces SCHOOL_EXAM_ROOM + WITHHELD for internal competition Live Exam sessions', () => {
    db = new DatabaseSync(':memory:');
    createBaseSchema(db);
    db.exec(liveExamMigration);
    db.exec(competitionCoreMigration);
    insertCampaignAndEligibility(db);
    db.exec(schoolExamMigration());

    db.prepare(`
      INSERT INTO competition_school_exam_events (
        id, campaign_id, eligibility_snapshot_version, title, exam_date, status,
        ranking_policy, exam_form_policy, created_by, created_at, updated_at
      ) VALUES ('event-1', 'campaign-1', 1, 'School exam',
        '2027-05-10T01:00:00.000Z', 'DRAFT', 'SCORE_CORRECT_TIME', 'SAME_FORM',
        'admin', '2026-08-20T08:00:00.000Z', '2026-08-20T08:00:00.000Z')
    `).run();

    db.prepare(`
      INSERT INTO competition_school_exam_rooms (
        id, event_id, name, room_code, scheduled_at, duration_minutes,
        check_in_lead_minutes, close_drain_minutes, form_code, quiz_id,
        status, created_at, updated_at
      ) VALUES ('room-1', 'event-1', 'Room 1', 'R01', '2027-05-10T01:00:00.000Z',
        45, 15, 10, 'A', 'quiz-1', 'DRAFT',
        '2026-08-20T08:00:00.000Z', '2026-08-20T08:00:00.000Z')
    `).run();

    expect(() => db!.prepare(`
      INSERT INTO live_exam_sessions (
        id, title, quiz_id, teacher_id, class_id, duration, settings, status,
        access_code, created_at, updated_at, participant_scope_type,
        participant_scope_id, result_visibility
      ) VALUES ('live-school-bad', 'School room', 'quiz-1', 'admin', NULL, 45, '{}',
        'scheduled', 'SCH001', '2026-08-20T08:00:00.000Z', '2026-08-20T08:00:00.000Z',
        'SCHOOL_EXAM_ROOM', 'room-1', 'PUBLISHED')
    `).run()).toThrow(/SCHOOL_EXAM_RESULTS_MUST_BE_WITHHELD/);

    expect(() => db!.prepare(`
      INSERT INTO live_exam_sessions (
        id, title, quiz_id, teacher_id, class_id, duration, settings, status,
        access_code, created_at, updated_at, participant_scope_type,
        participant_scope_id, result_visibility
      ) VALUES ('live-school-fake-class', 'School room', 'quiz-1', 'admin', 'class-4a', 45, '{}',
        'scheduled', 'SCH002', '2026-08-20T08:00:00.000Z', '2026-08-20T08:00:00.000Z',
        'SCHOOL_EXAM_ROOM', 'room-1', 'WITHHELD')
    `).run()).toThrow(/SCHOOL_EXAM_CLASS_SCOPE_FORBIDDEN/);

    expect(() => db!.prepare(`
      INSERT INTO live_exam_sessions (
        id, title, quiz_id, teacher_id, class_id, duration, settings, status,
        access_code, created_at, updated_at, participant_scope_type,
        participant_scope_id, result_visibility
      ) VALUES ('live-school-1', 'School room', 'quiz-1', 'admin', NULL, 45, '{}',
        'scheduled', 'SCH003', '2026-08-20T08:00:00.000Z', '2026-08-20T08:00:00.000Z',
        'SCHOOL_EXAM_ROOM', 'room-1', 'WITHHELD')
    `).run()).not.toThrow();
  });
});

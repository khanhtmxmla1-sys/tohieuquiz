// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleStudentCompetitionPortalRoutes } from '../workers/src/routes/competitions/studentPortalRoutes';
import * as LiveExamService from '../workers/src/services/liveExamService';
import { createSqliteD1 } from './helpers/sqliteD1';

const liveExamMigration = readFileSync(
  new URL('../workers/migrations/0016_add_live_exam_tables.sql', import.meta.url),
  'utf8',
);
const liveExamHardeningMigration = readFileSync(
  new URL('../workers/migrations/0026_live_exam_hardening.sql', import.meta.url),
  'utf8',
);
const competitionCoreMigration = readFileSync(
  new URL('../workers/migrations/0069_competition_core.sql', import.meta.url),
  'utf8',
);
const schoolExamMigration = readFileSync(
  new URL('../workers/migrations/0070_competition_school_exam.sql', import.meta.url),
  'utf8',
);
const orchestrationMigration = readFileSync(
  new URL('../workers/migrations/0072_competition_school_exam_orchestration.sql', import.meta.url),
  'utf8',
);
const schoolExamRetestMigration = readFileSync(
  new URL('../workers/migrations/0074_competition_school_exam_incident_retest.sql', import.meta.url),
  'utf8',
);

let sqlite: DatabaseSync;
let d1: D1Database;

function createBaseSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE teachers (username TEXT PRIMARY KEY);
    CREATE TABLE classes (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, teacher_username TEXT NOT NULL,
      created_at TEXT NOT NULL, archived_at TEXT
    );
    CREATE TABLE students (
      id TEXT PRIMARY KEY, full_name TEXT NOT NULL, username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, class_id TEXT NOT NULL, created_at TEXT NOT NULL, archived_at TEXT
    );
    CREATE TABLE quizzes (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, class_level TEXT, category TEXT,
      time_limit INTEGER, created_at TEXT NOT NULL, created_by TEXT NOT NULL,
      tags TEXT, source_type TEXT, parent_quiz_id TEXT, version_number INTEGER,
      revision INTEGER, updated_at TEXT
    );
    CREATE TABLE questions (
      id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL, type TEXT NOT NULL, question TEXT NOT NULL,
      options TEXT, correct_answer TEXT, items TEXT, text_field TEXT, blanks TEXT,
      distractors TEXT, sentence TEXT, words TEXT, correct_word_indexes TEXT,
      image TEXT, svg_content TEXT, svg_alt TEXT, difficulty TEXT, answer_schema_version INTEGER
    );
    CREATE TABLE results (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE admin_audit_logs (
      id TEXT PRIMARY KEY, actor_username TEXT NOT NULL, action TEXT NOT NULL,
      target_type TEXT NOT NULL, target_id TEXT NOT NULL, request_id TEXT NOT NULL,
      before_json TEXT, after_json TEXT, created_at TEXT NOT NULL
    );

    CREATE TABLE feature_flags (
      flag_key TEXT PRIMARY KEY, description TEXT NOT NULL, enabled INTEGER NOT NULL,
      owner TEXT NOT NULL, version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE feature_flag_rules (
      flag_key TEXT PRIMARY KEY, audience TEXT NOT NULL, percentage INTEGER NOT NULL,
      allow_users_json TEXT NOT NULL, allow_classes_json TEXT NOT NULL,
      starts_at TEXT, ends_at TEXT, stop_conditions_json TEXT NOT NULL,
      reason TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    INSERT INTO feature_flags VALUES
      ('competition_student_portal_v1', 'student portal', 1, 'competition', 1,
       '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z');
    INSERT INTO feature_flag_rules VALUES
      ('competition_student_portal_v1', 'all', 100, '[]', '[]', NULL, NULL, '{}',
       'test fixture', 'test', '2026-08-25T00:00:00.000Z');
    INSERT INTO teachers (username) VALUES ('admin');
    INSERT INTO classes (id, name, teacher_username, created_at) VALUES
      ('class-4a', '4A', 'admin', '2026-08-01T00:00:00.000Z'),
      ('class-4b', '4B', 'admin', '2026-08-01T00:00:00.000Z');
    INSERT INTO students (id, full_name, username, password_hash, class_id, created_at) VALUES
      ('student-1', 'Student One', 'student1', 'hash', 'class-4a', '2026-08-01T00:00:00.000Z'),
      ('student-2', 'Student Two', 'student2', 'hash', 'class-4b', '2026-08-01T00:00:00.000Z');
    INSERT INTO quizzes (
      id, title, class_level, category, time_limit, created_at, created_by,
      tags, source_type, version_number, revision, updated_at
    ) VALUES (
      'quiz-4', 'School Exam Quiz', '4', 'Math', 45, '2026-08-01T00:00:00.000Z',
      'admin', '[]', 'manual', 1, 1, '2026-08-01T00:00:00.000Z'
    );
  `);
}

function seedReadySchoolExam(): void {
  sqlite.exec(liveExamMigration);
  sqlite.exec(liveExamHardeningMigration);
  sqlite.exec(competitionCoreMigration);
  sqlite.exec(schoolExamMigration);
  sqlite.exec(orchestrationMigration);
  sqlite.exec(schoolExamRetestMigration);

  sqlite.exec(`
    INSERT INTO competition_campaigns (
      id, title, school_year, timezone, status, audience_rule_json,
      audience_snapshot_id, eligibility_policy_json, starts_at, ends_at,
      created_by, created_at, updated_at
    ) VALUES (
      'campaign-1', 'Competition One', '2026-2027', 'Asia/Ho_Chi_Minh', 'EXAM_RUNNING', '{}',
      'audience-1', '{"requiredRounds":6,"requiredPassedRounds":6}',
      '2026-09-01T00:00:00.000Z', '2027-05-31T23:59:59.000Z',
      'admin', '2026-08-20T00:00:00.000Z', '2026-08-20T00:00:00.000Z'
    );
    INSERT INTO competition_audience_snapshots (
      id, campaign_id, version, status, member_count, snapshot_hash, created_at, locked_at, created_by
    ) VALUES (
      'audience-1', 'campaign-1', 1, 'BUILDING', 0, '',
      '2026-08-20T00:00:00.000Z', NULL, 'admin'
    );
    INSERT INTO competition_audience_members (
      audience_snapshot_id, student_id, grade_level_at_snapshot,
      class_id_at_snapshot, student_status_at_snapshot
    ) VALUES
      ('audience-1', 'student-1', 4, 'class-4a', 'ACTIVE'),
      ('audience-1', 'student-2', 4, 'class-4b', 'ACTIVE');
    UPDATE competition_audience_snapshots
    SET status = 'LOCKED', member_count = 2, snapshot_hash = '${'a'.repeat(64)}',
        locked_at = '2026-08-20T00:00:00.000Z'
    WHERE id = 'audience-1';

    INSERT INTO competition_eligibility (
      id, campaign_id, eligibility_snapshot_version, student_id, qualified,
      reason_codes_json, qualified_at, computed_at, progress_digest
    ) VALUES
      ('eligibility-1', 'campaign-1', 3, 'student-1', 1, '[]',
       '2027-05-10T00:00:00.000Z', '2027-05-10T00:00:00.000Z', 'digest-1'),
      ('eligibility-2', 'campaign-1', 3, 'student-2', 0, '["NOT_QUALIFIED"]',
       NULL, '2027-05-10T00:00:00.000Z', 'digest-2');

    INSERT INTO competition_school_exam_events (
      id, campaign_id, eligibility_snapshot_version, title, exam_date, status,
      ranking_policy, exam_form_policy, capacity_profile_id,
      created_by, created_at, updated_at, preflight_json, preflight_at
    ) VALUES (
      'event-1', 'campaign-1', 3, 'School Exam', '2027-05-20T08:00:00.000Z', 'READY',
      'SCORE_CORRECT_TIME', 'SAME_FORM', 'capacity-1',
      'admin', '2027-05-10T00:00:00.000Z', '2027-05-10T00:00:00.000Z',
      '{"status":"READY","reason":null,"plannedConcurrency":2,"certifiedConcurrentStudents":100,"capacityProfileId":"capacity-1"}',
      '2027-05-10T00:00:00.000Z'
    );

    INSERT INTO competition_school_exam_rooms (
      id, event_id, name, room_code, scheduled_at, duration_minutes,
      check_in_lead_minutes, close_drain_minutes, form_code, quiz_id,
      live_exam_session_id, invigilator_ids_json, member_count,
      form_definition_json, provision_status, status, created_at, updated_at
    ) VALUES (
      'room-1', 'event-1', 'Room A', 'ROOMA', '2027-05-20T08:00:00.000Z', 45,
      15, 5, 'FORM-A', 'quiz-4', NULL, '[]', 1, '{}', 'PENDING', 'DRAFT',
      '2027-05-10T00:00:00.000Z', '2027-05-10T00:00:00.000Z'
    );

    INSERT INTO competition_school_exam_members (
      id, event_id, room_id, student_id, original_class_id,
      eligibility_snapshot_version, status, assigned_at, updated_at
    ) VALUES (
      'member-1', 'event-1', 'room-1', 'student-1', 'class-4a', 3,
      'ASSIGNED', '2027-05-10T00:00:00.000Z', '2027-05-10T00:00:00.000Z'
    );

    INSERT INTO live_exam_sessions (
      id, title, quiz_id, teacher_id, class_id, duration, scheduled_at,
      settings, status, access_code, created_at, updated_at,
      participant_scope_type, participant_scope_id, result_visibility
    ) VALUES (
      'live-1', 'School Exam - Room A', 'quiz-4', 'admin', NULL, 45,
      '2027-05-20T08:00:00.000Z', '{"allowLateJoin":true}', 'waiting', 'SCH001',
      '2027-05-10T00:00:00.000Z', '2027-05-10T00:00:00.000Z',
      'SCHOOL_EXAM_ROOM', 'room-1', 'WITHHELD'
    );

    UPDATE competition_school_exam_rooms
    SET live_exam_session_id = 'live-1', provision_status = 'READY', status = 'READY'
    WHERE id = 'room-1';
  `);
}

function mutationCounts(): { attempts: number; participants: number } {
  const attempts = sqlite.prepare('SELECT COUNT(*) AS count FROM competition_round_attempts').get() as { count: number };
  const participants = sqlite.prepare('SELECT COUNT(*) AS count FROM live_exam_participants').get() as { count: number };
  return { attempts: Number(attempts.count), participants: Number(participants.count) };
}

async function preflight(studentId = 'student-1'): Promise<any> {
  const before = mutationCounts();
  const response = await handleStudentCompetitionPortalRoutes(
    d1,
    '/api/student/competitions/campaign-1/school-exam/preflight',
    'POST',
    studentId,
  );
  expect(response).not.toBeNull();
  expect(response!.status).toBe(200);
  const body = await response!.json() as any;
  expect(mutationCounts()).toEqual(before);
  return body.preflight;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2027-05-20T08:00:00.000Z'));
  sqlite = new DatabaseSync(':memory:');
  createBaseSchema(sqlite);
  d1 = createSqliteD1(sqlite);
  seedReadySchoolExam();
});

afterEach(() => {
  vi.useRealTimers();
  sqlite.close();
});

describe('School Exam student participant preflight', () => {
  it('blocks a qualified-set mismatch pinned to the event eligibility version', async () => {
    await expect(preflight('student-2')).resolves.toMatchObject({
      status: 'BLOCKED', campaignId: 'campaign-1', reason: 'SCHOOL_EXAM_NOT_QUALIFIED',
    });
  });

  it('blocks when there is no canonical active School Exam event', async () => {
    sqlite.prepare("UPDATE competition_school_exam_events SET status = 'DRAFT' WHERE id = 'event-1'").run();
    await expect(preflight()).resolves.toMatchObject({
      status: 'BLOCKED', campaignId: 'campaign-1', reason: 'SCHOOL_EXAM_EVENT_NOT_READY',
    });
  });

  it('selects the canonical active event deterministically', async () => {
    sqlite.exec(`
      INSERT INTO competition_school_exam_events (
        id, campaign_id, eligibility_snapshot_version, title, exam_date, status,
        ranking_policy, exam_form_policy, capacity_profile_id,
        created_by, created_at, updated_at, preflight_json, preflight_at
      ) VALUES (
        'event-older', 'campaign-1', 3, 'Older School Exam', '2027-05-19T08:00:00.000Z', 'READY',
        'SCORE_CORRECT_TIME', 'SAME_FORM', 'capacity-1', 'admin',
        '2027-05-01T00:00:00.000Z', '2027-05-01T00:00:00.000Z',
        '{"status":"READY","reason":null,"plannedConcurrency":1,"certifiedConcurrentStudents":100,"capacityProfileId":"capacity-1"}',
        '2027-05-01T00:00:00.000Z'
      );
    `);
    const result = await preflight();
    expect(result).toMatchObject({ status: 'READY', campaignId: 'campaign-1', accessCode: 'SCH001' });
  });

  it('blocks when the student has no active room membership', async () => {
    sqlite.prepare("UPDATE competition_school_exam_members SET status = 'VOID' WHERE id = 'member-1'").run();
    await expect(preflight()).resolves.toMatchObject({
      status: 'BLOCKED', reason: 'SCHOOL_EXAM_MEMBER_NOT_READY',
    });
  });

  it('blocks an ABSENT member without exposing the access code', async () => {
    sqlite.prepare("UPDATE competition_school_exam_members SET status = 'ABSENT' WHERE id = 'member-1'").run();
    const result = await preflight();
    expect(result).toMatchObject({
      status: 'BLOCKED', reason: 'SCHOOL_EXAM_MEMBER_NOT_READY',
    });
    expect(result).not.toHaveProperty('accessCode');
  });

  it('blocks a SUBMITTED member without exposing the access code', async () => {
    sqlite.prepare("UPDATE competition_school_exam_members SET status = 'SUBMITTED' WHERE id = 'member-1'").run();
    const result = await preflight();
    expect(result).toMatchObject({
      status: 'BLOCKED', reason: 'SCHOOL_EXAM_MEMBER_NOT_READY',
    });
    expect(result).not.toHaveProperty('accessCode');
  });

  it('blocks before the room check-in window opens', async () => {
    vi.setSystemTime(new Date('2027-05-20T07:44:59.999Z'));
    const result = await preflight();
    expect(result).toMatchObject({
      status: 'BLOCKED', reason: 'SCHOOL_EXAM_WINDOW_NOT_OPEN',
      serverTime: '2027-05-20T07:44:59.999Z',
      window: {
        opensAt: '2027-05-20T07:45:00.000Z',
        closesAt: '2027-05-20T08:50:00.000Z',
        timezone: 'Asia/Ho_Chi_Minh',
      },
    });
    expect(result).not.toHaveProperty('accessCode');
  });

  it('blocks after the room close/drain window', async () => {
    vi.setSystemTime(new Date('2027-05-20T08:50:00.001Z'));
    const result = await preflight();
    expect(result).toMatchObject({ status: 'BLOCKED', reason: 'SCHOOL_EXAM_WINDOW_CLOSED' });
    expect(result).not.toHaveProperty('accessCode');
  });

  it('blocks when the certified capacity preflight is not successful', async () => {
    sqlite.prepare(`
      UPDATE competition_school_exam_events
      SET preflight_json = '{"status":"PREFLIGHT_BLOCKED","reason":"CAPACITY_EXCEEDED","plannedConcurrency":120,"certifiedConcurrentStudents":100,"capacityProfileId":"capacity-1"}'
      WHERE id = 'event-1'
    `).run();
    await expect(preflight()).resolves.toMatchObject({
      status: 'BLOCKED', reason: 'SCHOOL_EXAM_CAPACITY_NOT_CERTIFIED',
    });
  });

  it('blocks when the assigned room has no provisioned canonical session', async () => {
    sqlite.prepare(`
      UPDATE competition_school_exam_rooms
      SET live_exam_session_id = NULL, provision_status = 'PENDING', status = 'DRAFT'
      WHERE id = 'room-1'
    `).run();
    await expect(preflight()).resolves.toMatchObject({
      status: 'BLOCKED', reason: 'SCHOOL_EXAM_SESSION_NOT_PROVISIONED',
    });
  });

  it('blocks a provisioned session scoped to the wrong School Exam room', async () => {
    sqlite.exec(`
      INSERT INTO competition_school_exam_rooms (
        id, event_id, name, room_code, scheduled_at, duration_minutes,
        check_in_lead_minutes, close_drain_minutes, form_code, quiz_id,
        live_exam_session_id, invigilator_ids_json, member_count,
        form_definition_json, provision_status, status, created_at, updated_at
      )
      SELECT
        'room-2', event_id, 'Room B', 'ROOMB', scheduled_at, duration_minutes,
        check_in_lead_minutes, close_drain_minutes, form_code, quiz_id,
        NULL, invigilator_ids_json, 0, form_definition_json,
        'PENDING', 'DRAFT', created_at, updated_at
      FROM competition_school_exam_rooms
      WHERE id = 'room-1';

      UPDATE live_exam_sessions
      SET participant_scope_id = 'room-2'
      WHERE id = 'live-1';
    `);
    await expect(preflight()).resolves.toMatchObject({
      status: 'BLOCKED', reason: 'SCHOOL_EXAM_PARTICIPANT_SCOPE_MISMATCH',
    });
  });

  it('blocks a School Exam session whose result visibility is not WITHHELD', async () => {
    sqlite.exec(`
      DROP TRIGGER trg_live_exam_scope_update;
      UPDATE live_exam_sessions
      SET result_visibility = 'PUBLISHED'
      WHERE id = 'live-1';
    `);
    await expect(preflight()).resolves.toMatchObject({
      status: 'BLOCKED', reason: 'SCHOOL_EXAM_PARTICIPANT_SCOPE_MISMATCH',
    });
  });

  it('blocks a room or Live Exam session that does not permit check-in/start', async () => {
    sqlite.prepare("UPDATE competition_school_exam_rooms SET status = 'WITHHELD' WHERE id = 'room-1'").run();
    await expect(preflight()).resolves.toMatchObject({
      status: 'BLOCKED', reason: 'SCHOOL_EXAM_ROOM_NOT_READY',
    });

    sqlite.prepare("UPDATE competition_school_exam_rooms SET status = 'READY' WHERE id = 'room-1'").run();
    sqlite.prepare("UPDATE live_exam_sessions SET status = 'closed' WHERE id = 'live-1'").run();
    await expect(preflight()).resolves.toMatchObject({
      status: 'BLOCKED', reason: 'SCHOOL_EXAM_ROOM_NOT_READY',
    });
  });

  it('returns only safe Student-owned join metadata when READY and never joins Live Exam', async () => {
    const result = await preflight();
    expect(result).toEqual({
      status: 'READY',
      campaignId: 'campaign-1',
      title: 'School Exam',
      roomName: 'Room A',
      scheduledAt: '2027-05-20T08:00:00.000Z',
      serverTime: '2027-05-20T08:00:00.000Z',
      window: {
        opensAt: '2027-05-20T07:45:00.000Z',
        closesAt: '2027-05-20T08:50:00.000Z',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      accessCode: 'SCH001',
    });
    expect(result).not.toHaveProperty('eventId');
    expect(result).not.toHaveProperty('roomId');
    expect(result).not.toHaveProperty('memberId');
    expect(result).not.toHaveProperty('liveExamSessionId');
    expect(mutationCounts()).toEqual({ attempts: 0, participants: 0 });
  });

  it('rejects canonical join when the School Exam window closes after a READY preflight', async () => {
    const ready = await preflight();
    expect(ready).toMatchObject({ status: 'READY', accessCode: 'SCH001' });

    vi.setSystemTime(new Date('2027-05-20T08:50:00.001Z'));

    await expect(LiveExamService.joinSession(d1, {
      accessCode: ready.accessCode,
      studentId: 'student-1',
      username: 'student1',
    })).rejects.toMatchObject({
      status: 409,
    });
    expect(mutationCounts()).toEqual({ attempts: 0, participants: 0 });
  });

  it.each([
    [
      'room membership is no longer active',
      "UPDATE competition_school_exam_members SET status = 'ABSENT' WHERE id = 'member-1'",
    ],
    [
      'certified capacity is no longer valid',
      `UPDATE competition_school_exam_events
       SET preflight_json = '{"status":"PREFLIGHT_BLOCKED","reason":"CAPACITY_EXCEEDED","plannedConcurrency":120,"certifiedConcurrentStudents":100,"capacityProfileId":"capacity-1"}'
       WHERE id = 'event-1'`,
    ],
    [
      'the canonical room is no longer provisioned',
      "UPDATE competition_school_exam_rooms SET provision_status = 'FAILED' WHERE id = 'room-1'",
    ],
  ])('rejects canonical join when %s after a READY preflight', async (_label, mutation) => {
    const ready = await preflight();
    expect(ready).toMatchObject({ status: 'READY', accessCode: 'SCH001' });

    sqlite.prepare(mutation).run();

    await expect(LiveExamService.joinSession(d1, {
      accessCode: ready.accessCode,
      studentId: 'student-1',
      username: 'student1',
    })).rejects.toMatchObject({
      status: 409,
    });
    expect(mutationCounts()).toEqual({ attempts: 0, participants: 0 });
  });

  it('does not leak the access code on any BLOCKED response', async () => {
    sqlite.prepare("UPDATE competition_school_exam_members SET status = 'VOID' WHERE id = 'member-1'").run();
    const result = await preflight();
    expect(result.status).toBe('BLOCKED');
    expect(result).not.toHaveProperty('accessCode');
    expect(JSON.stringify(result)).not.toContain('SCH001');
  });

  it('blocks a malformed canonical Live Exam access code without leaking it', async () => {
    sqlite.prepare("UPDATE live_exam_sessions SET access_code = 'bad-1' WHERE id = 'live-1'").run();
    const result = await preflight();
    expect(result).toMatchObject({
      status: 'BLOCKED', reason: 'SCHOOL_EXAM_ACCESS_CODE_INVALID',
    });
    expect(result).not.toHaveProperty('accessCode');
    expect(JSON.stringify(result)).not.toContain('bad-1');
    expect(mutationCounts()).toEqual({ attempts: 0, participants: 0 });
  });
});

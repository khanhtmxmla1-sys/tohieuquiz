// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signJWT } from '../workers/src/utils/jwt';
import { handleCompetitionRoutes } from '../workers/src/routes/competitions';
import { createSqliteD1 } from './helpers/sqliteD1';

const liveExamMigration = readFileSync(new URL('../workers/migrations/0016_add_live_exam_tables.sql', import.meta.url), 'utf8');
const coreMigration = readFileSync(new URL('../workers/migrations/0069_competition_core.sql', import.meta.url), 'utf8');
const schoolExamMigration = readFileSync(new URL('../workers/migrations/0070_competition_school_exam.sql', import.meta.url), 'utf8');
const capacityMigration = readFileSync(new URL('../workers/migrations/0071_live_exam_capacity_profiles.sql', import.meta.url), 'utf8');
const orchestrationMigrationUrl = new URL('../workers/migrations/0072_competition_school_exam_orchestration.sql', import.meta.url);

const secret = 'school-exam-orchestration-test-secret';
let sqlite: DatabaseSync;
let env: { DB: D1Database; JWT_SECRET: string };
let adminCookie: string;

function createBaseSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE teachers (
      username TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      token_version INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      teacher_username TEXT NOT NULL,
      created_at TEXT NOT NULL,
      archived_at TEXT
    );
    CREATE TABLE students (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      class_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      archived_at TEXT
    );
    CREATE TABLE quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      class_level TEXT,
      category TEXT,
      time_limit INTEGER,
      created_at TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      tags TEXT,
      source_type TEXT,
      parent_quiz_id TEXT,
      version_number INTEGER,
      revision INTEGER,
      updated_at TEXT
    );
    CREATE TABLE questions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      type TEXT NOT NULL,
      question TEXT NOT NULL,
      options TEXT,
      correct_answer TEXT,
      items TEXT,
      text_field TEXT,
      blanks TEXT,
      distractors TEXT,
      sentence TEXT,
      words TEXT,
      correct_word_indexes TEXT,
      image TEXT,
      svg_content TEXT,
      svg_alt TEXT,
      difficulty TEXT,
      answer_schema_version INTEGER
    );
    CREATE TABLE results (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE admin_audit_logs (
      id TEXT PRIMARY KEY,
      actor_username TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      request_id TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      created_at TEXT NOT NULL
    );

    INSERT INTO teachers (username) VALUES ('admin'), ('teacher-4');
    INSERT INTO classes (id, name, teacher_username, created_at) VALUES
      ('class-4a', '4A', 'teacher-4', '2026-08-01T00:00:00.000Z'),
      ('class-4b', '4B', 'teacher-4', '2026-08-01T00:00:00.000Z');
    INSERT INTO students (id, full_name, username, password_hash, class_id, created_at) VALUES
      ('student-1', 'An', 'student1', 'hash', 'class-4a', '2026-08-01T00:00:00.000Z'),
      ('student-2', 'Binh', 'student2', 'hash', 'class-4b', '2026-08-01T00:00:00.000Z'),
      ('student-3', 'Chi', 'student3', 'hash', 'class-4a', '2026-08-01T00:00:00.000Z');
    INSERT INTO quizzes (id, title, class_level, category, time_limit, created_at, created_by, tags, source_type, version_number, revision, updated_at) VALUES
      ('quiz-a', 'School Form A', '4', 'Tiếng Việt', 45, '2026-08-01T00:00:00.000Z', 'admin', '[]', 'manual', 1, 1, '2026-08-01T00:00:00.000Z'),
      ('quiz-b', 'School Form B', '4', 'Tiếng Việt', 45, '2026-08-01T00:00:00.000Z', 'admin', '[]', 'manual', 1, 1, '2026-08-01T00:00:00.000Z');
    INSERT INTO questions (id, quiz_id, type, question, options, correct_answer, difficulty) VALUES
      ('qa-1', 'quiz-a', 'MCQ', 'A?', '1|2', 'B', 'MEDIUM'),
      ('qb-1', 'quiz-b', 'MCQ', 'B?', '1|2', 'B', 'MEDIUM');
  `);
}

function seedCompetition(): void {
  sqlite.exec(liveExamMigration);
  sqlite.exec(coreMigration);
  sqlite.exec(schoolExamMigration);
  sqlite.exec(capacityMigration);
  if (existsSync(orchestrationMigrationUrl)) sqlite.exec(readFileSync(orchestrationMigrationUrl, 'utf8'));

  sqlite.exec(`
    INSERT INTO competition_campaigns (
      id, title, school_year, timezone, status, audience_rule_json, audience_snapshot_id,
      eligibility_policy_json, starts_at, ends_at, created_by, created_at, updated_at
    ) VALUES (
      'campaign-1', 'Competition', '2026-2027', 'Asia/Ho_Chi_Minh', 'ELIGIBILITY_LOCKED',
      '{"gradeLevels":[4]}', 'audience-1', '{"requiredRounds":6,"requiredPassedRounds":6}',
      '2026-09-01T00:00:00.000Z', '2027-05-31T23:59:59.000Z', 'admin',
      '2026-08-20T00:00:00.000Z', '2026-08-20T00:00:00.000Z'
    );
    INSERT INTO competition_audience_snapshots (
      id, campaign_id, version, status, member_count, snapshot_hash, created_at, locked_at, created_by
    ) VALUES (
      'audience-1', 'campaign-1', 1, 'BUILDING', 3, 'hash',
      '2026-08-20T00:00:00.000Z', NULL, 'admin'
    );
    INSERT INTO competition_audience_members (
      audience_snapshot_id, student_id, grade_level_at_snapshot, class_id_at_snapshot, student_status_at_snapshot
    ) VALUES
      ('audience-1', 'student-1', 4, 'class-4a', 'ACTIVE'),
      ('audience-1', 'student-2', 4, 'class-4b', 'ACTIVE'),
      ('audience-1', 'student-3', 4, 'class-4a', 'ACTIVE');
    UPDATE competition_audience_snapshots
    SET status = 'LOCKED', locked_at = '2026-08-20T00:05:00.000Z', snapshot_hash = '${'a'.repeat(64)}'
    WHERE id = 'audience-1';
    INSERT INTO competition_eligibility (
      id, campaign_id, eligibility_snapshot_version, student_id, qualified,
      reason_codes_json, qualified_at, computed_at, progress_digest
    ) VALUES
      ('elig-1', 'campaign-1', 1, 'student-1', 1, '["QUALIFIED"]', '2027-03-01T00:00:00.000Z', '2027-03-01T00:00:00.000Z', '${'b'.repeat(64)}'),
      ('elig-2', 'campaign-1', 1, 'student-2', 1, '["QUALIFIED"]', '2027-03-01T00:00:00.000Z', '2027-03-01T00:00:00.000Z', '${'c'.repeat(64)}'),
      ('elig-3', 'campaign-1', 1, 'student-3', 0, '["ROUND_6_NOT_PASSED"]', NULL, '2027-03-01T00:00:00.000Z', '${'d'.repeat(64)}');
    INSERT INTO live_exam_capacity_profiles (
      id, benchmark_run_id, build_sha, runtime_config_version, polling_profile_version,
      certified_concurrent_students, status_p95_ms, submit_p95_ms, lost_answers,
      duplicate_failures, d1_overload, app_5xx, network_errors, passed_at, created_at
    ) VALUES (
      'capacity-100', 'run-100', 'sha', 'cfg', 'poll', 100, 200, 800, 0, 0, 0, 0, 0,
      '2026-08-20T00:00:00.000Z', '2026-08-20T00:00:00.000Z'
    );
  `);
}

async function request(path: string, method = 'GET', body?: unknown): Promise<Response | null> {
  const req = new Request(`https://api.test${path}`, {
    method,
    headers: {
      Cookie: adminCookie,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handleCompetitionRoutes(req, env as any, new URL(req.url).pathname, method);
}

const formDefinition = {
  blueprintId: 'tv4-school-v1',
  durationMinutes: 45,
  totalScore: 10,
  difficulty: 'MEDIUM',
  gradeLevel: 4,
  objectiveIds: ['obj-1', 'obj-2'],
};

async function createEvent(policy: 'SAME_FORM' | 'EQUIVALENT_FORM_SET' = 'SAME_FORM'): Promise<string> {
  const response = await request('/api/competitions/campaign-1/school-exams', 'POST', {
    campaignId: 'campaign-1',
    eligibilitySnapshotVersion: 1,
    title: 'School Exam',
    examDate: '2027-05-10T01:00:00.000Z',
    rankingPolicy: 'SCORE_CORRECT_TIME',
    examFormPolicy: policy,
    capacityProfileId: 'capacity-100',
    requestId: `create-event-${policy}-0001`,
  });
  expect(response).not.toBeNull();
  expect(response?.status).toBe(201);
  return ((await response!.json()) as any).event.id as string;
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2027-04-01T00:00:00.000Z'));
  sqlite = new DatabaseSync(':memory:');
  createBaseSchema(sqlite);
  seedCompetition();
  env = { DB: createSqliteD1(sqlite), JWT_SECRET: secret };
  const token = await signJWT({ username: 'admin', role: 'admin', tokenVersion: 1, purpose: 'session' }, secret, '30d');
  adminCookie = `auth_token=${token}`;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  sqlite.close();
});

describe('Competition V1 school-exam orchestration', () => {
  it('creates an event pinned to eligibility and only assigns qualified RoomMembers with frozen originalClassId', async () => {
    expect(existsSync(orchestrationMigrationUrl)).toBe(true);
    const eventId = await createEvent();

    const rejected = await request(`/api/school-exams/${eventId}/rooms`, 'POST', {
      eventId,
      name: 'Room invalid',
      roomCode: 'R00',
      scheduledAt: '2027-05-10T01:00:00.000Z',
      durationMinutes: 45,
      checkInLeadMinutes: 15,
      closeDrainMinutes: 10,
      formCode: 'A',
      quizId: 'quiz-a',
      invigilatorIds: ['teacher-4'],
      studentIds: ['student-3'],
      formDefinition,
      requestId: 'create-room-invalid-0001',
    });
    expect(rejected?.status).toBe(409);

    const created = await request(`/api/school-exams/${eventId}/rooms`, 'POST', {
      eventId,
      name: 'Room 1',
      roomCode: 'R01',
      scheduledAt: '2027-05-10T01:00:00.000Z',
      durationMinutes: 45,
      checkInLeadMinutes: 15,
      closeDrainMinutes: 10,
      formCode: 'A',
      quizId: 'quiz-a',
      invigilatorIds: ['teacher-4'],
      studentIds: ['student-1', 'student-2'],
      formDefinition,
      requestId: 'create-room-valid-0001',
    });
    expect(created?.status).toBe(201);
    expect((await created!.json() as any).room).toMatchObject({ memberCount: 2, quizSnapshotId: expect.any(String) });

    const detail = await request(`/api/school-exams/${eventId}`);
    expect(detail).not.toBeNull();
    expect(detail?.status).toBe(200);
    expect((await detail!.json() as any).event).toMatchObject({
      id: eventId,
      eligibilitySnapshotVersion: 1,
      rooms: [expect.objectContaining({ roomCode: 'R01', memberCount: 2 })],
    });

    expect(sqlite.prepare(`
      SELECT student_id, original_class_id FROM competition_school_exam_members ORDER BY student_id
    `).all()).toEqual([
      { student_id: 'student-1', original_class_id: 'class-4a' },
      { student_id: 'student-2', original_class_id: 'class-4b' },
    ]);
  });

  it('requires approved equivalent forms with matching characteristics and warns on later-shift form reuse', async () => {
    const eventId = await createEvent('EQUIVALENT_FORM_SET');
    const first = await request(`/api/school-exams/${eventId}/rooms`, 'POST', {
      eventId,
      name: 'Shift 1', roomCode: 'S1', scheduledAt: '2027-05-10T01:00:00.000Z',
      durationMinutes: 45, checkInLeadMinutes: 0, closeDrainMinutes: 0,
      formCode: 'A', quizId: 'quiz-a', invigilatorIds: ['teacher-4'], studentIds: ['student-1'],
      formDefinition, equivalentFormApproved: true, requestId: 'equiv-room-1-0001',
    });
    expect(first?.status).toBe(201);

    const mismatch = await request(`/api/school-exams/${eventId}/rooms`, 'POST', {
      eventId,
      name: 'Shift 2 bad', roomCode: 'S2B', scheduledAt: '2027-05-10T02:00:00.000Z',
      durationMinutes: 45, checkInLeadMinutes: 0, closeDrainMinutes: 0,
      formCode: 'B', quizId: 'quiz-b', invigilatorIds: ['teacher-4'], studentIds: ['student-2'],
      formDefinition: { ...formDefinition, difficulty: 'HARD' }, equivalentFormApproved: true,
      requestId: 'equiv-room-bad-0001',
    });
    expect(mismatch?.status).toBe(409);

    const unapproved = await request(`/api/school-exams/${eventId}/rooms`, 'POST', {
      eventId,
      name: 'Shift 2 unapproved', roomCode: 'S2U', scheduledAt: '2027-05-10T02:00:00.000Z',
      durationMinutes: 45, checkInLeadMinutes: 0, closeDrainMinutes: 0,
      formCode: 'B', quizId: 'quiz-b', invigilatorIds: ['teacher-4'], studentIds: ['student-2'],
      formDefinition, equivalentFormApproved: false, requestId: 'equiv-room-unapproved-0001',
    });
    expect(unapproved?.status).toBe(409);

    const reused = await request(`/api/school-exams/${eventId}/rooms`, 'POST', {
      eventId,
      name: 'Shift 2 reused', roomCode: 'S2', scheduledAt: '2027-05-10T02:00:00.000Z',
      durationMinutes: 45, checkInLeadMinutes: 0, closeDrainMinutes: 0,
      formCode: 'A', quizId: 'quiz-a', invigilatorIds: ['teacher-4'], studentIds: ['student-2'],
      formDefinition, equivalentFormApproved: true, requestId: 'equiv-room-reuse-0001',
    });
    expect(reused?.status).toBe(201);
    expect((await reused!.json() as any).warnings).toContain('LATER_SHIFT_FORM_REUSE');
  });

  it('blocks an over-capacity overlapping plan using the certified profile', async () => {
    const eventId = await createEvent();
    for (const [code, studentId] of [['R1', 'student-1'], ['R2', 'student-2']] as const) {
      const room = await request(`/api/school-exams/${eventId}/rooms`, 'POST', {
        eventId, name: code, roomCode: code, scheduledAt: '2027-05-10T01:00:00.000Z',
        durationMinutes: 45, checkInLeadMinutes: 15, closeDrainMinutes: 10,
        formCode: 'A', quizId: 'quiz-a', invigilatorIds: ['teacher-4'], studentIds: [studentId],
        formDefinition, requestId: `capacity-room-${code}-0001`,
      });
      expect(room?.status).toBe(201);
    }
    sqlite.prepare('UPDATE competition_school_exam_rooms SET member_count = 60').run();

    const preflight = await request(`/api/school-exams/${eventId}/preflight`, 'POST', {
      eventId,
      requestId: 'school-preflight-over-0001',
    });
    expect(preflight?.status).toBe(409);
    expect((await preflight!.json() as any)).toMatchObject({
      preflight: { status: 'PREFLIGHT_BLOCKED', reason: 'CAPACITY_EXCEEDED', plannedConcurrency: 120 },
    });
    expect(sqlite.prepare('SELECT status FROM competition_school_exam_events WHERE id = ?').get(eventId))
      .toEqual({ status: 'PREFLIGHT_BLOCKED' });
  });

  it('retries only missing/failed room sessions and never marks a partial provision READY', async () => {
    const eventId = await createEvent();
    for (const [code, studentId] of [['R1', 'student-1'], ['R2', 'student-2']] as const) {
      expect((await request(`/api/school-exams/${eventId}/rooms`, 'POST', {
        eventId, name: code, roomCode: code, scheduledAt: '2027-05-10T01:00:00.000Z',
        durationMinutes: 45, checkInLeadMinutes: 0, closeDrainMinutes: 0,
        formCode: 'A', quizId: 'quiz-a', invigilatorIds: ['teacher-4'], studentIds: [studentId],
        formDefinition, requestId: `provision-room-${code}-0001`,
      }))?.status).toBe(201);
    }
    expect((await request(`/api/school-exams/${eventId}/preflight`, 'POST', {
      eventId, requestId: 'school-preflight-ok-0001',
    }))?.status).toBe(200);

    vi.spyOn(Math, 'random').mockReturnValue(0);
    const partial = await request(`/api/school-exams/${eventId}/provision`, 'POST', {
      eventId, requestId: 'school-provision-partial-0001',
    });
    expect(partial?.status).toBe(207);
    expect(sqlite.prepare('SELECT status FROM competition_school_exam_events WHERE id = ?').get(eventId))
      .toEqual({ status: 'DRAFT' });
    const afterPartial = sqlite.prepare(`
      SELECT room_code, live_exam_session_id, provision_status
      FROM competition_school_exam_rooms WHERE event_id = ? ORDER BY room_code
    `).all(eventId) as any[];
    expect(afterPartial.map((row) => row.provision_status)).toEqual(['READY', 'FAILED']);
    const firstSessionId = afterPartial[0].live_exam_session_id;

    vi.restoreAllMocks();
    const retry = await request(`/api/school-exams/${eventId}/provision`, 'POST', {
      eventId, requestId: 'school-provision-retry-0001',
    });
    expect(retry?.status).toBe(200);
    expect(sqlite.prepare('SELECT status FROM competition_school_exam_events WHERE id = ?').get(eventId))
      .toEqual({ status: 'READY' });
    const finalRooms = sqlite.prepare(`
      SELECT room_code, live_exam_session_id, provision_status
      FROM competition_school_exam_rooms WHERE event_id = ? ORDER BY room_code
    `).all(eventId) as any[];
    expect(finalRooms.map((row) => row.provision_status)).toEqual(['READY', 'READY']);
    expect(finalRooms[0].live_exam_session_id).toBe(firstSessionId);
  });
});

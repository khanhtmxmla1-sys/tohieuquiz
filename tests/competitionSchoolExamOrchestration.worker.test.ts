// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readSheet } from 'read-excel-file/node';
import { signJWT } from '../workers/src/utils/jwt';
import { handleCompetitionRoutes } from '../workers/src/routes/competitions';
import { processCompetitionExportQueue } from '../workers/src/queues/competitionExportQueue';
import { createSqliteD1 } from './helpers/sqliteD1';

const liveExamMigration = readFileSync(new URL('../workers/migrations/0016_add_live_exam_tables.sql', import.meta.url), 'utf8');
const coreMigration = readFileSync(new URL('../workers/migrations/0069_competition_core.sql', import.meta.url), 'utf8');
const schoolExamMigration = readFileSync(new URL('../workers/migrations/0070_competition_school_exam.sql', import.meta.url), 'utf8');
const capacityMigration = readFileSync(new URL('../workers/migrations/0071_live_exam_capacity_profiles.sql', import.meta.url), 'utf8');
const orchestrationMigrationUrl = new URL('../workers/migrations/0072_competition_school_exam_orchestration.sql', import.meta.url);
const reconcileMigrationUrl = new URL('../workers/migrations/0073_competition_school_exam_reconcile.sql', import.meta.url);
const incidentRetestMigrationUrl = new URL('../workers/migrations/0074_competition_school_exam_incident_retest.sql', import.meta.url);
const publicationRankingMigrationUrl = new URL('../workers/migrations/0075_competition_school_exam_publication_ranking.sql', import.meta.url);
const certificateAdapterMigrationUrl = new URL('../workers/migrations/0076_competition_certificate_adapter.sql', import.meta.url);
const exportAdapterMigrationUrl = new URL('../workers/migrations/0077_competition_async_xlsx_export.sql', import.meta.url);

const secret = 'school-exam-orchestration-test-secret';
let sqlite: DatabaseSync;
class MockR2Object {
  constructor(
    private readonly bytes: Uint8Array,
    readonly httpMetadata?: Record<string, string>,
  ) {}

  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.bytes.buffer.slice(
      this.bytes.byteOffset,
      this.bytes.byteOffset + this.bytes.byteLength,
    ) as ArrayBuffer;
  }

  get body(): ReadableStream<Uint8Array> {
    const bytes = this.bytes;
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
  }
}

class MockR2Bucket {
  readonly objects = new Map<string, MockR2Object>();

  async put(key: string, value: ArrayBuffer | ArrayBufferView | Blob, options?: { httpMetadata?: Record<string, string> }) {
    let bytes: Uint8Array;
    if (value instanceof Blob) {
      bytes = new Uint8Array(await value.arrayBuffer());
    } else if (ArrayBuffer.isView(value)) {
      bytes = new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
    } else {
      bytes = new Uint8Array(value);
    }
    const object = new MockR2Object(bytes, options?.httpMetadata);
    this.objects.set(key, object);
    return object;
  }

  async get(key: string) {
    return this.objects.get(key) || null;
  }

  async head(key: string) {
    return this.objects.get(key) || null;
  }
}

let env: {
  DB: D1Database;
  JWT_SECRET: string;
  CERTIFICATE_QUEUE: { send: ReturnType<typeof vi.fn> };
  COMPETITION_EXPORT_QUEUE: { send: ReturnType<typeof vi.fn> };
  COMPETITION_EXPORTS: MockR2Bucket;
};
let adminCookie: string;
let invigilatorCookie: string;
let unrelatedTeacherCookie: string;

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
    CREATE TABLE certificate_templates (
      id TEXT PRIMARY KEY,
      school_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      bg_image_r2_key TEXT NOT NULL,
      thumbnail_r2_key TEXT,
      fields_config TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE certificate_batches (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      request_id TEXT NOT NULL,
      class_id TEXT,
      quiz_id TEXT,
      template_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      achievement_prefix TEXT,
      date_line TEXT,
      student_name_font TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      processing_started_at TEXT,
      error_message TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(teacher_id, request_id)
    );
    CREATE TABLE certificates (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL DEFAULT '',
      student_score REAL,
      quiz_title TEXT,
      image_url TEXT,
      png_r2_key TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      issued_at TEXT NOT NULL,
      sent_at TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE(batch_id, student_id)
    );
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

    INSERT INTO teachers (username) VALUES ('admin'), ('teacher-4'), ('teacher-5');
    INSERT INTO classes (id, name, teacher_username, created_at) VALUES
      ('class-4a', '4A', 'teacher-4', '2026-08-01T00:00:00.000Z'),
      ('class-4b', '4B', 'teacher-4', '2026-08-01T00:00:00.000Z');
    INSERT INTO students (id, full_name, username, password_hash, class_id, created_at) VALUES
      ('student-1', 'An', 'student1', 'hash', 'class-4a', '2026-08-01T00:00:00.000Z'),
      ('student-2', 'Binh', 'student2', 'hash', 'class-4b', '2026-08-01T00:00:00.000Z'),
      ('student-3', 'Chi', 'student3', 'hash', 'class-4a', '2026-08-01T00:00:00.000Z'),
      ('student-4', 'Duong', 'student4', 'hash', 'class-4a', '2026-08-01T00:00:00.000Z');
    INSERT INTO quizzes (id, title, class_level, category, time_limit, created_at, created_by, tags, source_type, version_number, revision, updated_at) VALUES
      ('quiz-a', 'School Form A', '4', 'Tiếng Việt', 45, '2026-08-01T00:00:00.000Z', 'admin', '[]', 'manual', 1, 1, '2026-08-01T00:00:00.000Z'),
      ('quiz-b', 'School Form B', '4', 'Tiếng Việt', 45, '2026-08-01T00:00:00.000Z', 'admin', '[]', 'manual', 1, 1, '2026-08-01T00:00:00.000Z');
    INSERT INTO questions (id, quiz_id, type, question, options, correct_answer, difficulty) VALUES
      ('qa-1', 'quiz-a', 'MCQ', 'A?', '1|2', 'B', 'MEDIUM'),
      ('qb-1', 'quiz-b', 'MCQ', 'B?', '1|2', 'B', 'MEDIUM');
    INSERT INTO certificate_templates (
      id, school_id, name, bg_image_r2_key, fields_config, is_active, created_by, created_at, updated_at
    ) VALUES (
      'template-competition', NULL, 'Competition Winner', 'templates/competition.png', '[]', 1, 'admin',
      '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'
    );
  `);
}

function seedCompetition(): void {
  sqlite.exec(liveExamMigration);
  sqlite.exec(coreMigration);
  sqlite.exec(schoolExamMigration);
  sqlite.exec(capacityMigration);
  if (existsSync(orchestrationMigrationUrl)) sqlite.exec(readFileSync(orchestrationMigrationUrl, 'utf8'));
  if (existsSync(reconcileMigrationUrl)) sqlite.exec(readFileSync(reconcileMigrationUrl, 'utf8'));
  if (existsSync(incidentRetestMigrationUrl)) sqlite.exec(readFileSync(incidentRetestMigrationUrl, 'utf8'));
  if (existsSync(publicationRankingMigrationUrl)) sqlite.exec(readFileSync(publicationRankingMigrationUrl, 'utf8'));
  if (existsSync(certificateAdapterMigrationUrl)) sqlite.exec(readFileSync(certificateAdapterMigrationUrl, 'utf8'));
  if (existsSync(exportAdapterMigrationUrl)) sqlite.exec(readFileSync(exportAdapterMigrationUrl, 'utf8'));

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
      'audience-1', 'campaign-1', 1, 'BUILDING', 4, 'hash',
      '2026-08-20T00:00:00.000Z', NULL, 'admin'
    );
    INSERT INTO competition_audience_members (
      audience_snapshot_id, student_id, grade_level_at_snapshot, class_id_at_snapshot, student_status_at_snapshot
    ) VALUES
      ('audience-1', 'student-1', 4, 'class-4a', 'ACTIVE'),
      ('audience-1', 'student-2', 4, 'class-4b', 'ACTIVE'),
      ('audience-1', 'student-3', 4, 'class-4a', 'ACTIVE'),
      ('audience-1', 'student-4', 4, 'class-4a', 'ACTIVE');
    UPDATE competition_audience_snapshots
    SET status = 'LOCKED', locked_at = '2026-08-20T00:05:00.000Z', snapshot_hash = '${'a'.repeat(64)}'
    WHERE id = 'audience-1';
    INSERT INTO competition_eligibility (
      id, campaign_id, eligibility_snapshot_version, student_id, qualified,
      reason_codes_json, qualified_at, computed_at, progress_digest
    ) VALUES
      ('elig-1', 'campaign-1', 1, 'student-1', 1, '["QUALIFIED"]', '2027-03-01T00:00:00.000Z', '2027-03-01T00:00:00.000Z', '${'b'.repeat(64)}'),
      ('elig-2', 'campaign-1', 1, 'student-2', 1, '["QUALIFIED"]', '2027-03-01T00:00:00.000Z', '2027-03-01T00:00:00.000Z', '${'c'.repeat(64)}'),
      ('elig-3', 'campaign-1', 1, 'student-3', 0, '["ROUND_6_NOT_PASSED"]', NULL, '2027-03-01T00:00:00.000Z', '${'d'.repeat(64)}'),
      ('elig-4', 'campaign-1', 1, 'student-4', 1, '["QUALIFIED"]', '2027-03-01T00:00:00.000Z', '2027-03-01T00:00:00.000Z', '${'e'.repeat(64)}');
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

async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  cookie = adminCookie,
): Promise<Response | null> {
  const req = new Request(`https://api.test${path}`, {
    method,
    headers: {
      Cookie: cookie,
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

async function createRoom(eventId: string, roomCode: string, studentIds: string[]): Promise<string> {
  const response = await request(`/api/school-exams/${eventId}/rooms`, 'POST', {
    eventId,
    name: `Room ${roomCode}`,
    roomCode,
    scheduledAt: '2027-05-10T01:00:00.000Z',
    durationMinutes: 45,
    checkInLeadMinutes: 0,
    closeDrainMinutes: 0,
    formCode: 'A',
    quizId: 'quiz-a',
    invigilatorIds: ['teacher-4'],
    studentIds,
    formDefinition,
    requestId: `create-room-${roomCode.toLowerCase()}-0001`,
  });
  expect(response?.status).toBe(201);
  return ((await response!.json()) as any).room.id as string;
}

async function provisionEvent(eventId: string): Promise<void> {
  expect((await request(`/api/school-exams/${eventId}/preflight`, 'POST', {
    eventId,
    requestId: `preflight-${eventId}-0001`,
  }))?.status).toBe(200);
  expect((await request(`/api/school-exams/${eventId}/provision`, 'POST', {
    eventId,
    requestId: `provision-${eventId}-0001`,
  }))?.status).toBe(200);
}

async function createClosedOriginalResult(studentId = 'student-1') {
  const eventId = await createEvent();
  const roomId = await createRoom(eventId, 'R1', [studentId]);
  await provisionEvent(eventId);
  const room = sqlite.prepare(`
    SELECT live_exam_session_id FROM competition_school_exam_rooms WHERE id = ?
  `).get(roomId) as { live_exam_session_id: string };
  const originalSessionId = room.live_exam_session_id;
  sqlite.prepare(`
    UPDATE live_exam_sessions
    SET status = 'closed', started_at = ?, closed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(
    '2027-05-10T01:00:00.000Z',
    '2027-05-10T01:03:00.000Z',
    '2027-05-10T01:03:00.000Z',
    originalSessionId,
  );
  const participantId = `participant-original-${studentId}`;
  sqlite.prepare(`
    INSERT INTO live_exam_participants (
      id, live_exam_id, student_id, username, joined_at, started_at, submitted_at,
      answers, score, correct_count, wrong_count, rank, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 90, 9, 1, 1, ?, ?)
  `).run(
    participantId,
    originalSessionId,
    studentId,
    studentId === 'student-1' ? 'student1' : 'student2',
    '2027-05-10T00:59:00.000Z',
    '2027-05-10T01:00:00.000Z',
    '2027-05-10T01:02:00.000Z',
    '{"qa-1":"B"}',
    '2027-05-10T00:59:00.000Z',
    '2027-05-10T01:02:00.000Z',
  );
  const reconcile = await request(`/api/school-exams/${eventId}/reconcile`, 'POST', {
    eventId,
    requestId: `reconcile-original-${studentId}-0001`,
  });
  expect(reconcile?.status).toBe(200);
  const originalResult = sqlite.prepare(`
    SELECT id FROM competition_school_exam_results WHERE event_id = ? AND student_id = ?
  `).get(eventId, studentId) as { id: string };
  return { eventId, roomId, originalSessionId, participantId, originalResultId: originalResult.id };
}

async function reportIncident(input: {
  eventId: string;
  roomId: string;
  studentId: string;
  originalResultId: string;
  requestId: string;
}, cookie = invigilatorCookie) {
  return request(`/api/school-exams/${input.eventId}/incidents`, 'POST', {
    eventId: input.eventId,
    roomId: input.roomId,
    studentId: input.studentId,
    originalResultId: input.originalResultId,
    reasonCode: 'NETWORK_FAILURE',
    reasonText: 'Network dropped during submission',
    occurredAt: '2027-05-10T01:01:30.000Z',
    details: { source: 'invigilator-console' },
    requestId: input.requestId,
  }, cookie);
}

async function createReadyRankingEvent() {
  const eventId = await createEvent();
  const roomId = await createRoom(eventId, 'RANK', ['student-1', 'student-2', 'student-4']);
  await provisionEvent(eventId);
  const room = sqlite.prepare(`
    SELECT live_exam_session_id FROM competition_school_exam_rooms WHERE id = ?
  `).get(roomId) as { live_exam_session_id: string };
  sqlite.prepare(`
    UPDATE live_exam_sessions
    SET status = 'closed', started_at = ?, closed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(
    '2027-05-10T01:00:00.000Z',
    '2027-05-10T01:03:00.000Z',
    '2027-05-10T01:03:00.000Z',
    room.live_exam_session_id,
  );

  const insert = sqlite.prepare(`
    INSERT INTO live_exam_participants (
      id, live_exam_id, student_id, username, joined_at, started_at, submitted_at,
      answers, score, correct_count, wrong_count, rank, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, 0, NULL, ?, ?)
  `);
  for (const row of [
    ['rank-p1', 'student-1', 'student1', '2027-05-10T01:02:00.000Z', 95, 9],
    ['rank-p2', 'student-2', 'student2', '2027-05-10T01:01:40.000Z', 95, 9],
    ['rank-p4', 'student-4', 'student4', '2027-05-10T01:02:00.000Z', 95, 9],
  ] as const) {
    insert.run(
      row[0],
      room.live_exam_session_id,
      row[1],
      row[2],
      '2027-05-10T00:59:00.000Z',
      '2027-05-10T01:00:00.000Z',
      row[3],
      row[4],
      row[5],
      '2027-05-10T00:59:00.000Z',
      row[3],
    );
  }

  const reconcile = await request(`/api/school-exams/${eventId}/reconcile`, 'POST', {
    eventId,
    requestId: 'reconcile-ranking-0001',
  });
  expect(reconcile?.status).toBe(200);
  expect(((await reconcile!.json()) as any).reconcile).toMatchObject({
    status: 'SUCCEEDED',
    blockingIssues: 0,
    allRoomsClosed: true,
    eventStatus: 'READY_TO_PUBLISH',
  });
  return { eventId, roomId, liveExamSessionId: room.live_exam_session_id };
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2027-04-01T00:00:00.000Z'));
  sqlite = new DatabaseSync(':memory:');
  createBaseSchema(sqlite);
  seedCompetition();
  env = {
    DB: createSqliteD1(sqlite),
    JWT_SECRET: secret,
    CERTIFICATE_QUEUE: { send: vi.fn(async () => undefined) },
    COMPETITION_EXPORT_QUEUE: { send: vi.fn(async () => undefined) },
    COMPETITION_EXPORTS: new MockR2Bucket(),
  };
  const token = await signJWT({ username: 'admin', role: 'admin', tokenVersion: 1, purpose: 'session' }, secret, '30d');
  const invigilatorToken = await signJWT({ username: 'teacher-4', role: 'teacher', tokenVersion: 1, purpose: 'session' }, secret, '30d');
  const unrelatedTeacherToken = await signJWT({ username: 'teacher-5', role: 'teacher', tokenVersion: 1, purpose: 'session' }, secret, '30d');
  adminCookie = `auth_token=${token}`;
  invigilatorCookie = `auth_token=${invigilatorToken}`;
  unrelatedTeacherCookie = `auth_token=${unrelatedTeacherToken}`;
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

  it('reconciles closed rooms into versioned canonical results and is rerunnable/idempotent without mutating Live Exam rows', async () => {
    const eventId = await createEvent();
    const roomId = await createRoom(eventId, 'R1', ['student-1']);
    await provisionEvent(eventId);
    const room = sqlite.prepare(`
      SELECT live_exam_session_id FROM competition_school_exam_rooms WHERE id = ?
    `).get(roomId) as { live_exam_session_id: string };
    const liveExamId = room.live_exam_session_id;
    sqlite.prepare(`
      UPDATE live_exam_sessions
      SET status = 'closed', started_at = ?, closed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      '2027-05-10T01:00:00.000Z',
      '2027-05-10T01:03:00.000Z',
      '2027-05-10T01:03:00.000Z',
      liveExamId,
    );
    sqlite.prepare(`
      INSERT INTO live_exam_participants (
        id, live_exam_id, student_id, username, joined_at, started_at, submitted_at,
        answers, score, correct_count, wrong_count, rank, created_at, updated_at
      ) VALUES (?, ?, 'student-1', 'student1', ?, ?, ?, ?, 90, 9, 1, 1, ?, ?)
    `).run(
      'participant-1', liveExamId,
      '2027-05-10T00:59:00.000Z', '2027-05-10T01:00:00.000Z', '2027-05-10T01:02:00.000Z',
      '{"qa-1":"B"}', '2027-05-10T00:59:00.000Z', '2027-05-10T01:02:00.000Z',
    );
    const rawBefore = sqlite.prepare(`
      SELECT live_exam_id, student_id, submitted_at, answers, score, correct_count, wrong_count, rank
      FROM live_exam_participants WHERE id = 'participant-1'
    `).get();

    const first = await request(`/api/school-exams/${eventId}/reconcile`, 'POST', {
      eventId,
      requestId: 'reconcile-closed-0001',
    });
    expect(first).not.toBeNull();
    expect(first?.status).toBe(200);
    const firstPayload = (await first!.json()) as any;
    expect(firstPayload.reconcile).toMatchObject({
      eventId,
      version: 1,
      status: 'SUCCEEDED',
      blockingIssues: 0,
      canonicalResults: 1,
      allRoomsClosed: true,
      eventStatus: 'READY_TO_PUBLISH',
    });
    expect(sqlite.prepare(`
      SELECT event_id, room_id, student_id, original_class_id, live_exam_session_id,
             live_exam_participant_id, score, correct_count, time_taken, status
      FROM competition_school_exam_results WHERE event_id = ? AND student_id = 'student-1'
    `).get(eventId)).toEqual({
      event_id: eventId,
      room_id: roomId,
      student_id: 'student-1',
      original_class_id: 'class-4a',
      live_exam_session_id: liveExamId,
      live_exam_participant_id: 'participant-1',
      score: 90,
      correct_count: 9,
      time_taken: 120,
      status: 'RECONCILED',
    });
    expect(sqlite.prepare('SELECT status FROM competition_school_exam_events WHERE id = ?').get(eventId))
      .toEqual({ status: 'READY_TO_PUBLISH' });

    const replay = await request(`/api/school-exams/${eventId}/reconcile`, 'POST', {
      eventId,
      requestId: 'reconcile-closed-0001',
    });
    expect(replay?.status).toBe(200);
    expect(((await replay!.json()) as any).reconcile).toMatchObject({
      id: firstPayload.reconcile.id,
      version: 1,
    });
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM competition_school_exam_reconcile_runs WHERE event_id = ?')
      .get(eventId)).toEqual({ count: 1 });
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM competition_school_exam_results WHERE event_id = ?')
      .get(eventId)).toEqual({ count: 1 });

    const rerun = await request(`/api/school-exams/${eventId}/reconcile`, 'POST', {
      eventId,
      requestId: 'reconcile-closed-0002',
    });
    expect(rerun?.status).toBe(200);
    expect(((await rerun!.json()) as any).reconcile).toMatchObject({ version: 2, status: 'SUCCEEDED' });
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM competition_school_exam_reconcile_runs WHERE event_id = ?')
      .get(eventId)).toEqual({ count: 2 });
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM competition_school_exam_results WHERE event_id = ?')
      .get(eventId)).toEqual({ count: 1 });

    const latest = await request(`/api/school-exams/${eventId}/reconcile`);
    expect(latest?.status).toBe(200);
    expect(((await latest!.json()) as any).reconcile).toMatchObject({ version: 2, blockingIssues: 0 });
    expect(sqlite.prepare(`
      SELECT live_exam_id, student_id, submitted_at, answers, score, correct_count, wrong_count, rank
      FROM live_exam_participants WHERE id = 'participant-1'
    `).get()).toEqual(rawBefore);
  });

  it('allows only the assigned invigilator to report a student incident and creates a pending retest request with immutable lineage', async () => {
    const original = await createClosedOriginalResult();

    const forbidden = await reportIncident({
      ...original,
      studentId: 'student-1',
      requestId: 'incident-forbidden-0001',
    }, unrelatedTeacherCookie);
    expect(forbidden?.status).toBe(403);

    const response = await reportIncident({
      ...original,
      studentId: 'student-1',
      requestId: 'incident-network-0001',
    });
    expect(response?.status).toBe(201);
    const payload = (await response!.json()) as any;
    expect(payload.incident).toMatchObject({
      eventId: original.eventId,
      roomId: original.roomId,
      studentId: 'student-1',
      reasonCode: 'NETWORK_FAILURE',
      reportedBy: 'teacher-4',
    });
    expect(payload.retest).toMatchObject({
      eventId: original.eventId,
      studentId: 'student-1',
      originalResultId: original.originalResultId,
      incidentId: payload.incident.id,
      reasonCode: 'NETWORK_FAILURE',
      status: 'REQUESTED',
    });
    expect(sqlite.prepare(`
      SELECT reported_by FROM competition_school_exam_incidents WHERE id = ?
    `).get(payload.incident.id)).toEqual({ reported_by: 'teacher-4' });
    expect(sqlite.prepare(`
      SELECT source_result_id FROM competition_school_exam_retests WHERE id = ?
    `).get(payload.retest.id)).toEqual({ source_result_id: original.originalResultId });

    const forbiddenReplay = await reportIncident({
      ...original,
      studentId: 'student-1',
      requestId: 'incident-network-0001',
    }, unrelatedTeacherCookie);
    expect(forbiddenReplay?.status).toBe(403);

    const invalidReason = await request(`/api/school-exams/${original.eventId}/incidents`, 'POST', {
      eventId: original.eventId,
      roomId: original.roomId,
      studentId: 'student-1',
      originalResultId: original.originalResultId,
      reasonCode: 'LOW_SCORE',
      requestId: 'incident-low-score-0001',
    }, invigilatorCookie);
    expect(invalidReason?.status).toBe(400);
  });

  it('allows only Admin to grant a retest and provisions a new withheld Competition Live Exam session with expiry', async () => {
    const original = await createClosedOriginalResult();
    const incidentResponse = await reportIncident({
      ...original,
      studentId: 'student-1',
      requestId: 'incident-grant-0001',
    });
    expect(incidentResponse?.status).toBe(201);
    const { retest } = (await incidentResponse!.json()) as any;
    const grantBody = {
      eventId: original.eventId,
      expiresAt: '2027-06-01T00:00:00.000Z',
      resolution: 'REPLACE_WITH_RETEST',
      requestId: 'retest-grant-network-0001',
    };

    const teacherGrant = await request(
      `/api/school-exams/${original.eventId}/retests/${retest.id}/grant`,
      'POST',
      grantBody,
      invigilatorCookie,
    );
    expect(teacherGrant?.status).toBe(403);

    const adminGrant = await request(
      `/api/school-exams/${original.eventId}/retests/${retest.id}/grant`,
      'POST',
      grantBody,
    );
    expect(adminGrant?.status).toBe(201);
    const granted = ((await adminGrant!.json()) as any).retest;
    expect(granted).toMatchObject({
      id: retest.id,
      eventId: original.eventId,
      studentId: 'student-1',
      originalResultId: original.originalResultId,
      incidentId: expect.any(String),
      reasonCode: 'NETWORK_FAILURE',
      reasonText: 'Network dropped during submission',
      grantedBy: 'admin',
      grantedAt: expect.any(String),
      expiresAt: '2027-06-01T00:00:00.000Z',
      status: 'PROVISIONED',
      resolution: 'REPLACE_WITH_RETEST',
      liveExamSessionId: expect.any(String),
    });
    expect(granted.liveExamSessionId).not.toBe(original.originalSessionId);
    expect(sqlite.prepare(`
      SELECT participant_scope_type, participant_scope_id, result_visibility, class_id, status
      FROM live_exam_sessions WHERE id = ?
    `).get(granted.liveExamSessionId)).toEqual({
      participant_scope_type: 'SCHOOL_EXAM_ROOM',
      participant_scope_id: original.roomId,
      result_visibility: 'WITHHELD',
      class_id: null,
      status: 'scheduled',
    });
    expect(sqlite.prepare(`
      SELECT id FROM competition_school_exam_results WHERE id = ?
    `).get(original.originalResultId)).toEqual({ id: original.originalResultId });
    expect(sqlite.prepare(`
      SELECT id FROM live_exam_participants WHERE id = ?
    `).get(original.participantId)).toEqual({ id: original.participantId });
  });

  it.each([
    ['KEEP_ORIGINAL', 90, 'RECONCILED'],
    ['REPLACE_WITH_RETEST', 95, 'RECONCILED'],
    ['INVALIDATE_RESULT', 90, 'VOID'],
  ] as const)('reconciles a completed retest with %s without deleting the original result', async (
    resolution,
    expectedScore,
    expectedStatus,
  ) => {
    const original = await createClosedOriginalResult();
    const incidentResponse = await reportIncident({
      ...original,
      studentId: 'student-1',
      requestId: `incident-resolution-${resolution.toLowerCase()}-0001`,
    });
    expect(incidentResponse?.status).toBe(201);
    const { retest } = (await incidentResponse!.json()) as any;
    const grantResponse = await request(
      `/api/school-exams/${original.eventId}/retests/${retest.id}/grant`,
      'POST',
      {
        eventId: original.eventId,
        expiresAt: '2027-06-01T00:00:00.000Z',
        resolution,
        requestId: `grant-resolution-${resolution.toLowerCase()}-0001`,
      },
    );
    expect(grantResponse?.status).toBe(201);
    const granted = ((await grantResponse!.json()) as any).retest;

    sqlite.prepare(`
      UPDATE live_exam_sessions
      SET status = 'closed', started_at = ?, closed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      '2027-05-11T01:00:00.000Z',
      '2027-05-11T01:03:00.000Z',
      '2027-05-11T01:03:00.000Z',
      granted.liveExamSessionId,
    );
    sqlite.prepare(`
      INSERT INTO live_exam_participants (
        id, live_exam_id, student_id, username, joined_at, started_at, submitted_at,
        answers, score, correct_count, wrong_count, rank, created_at, updated_at
      ) VALUES (?, ?, 'student-1', 'student1', ?, ?, ?, '{}', 95, 10, 0, 1, ?, ?)
    `).run(
      `participant-retest-${resolution}`,
      granted.liveExamSessionId,
      '2027-05-11T00:59:00.000Z',
      '2027-05-11T01:00:00.000Z',
      '2027-05-11T01:02:00.000Z',
      '2027-05-11T00:59:00.000Z',
      '2027-05-11T01:02:00.000Z',
    );

    const reconcile = await request(`/api/school-exams/${original.eventId}/reconcile`, 'POST', {
      eventId: original.eventId,
      requestId: `reconcile-resolution-${resolution.toLowerCase()}-0001`,
    });
    expect(reconcile?.status).toBe(200);
    const reconciled = ((await reconcile!.json()) as any).reconcile;
    expect(reconciled).toMatchObject({ status: 'SUCCEEDED', blockingIssues: 0, eventStatus: 'READY_TO_PUBLISH' });
    expect(reconciled.issues.map((issue: any) => issue.issueType)).not.toContain('RETEST_PENDING');

    const canonical = sqlite.prepare(`
      SELECT id, score, status, live_exam_session_id, retest_id, resolution
      FROM competition_school_exam_results WHERE event_id = ? AND student_id = 'student-1'
    `).get(original.eventId) as any;
    expect(canonical).toMatchObject({
      id: original.originalResultId,
      score: expectedScore,
      status: expectedStatus,
      resolution,
    });
    if (resolution === 'REPLACE_WITH_RETEST') {
      expect(canonical.live_exam_session_id).toBe(granted.liveExamSessionId);
      expect(canonical.retest_id).toBe(retest.id);
      expect(sqlite.prepare(`
        SELECT canonical_result_id, score, disposition
        FROM competition_school_exam_result_history
        WHERE canonical_result_id = ? AND retest_id = ?
      `).get(original.originalResultId, retest.id)).toEqual({
        canonical_result_id: original.originalResultId,
        score: 90,
        disposition: 'SUPERSEDED',
      });
    } else {
      expect(canonical.live_exam_session_id).toBe(original.originalSessionId);
    }
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM competition_school_exam_results WHERE id = ?`)
      .get(original.originalResultId)).toEqual({ count: 1 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM live_exam_participants WHERE id = ?`)
      .get(original.participantId)).toEqual({ count: 1 });
  });

  it('forbids deleting a canonical school-exam result at the database boundary', async () => {
    const original = await createClosedOriginalResult();
    expect(() => sqlite.prepare('DELETE FROM competition_school_exam_results WHERE id = ?').run(original.originalResultId))
      .toThrow(/SCHOOL_EXAM_RESULT_DELETE_FORBIDDEN/);
    expect(sqlite.prepare('SELECT id FROM competition_school_exam_results WHERE id = ?').get(original.originalResultId))
      .toEqual({ id: original.originalResultId });
  });

  it('blocks publication until all required rooms are closed and the latest reconcile has zero blocking issues', async () => {
    const eventId = await createEvent();
    await createRoom(eventId, 'PUB-BLOCK', ['student-1']);
    await provisionEvent(eventId);

    const reconcile = await request(`/api/school-exams/${eventId}/reconcile`, 'POST', {
      eventId,
      requestId: 'reconcile-publish-blocked-0001',
    });
    expect(reconcile?.status).toBe(200);
    expect(((await reconcile!.json()) as any).reconcile.blockingIssues).toBeGreaterThan(0);
    expect(() => sqlite.prepare(`
      UPDATE live_exam_sessions SET result_visibility = 'PUBLISHED'
      WHERE participant_scope_type = 'SCHOOL_EXAM_ROOM' AND participant_scope_id IN (
        SELECT id FROM competition_school_exam_rooms WHERE event_id = ?
      )
    `).run(eventId)).toThrow(/LIVE_EXAM_SCOPE_VISIBILITY_INVALID/);

    const publish = await request(`/api/school-exams/${eventId}/publish`, 'POST', {
      eventId,
      requestId: 'publish-blocked-0001',
    });
    expect(publish?.status).toBe(409);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM competition_school_exam_publications WHERE event_id = ?')
      .get(eventId)).toEqual({ count: 0 });
    expect(sqlite.prepare(`
      SELECT COUNT(*) AS count FROM live_exam_sessions
      WHERE participant_scope_type = 'SCHOOL_EXAM_ROOM' AND participant_scope_id IN (
        SELECT id FROM competition_school_exam_rooms WHERE event_id = ?
      ) AND result_visibility = 'PUBLISHED'
    `).get(eventId)).toEqual({ count: 0 });
  });

  it('publishes an immutable versioned result snapshot and ranks only published results with official ties', async () => {
    const ready = await createReadyRankingEvent();
    const unpublishedRankings = await request(`/api/school-exams/${ready.eventId}/rankings?scope=EVENT`);
    expect(unpublishedRankings?.status).toBe(404);
    const teacherPublish = await request(`/api/school-exams/${ready.eventId}/publish`, 'POST', {
      eventId: ready.eventId,
      requestId: 'publish-ranking-teacher-0001',
    }, invigilatorCookie);
    expect(teacherPublish?.status).toBe(403);
    const publish = await request(`/api/school-exams/${ready.eventId}/publish`, 'POST', {
      eventId: ready.eventId,
      requestId: 'publish-ranking-0001',
    });
    expect(publish?.status, await publish?.clone().text()).toBe(201);
    const publication = ((await publish!.json()) as any).publication;
    expect(publication).toMatchObject({
      eventId: ready.eventId,
      publicationVersion: 1,
      rankingVersion: 1,
      resultDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      publishedAt: expect.any(String),
      publishedBy: 'admin',
    });
    expect(sqlite.prepare('SELECT status FROM competition_school_exam_events WHERE id = ?').get(ready.eventId))
      .toEqual({ status: 'PUBLISHED' });
    expect(sqlite.prepare('SELECT result_visibility FROM live_exam_sessions WHERE id = ?').get(ready.liveExamSessionId))
      .toEqual({ result_visibility: 'PUBLISHED' });

    const eventRanking = await request(`/api/school-exams/${ready.eventId}/rankings?scope=EVENT`);
    expect(eventRanking?.status).toBe(200);
    expect(((await eventRanking!.json()) as any).rankings).toMatchObject({
      eventId: ready.eventId,
      publicationVersion: 1,
      rankingVersion: 1,
      scope: 'EVENT',
      items: [
        expect.objectContaining({ studentId: 'student-2', score: 95, correctCount: 9, timeTaken: 100, rank: 1 }),
        expect.objectContaining({ studentId: 'student-1', score: 95, correctCount: 9, timeTaken: 120, rank: 2 }),
        expect.objectContaining({ studentId: 'student-4', score: 95, correctCount: 9, timeTaken: 120, rank: 2 }),
      ],
    });

    const gradeRanking = await request(`/api/school-exams/${ready.eventId}/rankings?scope=GRADE&gradeLevel=4`);
    expect(gradeRanking?.status).toBe(200);
    expect(((await gradeRanking!.json()) as any).rankings.items.map((item: any) => [item.studentId, item.rank]))
      .toEqual([['student-2', 1], ['student-1', 2], ['student-4', 2]]);

    const classRanking = await request(`/api/school-exams/${ready.eventId}/rankings?scope=CLASS&classId=class-4a`);
    expect(classRanking?.status).toBe(200);
    expect(((await classRanking!.json()) as any).rankings.items.map((item: any) => [item.studentId, item.rank]))
      .toEqual([['student-1', 1], ['student-4', 1]]);
  });

  it('creates a new immutable publication version after a correction without mutating the prior snapshot', async () => {
    const ready = await createReadyRankingEvent();
    const first = await request(`/api/school-exams/${ready.eventId}/publish`, 'POST', {
      eventId: ready.eventId,
      requestId: 'publish-correction-v1-0001',
    });
    expect(first?.status, await first?.clone().text()).toBe(201);
    const firstPublication = ((await first!.json()) as any).publication;
    const firstSnapshot = sqlite.prepare(`
      SELECT score, rank_event FROM competition_school_exam_publication_results
      WHERE event_id = ? AND publication_version = 1 AND student_id = 'student-1'
    `).get(ready.eventId);
    expect(firstSnapshot).toEqual({ score: 95, rank_event: 2 });

    sqlite.prepare(`
      UPDATE competition_school_exam_results
      SET score = 99, correct_count = 10, status = 'RECONCILED', rank = NULL, published_at = NULL
      WHERE event_id = ? AND student_id = 'student-1'
    `).run(ready.eventId);
    sqlite.prepare(`UPDATE competition_school_exam_events SET status = 'READY_TO_PUBLISH' WHERE id = ?`).run(ready.eventId);
    sqlite.prepare(`
      UPDATE live_exam_sessions SET result_visibility = 'WITHHELD'
      WHERE participant_scope_type = 'SCHOOL_EXAM_ROOM' AND participant_scope_id IN (
        SELECT id FROM competition_school_exam_rooms WHERE event_id = ?
      )
    `).run(ready.eventId);

    const second = await request(`/api/school-exams/${ready.eventId}/publish`, 'POST', {
      eventId: ready.eventId,
      requestId: 'publish-correction-v2-0001',
    });
    expect(second?.status).toBe(201);
    const secondPublication = ((await second!.json()) as any).publication;
    expect(secondPublication).toMatchObject({ publicationVersion: 2, rankingVersion: 2 });
    expect(secondPublication.resultDigest).not.toBe(firstPublication.resultDigest);
    expect(sqlite.prepare(`
      SELECT score, rank_event FROM competition_school_exam_publication_results
      WHERE event_id = ? AND publication_version = 1 AND student_id = 'student-1'
    `).get(ready.eventId)).toEqual(firstSnapshot);
    expect(sqlite.prepare(`
      SELECT score, rank_event FROM competition_school_exam_publication_results
      WHERE event_id = ? AND publication_version = 2 AND student_id = 'student-1'
    `).get(ready.eventId)).toEqual({ score: 99, rank_event: 1 });
    expect(sqlite.prepare(`SELECT COUNT(*) AS count FROM competition_school_exam_publications WHERE event_id = ?`)
      .get(ready.eventId)).toEqual({ count: 2 });
    expect(() => sqlite.prepare(`
      UPDATE competition_school_exam_publications SET result_digest = 'tampered'
      WHERE event_id = ? AND version = 1
    `).run(ready.eventId)).toThrow(/SCHOOL_EXAM_PUBLICATION_IMMUTABLE/);
  });

  it('creates real class certificate batches from an exact published ranking snapshot without fake classes', async () => {
    const ready = await createReadyRankingEvent();
    const published = await request(`/api/school-exams/${ready.eventId}/publish`, 'POST', {
      eventId: ready.eventId,
      requestId: 'publish-certificates-0001',
    });
    expect(published?.status).toBe(201);

    const response = await request(`/api/school-exams/${ready.eventId}/certificates`, 'POST', {
      eventId: ready.eventId,
      publicationVersion: 1,
      rankingVersion: 1,
      winnerStudentIds: ['student-1', 'student-2', 'student-4'],
      templateId: 'template-competition',
      title: 'Competition Winners',
      achievementPrefix: 'Đạt thành tích xuất sắc',
      requestId: 'certificate-winners-0001',
    });
    expect(response?.status).toBe(201);
    const payload = (await response!.json()) as any;
    expect(payload.certificateBatch).toMatchObject({
      eventId: ready.eventId,
      publicationVersion: 1,
      rankingVersion: 1,
      status: 'QUEUED',
      winnerCount: 3,
      batchCount: 2,
      batches: [
        expect.objectContaining({ originalClassId: 'class-4a', winnerCount: 2, certificateBatchId: expect.any(String) }),
        expect.objectContaining({ originalClassId: 'class-4b', winnerCount: 1, certificateBatchId: expect.any(String) }),
      ],
    });
    expect(sqlite.prepare(`
      SELECT class_id, COUNT(*) AS count FROM certificate_batches GROUP BY class_id ORDER BY class_id
    `).all()).toEqual([
      { class_id: 'class-4a', count: 1 },
      { class_id: 'class-4b', count: 1 },
    ]);
    expect(sqlite.prepare(`
      SELECT cb.class_id, GROUP_CONCAT(c.student_id, ',') AS students
      FROM certificate_batches cb
      JOIN certificates c ON c.batch_id = cb.id
      GROUP BY cb.class_id ORDER BY cb.class_id
    `).all()).toEqual([
      { class_id: 'class-4a', students: 'student-1,student-4' },
      { class_id: 'class-4b', students: 'student-2' },
    ]);
    expect(sqlite.prepare(`
      SELECT original_class_id, winner_count, certificate_batch_id
      FROM competition_school_exam_certificate_batch_items
      WHERE parent_id = ? ORDER BY original_class_id
    `).all(payload.certificateBatch.id)).toEqual([
      { original_class_id: 'class-4a', winner_count: 2, certificate_batch_id: payload.certificateBatch.batches[0].certificateBatchId },
      { original_class_id: 'class-4b', winner_count: 1, certificate_batch_id: payload.certificateBatch.batches[1].certificateBatchId },
    ]);
    expect(env.CERTIFICATE_QUEUE.send).toHaveBeenCalledTimes(2);

    const replay = await request(`/api/school-exams/${ready.eventId}/certificates`, 'POST', {
      eventId: ready.eventId,
      publicationVersion: 1,
      rankingVersion: 1,
      winnerStudentIds: ['student-1', 'student-2', 'student-4'],
      templateId: 'template-competition',
      title: 'Competition Winners',
      achievementPrefix: 'Đạt thành tích xuất sắc',
      requestId: 'certificate-winners-0001',
    });
    expect(replay?.status).toBe(200);
    expect(((await replay!.json()) as any).certificateBatch.id).toBe(payload.certificateBatch.id);
    expect(env.CERTIFICATE_QUEUE.send).toHaveBeenCalledTimes(2);
  });

  it('rejects certificate winners that are not in the requested immutable publication version', async () => {
    const ready = await createReadyRankingEvent();
    expect((await request(`/api/school-exams/${ready.eventId}/publish`, 'POST', {
      eventId: ready.eventId,
      requestId: 'publish-certificates-invalid-winner-0001',
    }))?.status).toBe(201);

    const response = await request(`/api/school-exams/${ready.eventId}/certificates`, 'POST', {
      eventId: ready.eventId,
      publicationVersion: 1,
      rankingVersion: 1,
      winnerStudentIds: ['student-3'],
      templateId: 'template-competition',
      title: 'Competition Winners',
      requestId: 'certificate-invalid-winner-0001',
    });
    expect(response?.status).toBe(409);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM certificate_batches').get()).toEqual({ count: 0 });
    expect(env.CERTIFICATE_QUEUE.send).not.toHaveBeenCalled();
  });

  it('keeps the immutable publication published when the certificate queue is unavailable', async () => {
    const ready = await createReadyRankingEvent();
    expect((await request(`/api/school-exams/${ready.eventId}/publish`, 'POST', {
      eventId: ready.eventId,
      requestId: 'publish-certificates-queue-failure-0001',
    }))?.status).toBe(201);
    delete (env as any).CERTIFICATE_QUEUE;

    const response = await request(`/api/school-exams/${ready.eventId}/certificates`, 'POST', {
      eventId: ready.eventId,
      publicationVersion: 1,
      rankingVersion: 1,
      winnerStudentIds: ['student-2'],
      templateId: 'template-competition',
      title: 'Competition Winners',
      requestId: 'certificate-queue-failure-0001',
    });
    expect(response?.status).toBe(503);
    expect(sqlite.prepare(`
      SELECT status, version, ranking_version FROM competition_school_exam_publications
      WHERE event_id = ? AND version = 1
    `).get(ready.eventId)).toEqual({ status: 'PUBLISHED', version: 1, ranking_version: 1 });
    expect(sqlite.prepare('SELECT status FROM competition_school_exam_events WHERE id = ?').get(ready.eventId))
      .toEqual({ status: 'PUBLISHED' });
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM certificate_batches').get()).toEqual({ count: 0 });
  });

  it('returns a service failure without reverting publication when certificate queue delivery throws', async () => {
    const ready = await createReadyRankingEvent();
    expect((await request(`/api/school-exams/${ready.eventId}/publish`, 'POST', {
      eventId: ready.eventId,
      requestId: 'publish-certificates-queue-throw-0001',
    }))?.status).toBe(201);
    env.CERTIFICATE_QUEUE.send.mockRejectedValueOnce(new Error('queue transport down'));

    const response = await request(`/api/school-exams/${ready.eventId}/certificates`, 'POST', {
      eventId: ready.eventId,
      publicationVersion: 1,
      rankingVersion: 1,
      winnerStudentIds: ['student-2'],
      templateId: 'template-competition',
      title: 'Competition Winners',
      requestId: 'certificate-queue-throw-0001',
    });
    expect(response?.status).toBe(503);
    expect(sqlite.prepare(`
      SELECT status FROM competition_school_exam_certificate_batches
      WHERE event_id = ? AND request_id = 'certificate-queue-throw-0001'
    `).get(ready.eventId)).toEqual({ status: 'FAILED' });
    expect(sqlite.prepare(`
      SELECT status FROM competition_school_exam_publications WHERE event_id = ? AND version = 1
    `).get(ready.eventId)).toEqual({ status: 'PUBLISHED' });
    expect(sqlite.prepare('SELECT status FROM competition_school_exam_events WHERE id = ?').get(ready.eventId))
      .toEqual({ status: 'PUBLISHED' });
  });

  it('persists the full blocking issue taxonomy and withholds publication when reconciliation is not clean', async () => {
    const eventId = await createEvent();
    const room1Id = await createRoom(eventId, 'R1', ['student-1']);
    const room2Id = await createRoom(eventId, 'R2', ['student-2']);
    await provisionEvent(eventId);
    const rooms = sqlite.prepare(`
      SELECT id, live_exam_session_id FROM competition_school_exam_rooms WHERE event_id = ? ORDER BY room_code
    `).all(eventId) as Array<{ id: string; live_exam_session_id: string }>;
    const room1Session = rooms.find((room) => room.id === room1Id)!.live_exam_session_id;
    const room2Session = rooms.find((room) => room.id === room2Id)!.live_exam_session_id;
    sqlite.prepare(`UPDATE live_exam_sessions SET status = 'active', updated_at = ? WHERE id = ?`)
      .run('2027-05-10T01:03:00.000Z', room1Session);
    sqlite.prepare(`UPDATE live_exam_sessions SET status = 'closed', closed_at = ?, updated_at = ? WHERE id = ?`)
      .run('2027-05-10T01:03:00.000Z', '2027-05-10T01:03:00.000Z', room2Session);

    sqlite.prepare(`
      INSERT INTO competition_school_exam_members (
        id, event_id, room_id, student_id, original_class_id, eligibility_snapshot_version,
        status, assigned_at, updated_at
      ) VALUES ('member-score-missing', ?, ?, 'student-3', 'class-4a', 1, 'ASSIGNED', ?, ?)
    `).run(eventId, room1Id, '2027-05-10T00:50:00.000Z', '2027-05-10T00:50:00.000Z');
    sqlite.exec(`
      INSERT INTO students (id, full_name, username, password_hash, class_id, created_at)
      VALUES ('student-5', 'Em', 'student5', 'hash', 'class-4a', '2026-08-01T00:00:00.000Z');
    `);
    const participantInsert = sqlite.prepare(`
      INSERT INTO live_exam_participants (
        id, live_exam_id, student_id, username, joined_at, started_at, submitted_at,
        answers, score, correct_count, wrong_count, rank, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, ?)
    `);
    participantInsert.run(
      'participant-student2-room2', room2Session, 'student-2', 'student2',
      '2027-05-10T00:59:00.000Z', '2027-05-10T01:00:00.000Z', null,
      null, null, null, null, '2027-05-10T00:59:00.000Z', '2027-05-10T01:01:00.000Z',
    );
    participantInsert.run(
      'participant-student2-room1', room1Session, 'student-2', 'student2',
      '2027-05-10T00:59:00.000Z', '2027-05-10T01:00:00.000Z', '2027-05-10T01:02:00.000Z',
      70, 7, 3, 1, '2027-05-10T00:59:00.000Z', '2027-05-10T01:02:00.000Z',
    );
    participantInsert.run(
      'participant-score-missing', room1Session, 'student-3', 'student3',
      '2027-05-10T00:59:00.000Z', '2027-05-10T01:00:00.000Z', '2027-05-10T01:02:00.000Z',
      null, 8, 2, 2, '2027-05-10T00:59:00.000Z', '2027-05-10T01:02:00.000Z',
    );
    participantInsert.run(
      'participant-room-mismatch', room1Session, 'student-5', 'student5',
      '2027-05-10T00:59:00.000Z', '2027-05-10T01:00:00.000Z', '2027-05-10T01:02:00.000Z',
      80, 8, 2, 1, '2027-05-10T00:59:00.000Z', '2027-05-10T01:02:00.000Z',
    );
    sqlite.prepare(`
      INSERT INTO competition_school_exam_retests (
        id, event_id, student_id, reason, status, requested_by, requested_at
      ) VALUES ('retest-pending-1', ?, 'student-1', 'Network incident', 'REQUESTED', 'admin', ?)
    `).run(eventId, '2027-05-10T01:04:00.000Z');

    const response = await request(`/api/school-exams/${eventId}/reconcile`, 'POST', {
      eventId,
      requestId: 'reconcile-blocked-0001',
    });
    expect(response?.status).toBe(200);
    const reconcile = ((await response!.json()) as any).reconcile;
    expect(reconcile).toMatchObject({
      version: 1,
      status: 'BLOCKED',
      eventStatus: 'WITHHELD',
      allRoomsClosed: false,
    });
    expect(reconcile.blockingIssues).toBeGreaterThan(0);
    expect([...new Set(reconcile.issues.map((issue: any) => issue.issueType))].sort()).toEqual([
      'DUPLICATE_RESULT',
      'EXAM_NOT_CLOSED',
      'MISSING_PARTICIPANT',
      'MISSING_SUBMISSION',
      'RETEST_PENDING',
      'ROOM_MEMBER_MISMATCH',
      'SCORE_MISSING',
    ]);
    expect(sqlite.prepare('SELECT status FROM competition_school_exam_events WHERE id = ?').get(eventId))
      .toEqual({ status: 'WITHHELD' });
    expect(sqlite.prepare(`
      SELECT COUNT(*) AS count FROM competition_school_exam_reconcile_issues
      WHERE run_id = ? AND blocking = 1
    `).get(reconcile.id)).toEqual({ count: reconcile.blockingIssues });
  });

  it('queues an idempotent school export from the latest immutable publication without doing XLSX work on the request path', async () => {
    const ready = await createReadyRankingEvent();
    expect((await request(`/api/school-exams/${ready.eventId}/publish`, 'POST', {
      eventId: ready.eventId,
      requestId: 'publish-export-0001',
    }))?.status).toBe(201);

    const response = await request(`/api/school-exams/${ready.eventId}/exports`, 'POST', {
      eventId: ready.eventId,
      scope: 'SCHOOL',
      requestId: 'export-school-0001',
    });
    expect(response?.status).toBe(201);
    const payload = (await response!.json()) as any;
    expect(payload.export).toMatchObject({
      eventId: ready.eventId,
      publicationVersion: 1,
      scope: 'SCHOOL',
      classId: null,
      status: 'QUEUED',
      artifactKey: null,
    });
    expect(env.COMPETITION_EXPORT_QUEUE.send).toHaveBeenCalledTimes(1);
    expect(env.COMPETITION_EXPORT_QUEUE.send).toHaveBeenCalledWith({ exportId: payload.export.id });
    expect(env.COMPETITION_EXPORTS.objects.size).toBe(0);

    const replay = await request(`/api/school-exams/${ready.eventId}/exports`, 'POST', {
      eventId: ready.eventId,
      scope: 'SCHOOL',
      requestId: 'export-school-0001',
    });
    expect(replay?.status).toBe(200);
    expect(((await replay!.json()) as any).export.id).toBe(payload.export.id);
    expect(env.COMPETITION_EXPORT_QUEUE.send).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the export queue is unavailable without changing the published snapshot', async () => {
    const ready = await createReadyRankingEvent();
    expect((await request(`/api/school-exams/${ready.eventId}/publish`, 'POST', {
      eventId: ready.eventId,
      requestId: 'publish-export-queue-unavailable-0001',
    }))?.status).toBe(201);
    delete (env as any).COMPETITION_EXPORT_QUEUE;

    const response = await request(`/api/school-exams/${ready.eventId}/exports`, 'POST', {
      eventId: ready.eventId,
      scope: 'SCHOOL',
      requestId: 'export-queue-unavailable-0001',
    });
    expect(response?.status).toBe(503);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM competition_school_exam_exports WHERE event_id = ?')
      .get(ready.eventId)).toEqual({ count: 0 });
    expect(sqlite.prepare('SELECT status FROM competition_school_exam_publications WHERE event_id = ? AND version = 1')
      .get(ready.eventId)).toEqual({ status: 'PUBLISHED' });
    expect(sqlite.prepare('SELECT status FROM competition_school_exam_events WHERE id = ?').get(ready.eventId))
      .toEqual({ status: 'PUBLISHED' });
  });

  it('marks a queue delivery failure without reverting publication', async () => {
    const ready = await createReadyRankingEvent();
    expect((await request(`/api/school-exams/${ready.eventId}/publish`, 'POST', {
      eventId: ready.eventId,
      requestId: 'publish-export-queue-throw-0001',
    }))?.status).toBe(201);
    env.COMPETITION_EXPORT_QUEUE.send.mockRejectedValueOnce(new Error('queue transport down'));

    const response = await request(`/api/school-exams/${ready.eventId}/exports`, 'POST', {
      eventId: ready.eventId,
      scope: 'SCHOOL',
      requestId: 'export-queue-throw-0001',
    });
    expect(response?.status).toBe(503);
    expect(sqlite.prepare(`
      SELECT status, error_code FROM competition_school_exam_exports
      WHERE event_id = ? AND request_id = ?
    `).get(ready.eventId, 'export-queue-throw-0001')).toEqual({
      status: 'FAILED',
      error_code: 'SCHOOL_EXAM_EXPORT_QUEUE_FAILED',
    });
    expect(sqlite.prepare('SELECT status FROM competition_school_exam_publications WHERE event_id = ? AND version = 1')
      .get(ready.eventId)).toEqual({ status: 'PUBLISHED' });
    expect(sqlite.prepare('SELECT status FROM competition_school_exam_events WHERE id = ?').get(ready.eventId))
      .toEqual({ status: 'PUBLISHED' });
  });

  it('allows teacher exports only for owned original classes and re-authorizes export status reads', async () => {
    const ready = await createReadyRankingEvent();
    expect((await request(`/api/school-exams/${ready.eventId}/publish`, 'POST', {
      eventId: ready.eventId,
      requestId: 'publish-export-teacher-0001',
    }))?.status).toBe(201);

    const schoolScope = await request(`/api/school-exams/${ready.eventId}/exports`, 'POST', {
      eventId: ready.eventId,
      scope: 'SCHOOL',
      requestId: 'export-teacher-school-0001',
    }, invigilatorCookie);
    expect(schoolScope?.status).toBe(403);

    const ownClass = await request(`/api/school-exams/${ready.eventId}/exports`, 'POST', {
      eventId: ready.eventId,
      scope: 'CLASS',
      classId: 'class-4a',
      requestId: 'export-teacher-class-0001',
    }, invigilatorCookie);
    expect(ownClass?.status).toBe(201);
    const exportJob = ((await ownClass!.json()) as any).export;
    expect(exportJob).toMatchObject({ scope: 'CLASS', classId: 'class-4a', status: 'QUEUED' });

    const forbiddenCreate = await request(`/api/school-exams/${ready.eventId}/exports`, 'POST', {
      eventId: ready.eventId,
      scope: 'CLASS',
      classId: 'class-4a',
      requestId: 'export-unrelated-class-0001',
    }, unrelatedTeacherCookie);
    expect(forbiddenCreate?.status).toBe(403);

    const ownStatus = await request(`/api/school-exams/${ready.eventId}/exports/${exportJob.id}`, 'GET', undefined, invigilatorCookie);
    expect(ownStatus?.status).toBe(200);
    const forbiddenStatus = await request(`/api/school-exams/${ready.eventId}/exports/${exportJob.id}`, 'GET', undefined, unrelatedTeacherCookie);
    expect(forbiddenStatus?.status).toBe(403);
  });

  it('processes queued exports into a real multi-sheet XLSX in R2 and re-authorizes downloads', async () => {
    const ready = await createReadyRankingEvent();
    expect((await request(`/api/school-exams/${ready.eventId}/publish`, 'POST', {
      eventId: ready.eventId,
      requestId: 'publish-export-worker-0001',
    }))?.status).toBe(201);

    for (let roundNumber = 1; roundNumber <= 6; roundNumber += 1) {
      sqlite.prepare(`
        INSERT INTO competition_rounds (
          id, campaign_id, round_number, opens_at, closes_at, max_attempts,
          passing_rule_type, passing_score, status, created_at, finalized_at
        ) VALUES (?, 'campaign-1', ?, ?, ?, 2, 'MIN_SCORE', 70, 'FINALIZED', ?, ?)
      `).run(
        `round-${roundNumber}`,
        roundNumber,
        `2027-0${roundNumber}-01T00:00:00.000Z`,
        `2027-0${roundNumber}-02T00:00:00.000Z`,
        `2027-0${roundNumber}-01T00:00:00.000Z`,
        `2027-0${roundNumber}-02T00:00:00.000Z`,
      );
      for (const studentId of ['student-1', 'student-2', 'student-4']) {
        sqlite.prepare(`
          INSERT INTO competition_round_progress (
            campaign_id, round_id, student_id, attempts_used, best_score,
            is_passed, status, version, updated_at
          ) VALUES ('campaign-1', ?, ?, 1, ?, 0, 'IN_PROGRESS', 1, ?)
        `).run(`round-${roundNumber}`, studentId, 80 + roundNumber, `2027-0${roundNumber}-02T00:00:00.000Z`);
      }
    }

    const created = await request(`/api/school-exams/${ready.eventId}/exports`, 'POST', {
      eventId: ready.eventId,
      scope: 'CLASS',
      classId: 'class-4a',
      requestId: 'export-worker-class-0001',
    }, invigilatorCookie);
    expect(created?.status).toBe(201);
    const exportJob = ((await created!.json()) as any).export;

    const processor = processCompetitionExportQueue;
    expect(typeof processor).toBe('function');
    const ack = vi.fn();
    const retry = vi.fn();
    await processor({
      messages: [{ body: { exportId: exportJob.id }, attempts: 1, ack, retry }],
    } as any, env as any, {} as ExecutionContext);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();

    const status = await request(`/api/school-exams/${ready.eventId}/exports/${exportJob.id}`, 'GET', undefined, invigilatorCookie);
    expect(status?.status).toBe(200);
    const completed = ((await status!.json()) as any).export;
    expect(completed).toMatchObject({ status: 'READY', artifactKey: expect.stringMatching(/\.xlsx$/) });

    const download = await request(`/api/school-exams/${ready.eventId}/exports/${exportJob.id}/download`, 'GET', undefined, invigilatorCookie);
    expect(download?.status).toBe(200);
    expect(download?.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const workbook = Buffer.from(await download!.arrayBuffer());
    expect(workbook.subarray(0, 2).toString('ascii')).toBe('PK');
    for (const sheet of ['Tong_hop', 'Vong_1', 'Vong_2', 'Vong_3', 'Vong_4', 'Vong_5', 'Vong_6', 'Thi_cap_truong', 'Metadata']) {
      const rows = await readSheet(workbook, sheet);
      expect(rows.length, sheet).toBeGreaterThan(0);
    }
    const summaryRows = await readSheet(workbook, 'Tong_hop');
    expect(summaryRows.flat()).toContain('student-1');
    expect(summaryRows.flat()).toContain('student-4');
    expect(summaryRows.flat()).not.toContain('student-2');

    const forbiddenDownload = await request(
      `/api/school-exams/${ready.eventId}/exports/${exportJob.id}/download`,
      'GET',
      undefined,
      unrelatedTeacherCookie,
    );
    expect(forbiddenDownload?.status).toBe(403);
  });

  it('retries transient export generation failures without reverting publication', async () => {
    const ready = await createReadyRankingEvent();
    expect((await request(`/api/school-exams/${ready.eventId}/publish`, 'POST', {
      eventId: ready.eventId,
      requestId: 'publish-export-retry-0001',
    }))?.status).toBe(201);
    const created = await request(`/api/school-exams/${ready.eventId}/exports`, 'POST', {
      eventId: ready.eventId,
      scope: 'SCHOOL',
      requestId: 'export-retry-0001',
    });
    expect(created?.status).toBe(201);
    const exportJob = ((await created!.json()) as any).export;
    (env as any).COMPETITION_EXPORTS = {
      put: vi.fn(async () => { throw new Error('temporary r2 outage'); }),
      get: vi.fn(async () => null),
      head: vi.fn(async () => null),
    };

    const processor = processCompetitionExportQueue;
    expect(typeof processor).toBe('function');
    const ack = vi.fn();
    const retry = vi.fn();
    await processor({
      messages: [{ body: { exportId: exportJob.id }, attempts: 1, ack, retry }],
    } as any, env as any, {} as ExecutionContext);
    expect(ack).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(sqlite.prepare(`
      SELECT status, error_code, processing_started_at
      FROM competition_school_exam_exports WHERE id = ?
    `).get(exportJob.id)).toMatchObject({
      status: 'QUEUED',
      error_code: 'SCHOOL_EXAM_EXPORT_GENERATION_FAILED',
      processing_started_at: null,
    });
    const finalAck = vi.fn();
    const finalRetry = vi.fn();
    await processor({
      messages: [{ body: { exportId: exportJob.id }, attempts: 3, ack: finalAck, retry: finalRetry }],
    } as any, env as any, {} as ExecutionContext);
    expect(finalAck).toHaveBeenCalledTimes(1);
    expect(finalRetry).not.toHaveBeenCalled();
    expect(sqlite.prepare(`
      SELECT status, error_code, processing_started_at
      FROM competition_school_exam_exports WHERE id = ?
    `).get(exportJob.id)).toMatchObject({
      status: 'FAILED',
      error_code: 'SCHOOL_EXAM_EXPORT_GENERATION_FAILED',
      processing_started_at: null,
    });
    expect(sqlite.prepare('SELECT status FROM competition_school_exam_publications WHERE event_id = ? AND version = 1')
      .get(ready.eventId)).toEqual({ status: 'PUBLISHED' });
    expect(sqlite.prepare('SELECT status FROM competition_school_exam_events WHERE id = ?').get(ready.eventId))
      .toEqual({ status: 'PUBLISHED' });
  });

  it('recovers a stale PROCESSING export job and completes it from the pinned publication', async () => {
    const ready = await createReadyRankingEvent();
    expect((await request(`/api/school-exams/${ready.eventId}/publish`, 'POST', {
      eventId: ready.eventId,
      requestId: 'publish-export-stale-0001',
    }))?.status).toBe(201);
    const created = await request(`/api/school-exams/${ready.eventId}/exports`, 'POST', {
      eventId: ready.eventId,
      scope: 'SCHOOL',
      requestId: 'export-stale-0001',
    });
    expect(created?.status).toBe(201);
    const exportJob = ((await created!.json()) as any).export;
    sqlite.prepare(`
      UPDATE competition_school_exam_exports
      SET status = 'PROCESSING', processing_started_at = '2000-01-01T00:00:00.000Z'
      WHERE id = ?
    `).run(exportJob.id);

    const ack = vi.fn();
    const retry = vi.fn();
    await processCompetitionExportQueue({
      messages: [{ body: { exportId: exportJob.id }, attempts: 2, ack, retry }],
    } as any, env as any, {} as ExecutionContext);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
    expect(sqlite.prepare(`
      SELECT status, artifact_key, processing_started_at FROM competition_school_exam_exports WHERE id = ?
    `).get(exportJob.id)).toMatchObject({
      status: 'READY',
      artifact_key: expect.stringMatching(/\.xlsx$/),
      processing_started_at: null,
    });
  });
});

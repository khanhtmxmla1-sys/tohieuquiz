// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signJWT } from '../workers/src/utils/jwt';
import { handleCompetitionRoutes } from '../workers/src/routes/competitions';
import { createOrReuseQuizSnapshot } from '../workers/src/competition/quizSnapshotService';
import { createSqliteD1 } from './helpers/sqliteD1';

const migration = readFileSync(
  new URL('../workers/migrations/0069_competition_core.sql', import.meta.url),
  'utf8',
);
const secret = 'competition-route-test-secret-long-enough';

let sqlite: DatabaseSync;
let env: { DB: D1Database; JWT_SECRET: string };
let adminCookie: string;
let teacherCookie: string;
let studentCookie: string;

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
    CREATE TABLE results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT,
      assignment_id TEXT,
      class_id TEXT,
      student_name TEXT,
      class_name TEXT,
      quiz_id TEXT,
      quiz_title TEXT,
      score REAL,
      correct_count INTEGER,
      total_questions INTEGER,
      time_taken INTEGER,
      submitted_at TEXT,
      answers TEXT,
      grading_version TEXT
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

    INSERT INTO teachers (username) VALUES ('admin');
    INSERT INTO teachers (username) VALUES ('teacher-4');
    INSERT INTO teachers (username) VALUES ('teacher-5');

    INSERT INTO classes (id, name, teacher_username, created_at) VALUES
      ('class-4a', '4A', 'teacher-4', '2026-08-01T00:00:00.000Z'),
      ('class-4b', '4B', 'teacher-4', '2026-08-01T00:00:00.000Z'),
      ('class-5a', '5A', 'teacher-5', '2026-08-01T00:00:00.000Z');

    INSERT INTO students (
      id, full_name, username, password_hash, class_id, created_at, archived_at
    ) VALUES
      ('student-1', 'An', 'student1', 'hash', 'class-4a', '2026-08-01T00:00:00.000Z', NULL),
      ('student-2', 'Binh', 'student2', 'hash', 'class-4a', '2026-08-01T00:00:00.000Z', NULL),
      ('student-3', 'Chi', 'student3', 'hash', 'class-4b', '2026-08-01T00:00:00.000Z', NULL),
      ('student-4', 'Dung', 'student4', 'hash', 'class-5a', '2026-08-01T00:00:00.000Z', NULL);

    INSERT INTO quizzes (
      id, title, class_level, category, time_limit, created_at, created_by,
      tags, source_type, version_number, revision, updated_at
    ) VALUES (
      'quiz-round', 'Đề vòng 1 khối 4', '4', 'Tiếng Việt', 30,
      '2026-08-01T00:00:00.000Z', 'admin', '[]', 'manual', 1, 1,
      '2026-08-01T00:00:00.000Z'
    );
    INSERT INTO questions (id, quiz_id, type, question, options, correct_answer)
    VALUES ('q-round-1', 'quiz-round', 'MCQ', '1 + 1 = ?', '1|2', 'B');
  `);
}

async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  cookie = adminCookie,
): Promise<Response> {
  const req = new Request(`https://api.test${path}`, {
    method,
    headers: {
      Cookie: cookie,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await handleCompetitionRoutes(req, env as any, new URL(req.url).pathname, method);
  if (!response) throw new Error(`Route returned null for ${method} ${path}`);
  return response;
}

const createBody = {
  title: 'Competition 2026-2027',
  schoolYear: '2026-2027',
  timezone: 'Asia/Ho_Chi_Minh',
  audienceRule: { gradeLevels: [4], classIds: ['class-4a', 'class-4b'] },
  eligibilityPolicy: { requiredRounds: 6, requiredPassedRounds: 6 },
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: '2027-05-31T23:59:59.000Z',
  requestId: 'req_competition_route_create_0001',
};

async function seedEligibilityProgress(
  campaignId: string,
  options: { failedRoundForStudent1?: number; nonFinalizedRound?: number } = {},
): Promise<void> {
  const quizSnapshot = await createOrReuseQuizSnapshot(env.DB, 'quiz-round');
  const studentIds = ['student-1', 'student-2', 'student-3'];

  for (let roundNumber = 1; roundNumber <= 6; roundNumber += 1) {
    const roundId = `elig-round-${roundNumber}`;
    const finalized = options.nonFinalizedRound !== roundNumber;
    sqlite.prepare(`
      INSERT INTO competition_rounds (
        id, campaign_id, round_number, opens_at, closes_at, max_attempts,
        passing_rule_type, passing_score, status, created_at, finalized_at
      ) VALUES (?, ?, ?, ?, ?, 2, 'MIN_SCORE', 7, ?, ?, ?)
    `).run(
      roundId,
      campaignId,
      roundNumber,
      '2026-09-01T00:00:00.000Z',
      '2026-09-02T00:00:00.000Z',
      finalized ? 'FINALIZED' : 'CLOSED',
      '2026-08-20T00:00:00.000Z',
      finalized ? '2026-09-03T00:00:00.000Z' : null,
    );

    for (const studentId of studentIds) {
      const passed = !(studentId === 'student-1' && options.failedRoundForStudent1 === roundNumber);
      const attemptId = passed ? `elig-attempt-${studentId}-${roundNumber}` : null;
      if (attemptId) {
        sqlite.prepare(`
          INSERT INTO competition_round_attempts (
            id, campaign_id, round_id, student_id, attempt_no, quiz_id,
            quiz_snapshot_id, quiz_snapshot_hash, result_id, status, score,
            correct_count, time_taken, started_at, submitted_at, scored_at,
            voided_at, voided_by, void_reason, idempotency_key
          ) VALUES (?, ?, ?, ?, 1, 'quiz-round', ?, ?, NULL, 'SCORED', 10,
            1, 20, ?, ?, ?, NULL, NULL, NULL, ?)
        `).run(
          attemptId,
          campaignId,
          roundId,
          studentId,
          quizSnapshot.id,
          quizSnapshot.sha256,
          '2026-09-01T00:10:00.000Z',
          '2026-09-01T00:10:20.000Z',
          '2026-09-01T00:10:20.000Z',
          `elig-idempotency-${studentId}-${roundNumber}`,
        );
      }

      sqlite.prepare(`
        INSERT INTO competition_round_progress (
          campaign_id, round_id, student_id, attempts_used, best_attempt_id, best_score,
          is_passed, passed_at, status, version, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(
        campaignId,
        roundId,
        studentId,
        passed ? 1 : 0,
        attemptId,
        passed ? 10 : null,
        passed ? 1 : 0,
        passed ? '2026-09-01T00:10:20.000Z' : null,
        passed ? 'PASSED' : 'NOT_PASSED',
        '2026-09-03T00:00:00.000Z',
      );
    }
  }
}

beforeEach(async () => {
  sqlite = new DatabaseSync(':memory:');
  createBaseSchema(sqlite);
  sqlite.exec(migration);
  env = { DB: createSqliteD1(sqlite), JWT_SECRET: secret };

  const adminToken = await signJWT({
    username: 'admin',
    role: 'admin',
    tokenVersion: 1,
    purpose: 'session',
  }, secret, '30d');
  const teacherToken = await signJWT({
    username: 'teacher-4',
    role: 'teacher',
    tokenVersion: 1,
    purpose: 'session',
  }, secret, '30d');
  const studentToken = await signJWT({
    id: 'student-1',
    username: 'student1',
    role: 'student',
    fullName: 'An',
    classId: 'class-4a',
    tokenVersion: 1,
    purpose: 'session',
  }, secret, '30d');
  adminCookie = `auth_token=${adminToken}`;
  teacherCookie = `auth_token=${teacherToken}`;
  studentCookie = `auth_token=${studentToken}`;
});

afterEach(() => {
  vi.useRealTimers();
  sqlite.close();
});

describe('Competition V1 campaign routes', () => {
  it('exposes create, list, detail, and DRAFT patch endpoints', async () => {
    const createResponse = await request('/api/competitions', 'POST', createBody);
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as any;
    const campaignId = created.campaign.id as string;

    const listResponse = await request('/api/competitions');
    expect(listResponse.status).toBe(200);
    const listed = await listResponse.json() as any;
    expect(listed.items.map((item: any) => item.id)).toContain(campaignId);

    const detailResponse = await request(`/api/competitions/${campaignId}`);
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json() as any;
    expect(detail.campaign).toMatchObject({ id: campaignId, title: createBody.title });

    const patchResponse = await request(`/api/competitions/${campaignId}`, 'PATCH', {
      title: 'Competition 2026-2027 Updated',
      requestId: 'req_competition_route_patch_0001',
    });
    expect(patchResponse.status).toBe(200);
    const patched = await patchResponse.json() as any;
    expect(patched.campaign.title).toBe('Competition 2026-2027 Updated');
  });

  it('exposes audience preview, freeze, and cursor list endpoints', async () => {
    const createResponse = await request('/api/competitions', 'POST', createBody);
    const created = await createResponse.json() as any;
    const campaignId = created.campaign.id as string;

    const previewResponse = await request(`/api/competitions/${campaignId}/audience/preview`, 'POST', {
      requestId: 'req_competition_route_preview_0001',
    });
    expect(previewResponse.status).toBe(200);
    const preview = await previewResponse.json() as any;
    expect(preview.preview).toMatchObject({ matchedCount: 3 });

    const snapshotResponse = await request(`/api/competitions/${campaignId}/audience/snapshot`, 'POST', {
      requestId: 'req_competition_route_snapshot_0001',
    });
    expect(snapshotResponse.status).toBe(201);
    const snapshot = await snapshotResponse.json() as any;
    expect(snapshot.snapshot).toMatchObject({ status: 'LOCKED', memberCount: 3 });

    const firstPageResponse = await request(`/api/competitions/${campaignId}/audience?limit=2`);
    expect(firstPageResponse.status).toBe(200);
    const firstPage = await firstPageResponse.json() as any;
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    const secondPageResponse = await request(
      `/api/competitions/${campaignId}/audience?limit=2&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
    );
    expect(secondPageResponse.status).toBe(200);
    const secondPage = await secondPageResponse.json() as any;
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
  });

  it('rejects teacher mutations while allowing staff reads', async () => {
    const forbidden = await request('/api/competitions', 'POST', createBody, teacherCookie);
    expect(forbidden.status).toBe(403);

    const createResponse = await request('/api/competitions', 'POST', createBody);
    const created = await createResponse.json() as any;
    const campaignId = created.campaign.id as string;

    const listResponse = await request('/api/competitions', 'GET', undefined, teacherCookie);
    expect(listResponse.status).toBe(200);

    const detailResponse = await request(`/api/competitions/${campaignId}`, 'GET', undefined, teacherCookie);
    expect(detailResponse.status).toBe(200);
  });

  it('exposes round list/config/finalize endpoints with Admin mutation guards', async () => {
    const createResponse = await request('/api/competitions', 'POST', createBody);
    const campaignId = (await createResponse.json() as any).campaign.id as string;
    const roundBody = {
      campaignId,
      roundId: 'round-route-1',
      roundNumber: 1,
      opensAt: '2026-09-10T00:00:00.000Z',
      closesAt: '2026-09-11T00:00:00.000Z',
      maxAttempts: 2,
      passingRuleType: 'MIN_SCORE',
      passingScore: 7,
      requestId: 'round-route-config-0001',
    };

    const patch = await request(`/api/competitions/${campaignId}/rounds/round-route-1`, 'PATCH', roundBody);
    expect(patch.status).toBe(200);
    expect((await patch.json() as any).round).toMatchObject({ roundNumber: 1, status: 'SCHEDULED' });

    const teacherPatch = await request(
      `/api/competitions/${campaignId}/rounds/round-route-1`,
      'PATCH',
      { ...roundBody, requestId: 'round-route-config-0002' },
      teacherCookie,
    );
    expect(teacherPatch.status).toBe(403);

    const list = await request(`/api/competitions/${campaignId}/rounds`, 'GET', undefined, teacherCookie);
    expect(list.status).toBe(200);
    const listedRounds = (await list.json() as any).items;
    expect(listedRounds).toHaveLength(1);
    expect(listedRounds[0].quizSnapshot).toEqual({ status: 'MISSING', mappingCount: 0 });

    const tooEarly = await request(
      `/api/competitions/${campaignId}/rounds/round-route-1/finalize`,
      'POST',
      { campaignId, roundId: 'round-route-1', requestId: 'round-route-finalize-0001' },
    );
    expect(tooEarly.status).toBe(409);
  });

  it('lets Admin map an immutable quiz snapshot by grade or class while Teacher remains read-only', async () => {
    const createResponse = await request('/api/competitions', 'POST', createBody);
    const campaignId = (await createResponse.json() as any).campaign.id as string;
    const roundBody = {
      campaignId,
      roundId: 'round-mapping-1',
      roundNumber: 1,
      opensAt: '2026-09-10T00:00:00.000Z',
      closesAt: '2026-09-11T00:00:00.000Z',
      maxAttempts: 2,
      passingRuleType: 'MIN_SCORE',
      passingScore: 7,
      requestId: 'round-mapping-config-0001',
    };
    expect((await request(`/api/competitions/${campaignId}/rounds/round-mapping-1`, 'PATCH', roundBody)).status)
      .toBe(200);

    const mappingBody = {
      campaignId,
      roundId: 'round-mapping-1',
      gradeLevel: 4,
      quizId: 'quiz-round',
      requestId: 'round-mapping-upsert-0001',
    };
    const mapped = await request(
      `/api/competitions/${campaignId}/rounds/round-mapping-1/quizzes`,
      'PUT',
      mappingBody,
    );
    expect(mapped.status).toBe(200);
    const mappedBody = await mapped.json() as any;
    expect(mappedBody.mapping).toMatchObject({
      roundId: 'round-mapping-1',
      gradeLevel: 4,
      classId: null,
      quizId: 'quiz-round',
      quizSnapshotId: expect.any(String),
      quizSnapshotHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });

    const remapped = await request(
      `/api/competitions/${campaignId}/rounds/round-mapping-1/quizzes`,
      'PUT',
      { ...mappingBody, requestId: 'round-mapping-upsert-0002' },
    );
    expect(remapped.status).toBe(200);
    expect((await remapped.json() as any).mapping.id).toBe(mappedBody.mapping.id);

    const classMapping = await request(
      `/api/competitions/${campaignId}/rounds/round-mapping-1/quizzes`,
      'PUT',
      { ...mappingBody, classId: 'class-4a', requestId: 'round-mapping-upsert-0003' },
    );
    expect(classMapping.status).toBe(200);
    expect((await classMapping.json() as any).mapping).toMatchObject({ gradeLevel: 4, classId: 'class-4a' });

    const teacherMutation = await request(
      `/api/competitions/${campaignId}/rounds/round-mapping-1/quizzes`,
      'PUT',
      { ...mappingBody, classId: 'class-4b', requestId: 'round-mapping-upsert-0004' },
      teacherCookie,
    );
    expect(teacherMutation.status).toBe(403);

    const listed = await request(`/api/competitions/${campaignId}/rounds`, 'GET', undefined, teacherCookie);
    expect(listed.status).toBe(200);
    expect((await listed.json() as any).items[0]).toMatchObject({
      quizSnapshot: { status: 'LOCKED', mappingCount: 2 },
    });
    expect((await (await request(`/api/competitions/${campaignId}/rounds`, 'GET')).json() as any).items[0].quizMappings)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ gradeLevel: 4, classId: null, quizId: 'quiz-round' }),
        expect.objectContaining({ gradeLevel: 4, classId: 'class-4a', quizId: 'quiz-round' }),
      ]));
  });

  it('derives student identity from JWT for attempt start/submit and rejects client studentId', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T12:00:00.000Z'));

    const createResponse = await request('/api/competitions', 'POST', createBody);
    const campaignId = (await createResponse.json() as any).campaign.id as string;
    const snapshotResponse = await request(`/api/competitions/${campaignId}/audience/snapshot`, 'POST', {
      requestId: 'route-student-audience-0001',
    });
    expect(snapshotResponse.status).toBe(201);

    const quizSnapshot = await createOrReuseQuizSnapshot(env.DB, 'quiz-round');
    sqlite.prepare(`
      INSERT INTO competition_rounds (
        id, campaign_id, round_number, opens_at, closes_at, max_attempts,
        passing_rule_type, passing_score, status, created_at
      ) VALUES (?, ?, 1, ?, ?, 2, 'MIN_SCORE', 7, 'SCHEDULED', ?)
    `).run(
      'round-route-1', campaignId,
      '2026-09-10T00:00:00.000Z', '2026-09-11T00:00:00.000Z',
      '2026-08-20T00:00:00.000Z',
    );
    sqlite.prepare(`
      INSERT INTO competition_round_quizzes (
        id, round_id, grade_level, class_id, quiz_id, quiz_snapshot_id, quiz_snapshot_hash, locked_at
      ) VALUES (?, ?, 4, NULL, ?, ?, ?, ?)
    `).run(
      'round-route-quiz-1', 'round-route-1', 'quiz-round', quizSnapshot.id, quizSnapshot.sha256,
      '2026-08-20T00:00:00.000Z',
    );

    const roundList = await request(`/api/competitions/${campaignId}/rounds`, 'GET', undefined, teacherCookie);
    expect(roundList.status).toBe(200);
    expect(((await roundList.json() as any).items[0]).quizSnapshot).toEqual({ status: 'LOCKED', mappingCount: 1 });

    const studentCampaigns = await request('/api/student/competitions', 'GET', undefined, studentCookie);
    expect(studentCampaigns.status).toBe(200);
    expect((await studentCampaigns.json() as any).items).toEqual([
      expect.objectContaining({ id: campaignId, title: 'Competition 2026-2027' }),
    ]);

    const studentDashboard = await request(
      `/api/student/competitions/${campaignId}`,
      'GET',
      undefined,
      studentCookie,
    );
    expect(studentDashboard.status).toBe(200);
    expect((await studentDashboard.json() as any).competition).toMatchObject({
      id: campaignId,
      rounds: [expect.objectContaining({ id: 'round-route-1', roundNumber: 1, maxAttempts: 2 })],
    });

    const spoofed = await request(
      `/api/student/competitions/${campaignId}/rounds/round-route-1/attempts`,
      'POST',
      {
        campaignId,
        roundId: 'round-route-1',
        requestId: 'route-student-start-spoof-0001',
        studentId: 'student-2',
      },
      studentCookie,
    );
    expect(spoofed.status).toBe(400);

    const start = await request(
      `/api/student/competitions/${campaignId}/rounds/round-route-1/attempts`,
      'POST',
      { campaignId, roundId: 'round-route-1', requestId: 'route-student-start-0001' },
      studentCookie,
    );
    expect(start.status).toBe(201);
    const started = await start.json() as any;
    const attempt = started.attempt;
    expect(attempt.studentId).toBe('student-1');
    expect(started.quiz).toMatchObject({
      id: 'quiz-round',
      title: 'Đề vòng 1 khối 4',
      questions: [expect.objectContaining({ id: 'q-round-1', type: 'MCQ', options: ['1', '2'] })],
    });
    expect(JSON.stringify(started.quiz)).not.toMatch(/correctAnswer|correct_answer|explanation/);

    const mismatchedSubmit = await request(
      `/api/student/competitions/wrong-campaign/rounds/round-route-1/attempts/${attempt.id}/submit`,
      'POST',
      {
        attemptId: attempt.id,
        answers: { 'q-round-1': 'B' },
        timeTaken: 25,
        idempotencyKey: 'route-submit-wrong-path-0001',
      },
      studentCookie,
    );
    expect(mismatchedSubmit.status).toBe(400);
    expect((sqlite.prepare('SELECT COUNT(*) AS count FROM results').get() as { count: number }).count).toBe(0);

    const submit = await request(
      `/api/student/competitions/${campaignId}/rounds/round-route-1/attempts/${attempt.id}/submit`,
      'POST',
      {
        attemptId: attempt.id,
        answers: { 'q-round-1': 'B' },
        timeTaken: 25,
        idempotencyKey: 'route-submit-key-0001',
      },
      studentCookie,
    );
    expect(submit.status).toBe(200);
    const result = (await submit.json() as any).result;
    expect(result).toMatchObject({ studentId: 'student-1', score: 10, correctCount: 1 });
    expect(sqlite.prepare('SELECT student_id, assignment_id FROM results WHERE id = ?').get(result.resultId))
      .toMatchObject({ student_id: 'student-1', assignment_id: null });

    vi.setSystemTime(new Date('2026-09-11T00:00:00.000Z'));
    const finalize = await request(
      `/api/competitions/${campaignId}/rounds/round-route-1/finalize`,
      'POST',
      { campaignId, roundId: 'round-route-1', requestId: 'route-round-finalize-ok-0001' },
      adminCookie,
    );
    expect(finalize.status).toBe(200);
    expect((await finalize.json() as any).round.status).toBe('FINALIZED');
  });

  it('exposes class-scoped Teacher round progress with attempts and best score', async () => {
    const createResponse = await request('/api/competitions', 'POST', createBody);
    const campaignId = (await createResponse.json() as any).campaign.id as string;
    expect((await request(`/api/competitions/${campaignId}/audience/snapshot`, 'POST', {
      requestId: 'progress-audience-0001',
    })).status).toBe(201);

    sqlite.prepare(`
      INSERT INTO competition_rounds (
        id, campaign_id, round_number, opens_at, closes_at, max_attempts,
        passing_rule_type, passing_score, status, created_at
      ) VALUES ('progress-round-1', ?, 1, ?, ?, 3, 'MIN_SCORE', 7, 'SCHEDULED', ?)
    `).run(
      campaignId,
      '2026-09-10T00:00:00.000Z',
      '2026-09-11T00:00:00.000Z',
      '2026-08-20T00:00:00.000Z',
    );
    sqlite.prepare(`
      INSERT INTO competition_round_progress (
        campaign_id, round_id, student_id, attempts_used, best_attempt_id, best_score,
        is_passed, passed_at, status, version, updated_at
      ) VALUES (?, 'progress-round-1', 'student-1', 2, NULL, 8.5, 0, NULL, 'IN_PROGRESS', 1, ?)
    `).run(campaignId, '2026-09-10T01:00:00.000Z');
    sqlite.prepare(`
      INSERT INTO competition_round_progress (
        campaign_id, round_id, student_id, attempts_used, best_attempt_id, best_score,
        is_passed, passed_at, status, version, updated_at
      ) VALUES (?, 'progress-round-1', 'student-3', 1, NULL, 6.5, 0, NULL, 'IN_PROGRESS', 1, ?)
    `).run(campaignId, '2026-09-10T01:00:00.000Z');

    const teacherProgress = await request(`/api/competitions/${campaignId}/progress`, 'GET', undefined, teacherCookie);
    expect(teacherProgress.status).toBe(200);
    expect((await teacherProgress.json() as any).items).toEqual([
      expect.objectContaining({ studentId: 'student-1', classId: 'class-4a', roundNumber: 1, attemptsUsed: 2, bestScore: 8.5 }),
      expect.objectContaining({ studentId: 'student-3', classId: 'class-4b', roundNumber: 1, attemptsUsed: 1, bestScore: 6.5 }),
    ]);

    const teacher5Token = await signJWT({ username: 'teacher-5', role: 'teacher', tokenVersion: 1, purpose: 'session' }, secret, '30d');
    const teacher5Progress = await request(
      `/api/competitions/${campaignId}/progress`,
      'GET',
      undefined,
      `auth_token=${teacher5Token}`,
    );
    expect(teacher5Progress.status).toBe(200);
    expect((await teacher5Progress.json() as any).items).toEqual([]);
  });

  it('finalizes a 6/6 immutable eligibility snapshot and exposes staff/student reads', async () => {
    const createResponse = await request('/api/competitions', 'POST', createBody);
    const campaignId = (await createResponse.json() as any).campaign.id as string;
    expect((await request(`/api/competitions/${campaignId}/audience/snapshot`, 'POST', {
      requestId: 'elig-audience-6of6-0001',
    })).status).toBe(201);
    await seedEligibilityProgress(campaignId);

    const finalize = await request(`/api/competitions/${campaignId}/eligibility/finalize`, 'POST', {
      campaignId,
      requestId: 'elig-finalize-6of6-0001',
    });
    expect(finalize.status).toBe(200);
    const finalized = await finalize.json() as any;
    expect(finalized.snapshot).toMatchObject({
      campaignId,
      version: 1,
      memberCount: 3,
      qualifiedCount: 3,
    });

    const persisted = sqlite.prepare(`
      SELECT eligibility_snapshot_version, qualified, reason_codes_json, progress_digest
      FROM competition_eligibility
      WHERE campaign_id = ? AND student_id = 'student-1'
    `).get(campaignId) as any;
    expect(persisted).toMatchObject({ eligibility_snapshot_version: 1, qualified: 1 });
    expect(JSON.parse(persisted.reason_codes_json)).toEqual(['QUALIFIED']);
    expect(persisted.progress_digest).toMatch(/^[0-9a-f]{64}$/);
    expect((sqlite.prepare('SELECT status FROM competition_campaigns WHERE id = ?').get(campaignId) as any).status)
      .toBe('ELIGIBILITY_LOCKED');

    const staffRead = await request(`/api/competitions/${campaignId}/eligibility`, 'GET', undefined, teacherCookie);
    expect(staffRead.status).toBe(200);
    const staffPayload = await staffRead.json() as any;
    expect(staffPayload).toMatchObject({ campaignId, version: 1 });
    expect(staffPayload.items).toHaveLength(3);

    const studentRead = await request(
      `/api/student/competitions/${campaignId}/eligibility`,
      'GET',
      undefined,
      studentCookie,
    );
    expect(studentRead.status).toBe(200);
    expect((await studentRead.json() as any).eligibility).toMatchObject({
      campaignId,
      version: 1,
      studentId: 'student-1',
      qualified: true,
      reasonCodes: ['QUALIFIED'],
    });

    expect(() => sqlite.prepare(`
      UPDATE competition_eligibility
      SET qualified = 0
      WHERE campaign_id = ? AND eligibility_snapshot_version = 1 AND student_id = 'student-1'
    `).run(campaignId)).toThrow();

    const retry = await request(`/api/competitions/${campaignId}/eligibility/finalize`, 'POST', {
      campaignId,
      requestId: 'elig-finalize-6of6-retry-0001',
    });
    expect(retry.status).toBe(200);
    expect((await retry.json() as any).snapshot.version).toBe(1);
    expect((sqlite.prepare(`
      SELECT COUNT(*) AS count FROM competition_eligibility WHERE campaign_id = ?
    `).get(campaignId) as any).count).toBe(3);
  });

  it('marks a student with only 5/6 passed rounds as not qualified with reason codes', async () => {
    const createResponse = await request('/api/competitions', 'POST', createBody);
    const campaignId = (await createResponse.json() as any).campaign.id as string;
    await request(`/api/competitions/${campaignId}/audience/snapshot`, 'POST', {
      requestId: 'elig-audience-5of6-0001',
    });
    await seedEligibilityProgress(campaignId, { failedRoundForStudent1: 6 });

    const finalize = await request(`/api/competitions/${campaignId}/eligibility/finalize`, 'POST', {
      campaignId,
      requestId: 'elig-finalize-5of6-0001',
    });
    expect(finalize.status).toBe(200);
    expect((await finalize.json() as any).snapshot.qualifiedCount).toBe(2);

    const studentRead = await request(
      `/api/student/competitions/${campaignId}/eligibility`,
      'GET',
      undefined,
      studentCookie,
    );
    expect(studentRead.status).toBe(200);
    expect((await studentRead.json() as any).eligibility).toMatchObject({
      qualified: false,
      reasonCodes: ['ROUND_6_NOT_PASSED', 'ONLY_5_OF_6_ROUNDS_PASSED'],
    });
  });

  it('blocks eligibility finalization when the frozen audience is missing', async () => {
    const createResponse = await request('/api/competitions', 'POST', createBody);
    const campaignId = (await createResponse.json() as any).campaign.id as string;

    const finalize = await request(`/api/competitions/${campaignId}/eligibility/finalize`, 'POST', {
      campaignId,
      requestId: 'elig-finalize-no-audience-0001',
    });
    expect(finalize.status).toBe(409);
    expect((sqlite.prepare(`
      SELECT COUNT(*) AS count FROM competition_eligibility WHERE campaign_id = ?
    `).get(campaignId) as any).count).toBe(0);
    expect((sqlite.prepare('SELECT status FROM competition_campaigns WHERE id = ?').get(campaignId) as any).status)
      .not.toBe('ELIGIBILITY_LOCKED');
  });

  it('blocks eligibility finalization until every required round is FINALIZED', async () => {
    const createResponse = await request('/api/competitions', 'POST', createBody);
    const campaignId = (await createResponse.json() as any).campaign.id as string;
    await request(`/api/competitions/${campaignId}/audience/snapshot`, 'POST', {
      requestId: 'elig-audience-round-block-0001',
    });
    await seedEligibilityProgress(campaignId, { nonFinalizedRound: 6 });

    const finalize = await request(`/api/competitions/${campaignId}/eligibility/finalize`, 'POST', {
      campaignId,
      requestId: 'elig-finalize-round-block-0001',
    });
    expect(finalize.status).toBe(409);
    expect((sqlite.prepare(`
      SELECT COUNT(*) AS count FROM competition_eligibility WHERE campaign_id = ?
    `).get(campaignId) as any).count).toBe(0);
    expect((sqlite.prepare('SELECT status FROM competition_campaigns WHERE id = ?').get(campaignId) as any).status)
      .not.toBe('ELIGIBILITY_LOCKED');
  });
});

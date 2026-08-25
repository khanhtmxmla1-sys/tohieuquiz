// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrReuseQuizSnapshot } from '../workers/src/competition/quizSnapshotService';
import { startRoundAttempt } from '../workers/src/competition/roundService';
import { handleStudentCompetitionPortalRoutes } from '../workers/src/routes/competitions/studentPortalRoutes';
import { createSqliteD1 } from './helpers/sqliteD1';

const migration = readFileSync(
  new URL('../workers/migrations/0069_competition_core.sql', import.meta.url),
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
    CREATE TABLE results (
      id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, assignment_id TEXT,
      class_id TEXT NOT NULL, student_name TEXT NOT NULL, class_name TEXT NOT NULL,
      quiz_id TEXT NOT NULL, quiz_title TEXT NOT NULL, score REAL NOT NULL,
      correct_count INTEGER NOT NULL, total_questions INTEGER NOT NULL,
      time_taken INTEGER NOT NULL, submitted_at TEXT NOT NULL, answers TEXT NOT NULL,
      grading_version TEXT
    );
    CREATE TABLE admin_audit_logs (
      id TEXT PRIMARY KEY, actor_username TEXT NOT NULL, action TEXT NOT NULL,
      target_type TEXT NOT NULL, target_id TEXT NOT NULL, request_id TEXT NOT NULL,
      before_json TEXT, after_json TEXT, created_at TEXT NOT NULL
    );
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
      'quiz-4', 'Grade 4 Quiz', '4', 'Math', 30, '2026-08-01T00:00:00.000Z',
      'admin', '[]', 'manual', 1, 1, '2026-08-01T00:00:00.000Z'
    );
    INSERT INTO questions (id, quiz_id, type, question, options, correct_answer)
    VALUES ('question-1', 'quiz-4', 'MCQ', 'One plus one?', '1|2', '2');
  `);
}

async function seedCompetition(): Promise<void> {
  sqlite.exec(migration);
  const snapshot = await createOrReuseQuizSnapshot(d1, 'quiz-4');
  sqlite.exec(`
    INSERT INTO competition_campaigns (
      id, title, school_year, timezone, status, audience_rule_json,
      audience_snapshot_id, eligibility_policy_json, starts_at, ends_at,
      created_by, created_at, updated_at
    ) VALUES
      ('campaign-1', 'Competition One', '2026-2027', 'Asia/Ho_Chi_Minh', 'ACTIVE', '{}',
       'audience-1', '{"requiredRounds":6,"requiredPassedRounds":6}',
       '2026-09-01T00:00:00.000Z', '2027-05-31T23:59:59.000Z',
       'admin', '2026-08-20T00:00:00.000Z', '2026-08-20T00:00:00.000Z'),
      ('campaign-2', 'Competition Two', '2026-2027', 'Asia/Ho_Chi_Minh', 'ACTIVE', '{}',
       'audience-2', '{"requiredRounds":6,"requiredPassedRounds":6}',
       '2026-09-01T00:00:00.000Z', '2027-05-31T23:59:59.000Z',
       'admin', '2026-08-20T00:00:00.000Z', '2026-08-20T00:00:00.000Z');
    INSERT INTO competition_audience_snapshots (
      id, campaign_id, version, status, member_count, snapshot_hash, created_at, locked_at, created_by
    ) VALUES
      ('audience-1', 'campaign-1', 1, 'BUILDING', 0, '',
       '2026-08-20T00:00:00.000Z', NULL, 'admin'),
      ('audience-2', 'campaign-2', 1, 'BUILDING', 0, '',
       '2026-08-20T00:00:00.000Z', NULL, 'admin');
    INSERT INTO competition_audience_members (
      audience_snapshot_id, student_id, grade_level_at_snapshot,
      class_id_at_snapshot, student_status_at_snapshot
    ) VALUES
      ('audience-1', 'student-1', 4, 'class-4a', 'ACTIVE'),
      ('audience-2', 'student-1', 4, 'class-4a', 'ACTIVE');
    UPDATE competition_audience_snapshots
    SET status = 'LOCKED', member_count = 1,
        snapshot_hash = CASE id WHEN 'audience-1' THEN '${'a'.repeat(64)}' ELSE '${'b'.repeat(64)}' END,
        locked_at = '2026-08-20T00:00:00.000Z';
    INSERT INTO competition_rounds (
      id, campaign_id, round_number, opens_at, closes_at, max_attempts,
      passing_rule_type, passing_score, status, created_at
    ) VALUES
      ('round-1', 'campaign-1', 1, '2026-09-10T00:00:00.000Z',
       '2026-09-11T00:00:00.000Z', 1, 'MIN_SCORE', 7, 'OPEN', '2026-08-20T00:00:00.000Z'),
      ('round-2', 'campaign-2', 1, '2026-09-10T00:00:00.000Z',
       '2026-09-11T00:00:00.000Z', 1, 'MIN_SCORE', 7, 'OPEN', '2026-08-20T00:00:00.000Z');
  `);
  sqlite.prepare(`
    INSERT INTO competition_round_quizzes (
      id, round_id, grade_level, class_id, quiz_id, quiz_snapshot_id,
      quiz_snapshot_hash, locked_at
    ) VALUES (?, 'round-1', 4, NULL, 'quiz-4', ?, ?, '2026-08-20T00:00:00.000Z')
  `).run('mapping-1', snapshot.id, snapshot.sha256);
}

function rowCounts(): { attempts: number; results: number; progress: number } {
  const attempts = sqlite.prepare('SELECT COUNT(*) AS count FROM competition_round_attempts').get() as { count: number };
  const results = sqlite.prepare('SELECT COUNT(*) AS count FROM results').get() as { count: number };
  const progress = sqlite.prepare('SELECT COUNT(*) AS count FROM competition_round_progress').get() as { count: number };
  return { attempts: Number(attempts.count), results: Number(results.count), progress: Number(progress.count) };
}

async function preflight(
  campaignId: string,
  roundId: string,
  studentId = 'student-1',
): Promise<{ response: Response; body: any }> {
  const path = `/api/student/competitions/${campaignId}/rounds/${roundId}/preflight`;
  const response = await handleStudentCompetitionPortalRoutes(d1, path, 'POST', studentId);
  expect(response).not.toBeNull();
  return { response: response!, body: await response!.json() };
}

async function expectNonMutatingPreflight(
  campaignId: string,
  roundId: string,
  expected: Record<string, unknown>,
  studentId = 'student-1',
): Promise<any> {
  const before = rowCounts();
  const { response, body } = await preflight(campaignId, roundId, studentId);
  expect(response.status).toBe(200);
  expect(body.preflight).toMatchObject(expected);
  expect(rowCounts()).toEqual(before);
  return body.preflight;
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-10T12:00:00.000Z'));
  sqlite = new DatabaseSync(':memory:');
  createBaseSchema(sqlite);
  d1 = createSqliteD1(sqlite);
  await seedCompetition();
});

afterEach(() => {
  vi.useRealTimers();
  sqlite.close();
});

describe('ordinary Competition round entry preflight', () => {
  it('returns safe audience and round ownership blocks without mutation', async () => {
    const nonAudienceKnown = await expectNonMutatingPreflight('campaign-1', 'round-1', {
      status: 'BLOCKED', reason: 'NOT_IN_AUDIENCE', window: null, attemptsRemaining: null,
    }, 'student-2');
    const nonAudienceCrossCampaign = await expectNonMutatingPreflight('campaign-1', 'round-2', {
      status: 'BLOCKED', reason: 'NOT_IN_AUDIENCE', window: null, attemptsRemaining: null,
    }, 'student-2');
    const nonAudienceUnknown = await expectNonMutatingPreflight('campaign-1', 'round-unknown', {
      status: 'BLOCKED', reason: 'NOT_IN_AUDIENCE', window: null, attemptsRemaining: null,
    }, 'student-2');
    const safeAudienceBlock = (value: any) => ({
      status: value.status, reason: value.reason, window: value.window,
      attemptsRemaining: value.attemptsRemaining,
    });
    expect(safeAudienceBlock(nonAudienceCrossCampaign)).toEqual(safeAudienceBlock(nonAudienceKnown));
    expect(safeAudienceBlock(nonAudienceUnknown)).toEqual(safeAudienceBlock(nonAudienceKnown));

    await expectNonMutatingPreflight('campaign-1', 'round-2', {
      status: 'BLOCKED', reason: 'ROUND_CAMPAIGN_MISMATCH', attemptsRemaining: null,
    });
    const unknown = await expectNonMutatingPreflight('campaign-1', 'round-unknown', {
      status: 'BLOCKED', reason: 'ROUND_CAMPAIGN_MISMATCH', attemptsRemaining: null,
    });
    expect(unknown.window).toBeNull();
  });

  it('returns round-window and canonical eligibility blocks without mutation', async () => {
    vi.setSystemTime(new Date('2026-09-09T23:59:59.999Z'));
    const closed = await expectNonMutatingPreflight('campaign-1', 'round-1', {
      status: 'BLOCKED', reason: 'ROUND_NOT_OPEN', attemptsRemaining: 1,
    });
    expect(closed).toMatchObject({
      serverTime: '2026-09-09T23:59:59.999Z',
      window: {
        opensAt: '2026-09-10T00:00:00.000Z',
        closesAt: '2026-09-11T00:00:00.000Z',
        timezone: 'Asia/Ho_Chi_Minh',
      },
    });

    vi.setSystemTime(new Date('2026-09-10T12:00:00.000Z'));
    sqlite.prepare(`
      INSERT INTO competition_eligibility (
        id, campaign_id, eligibility_snapshot_version, student_id, qualified,
        reason_codes_json, qualified_at, computed_at, progress_digest
      ) VALUES ('eligibility-1', 'campaign-1', 1, 'student-1', 0,
        '["ROUND_1_NOT_PASSED"]', NULL, '2026-09-10T11:00:00.000Z', 'digest')
    `).run();
    await expectNonMutatingPreflight('campaign-1', 'round-1', {
      status: 'READY', quizId: 'quiz-4', attemptsRemaining: 1,
    });

    sqlite.prepare(`
      UPDATE competition_campaigns
      SET status = 'ELIGIBILITY_LOCKED', updated_at = '2026-09-10T11:00:00.000Z'
      WHERE id = 'campaign-1'
    `).run();
    sqlite.prepare(`
      UPDATE competition_rounds
      SET status = 'FINALIZED', finalized_at = '2026-09-10T11:00:00.000Z'
      WHERE id = 'round-1'
    `).run();
    await expectNonMutatingPreflight('campaign-1', 'round-1', {
      status: 'BLOCKED', reason: 'ELIGIBILITY_BLOCKED', attemptsRemaining: 1,
    });
  });

  it('returns attempt-limit and quiz-mapping blocks without mutation', async () => {
    const mapping = sqlite.prepare(`
      SELECT quiz_snapshot_id, quiz_snapshot_hash FROM competition_round_quizzes WHERE id = 'mapping-1'
    `).get() as { quiz_snapshot_id: string; quiz_snapshot_hash: string };
    sqlite.prepare(`
      INSERT INTO competition_round_attempts (
        id, campaign_id, round_id, student_id, attempt_no, quiz_id,
        quiz_snapshot_id, quiz_snapshot_hash, status, started_at, idempotency_key
      ) VALUES ('attempt-1', 'campaign-1', 'round-1', 'student-1', 1, 'quiz-4',
        ?, ?, 'STARTED', '2026-09-10T10:00:00.000Z', 'existing-attempt-1')
    `).run(mapping.quiz_snapshot_id, mapping.quiz_snapshot_hash);
    await expectNonMutatingPreflight('campaign-1', 'round-1', {
      status: 'BLOCKED', reason: 'ATTEMPT_LIMIT_REACHED', attemptsRemaining: 0,
    });

    sqlite.prepare(`
      UPDATE competition_round_attempts
      SET status = 'VOID', voided_at = '2026-09-10T11:00:00.000Z',
          voided_by = 'admin', void_reason = 'Fixture void'
      WHERE id = 'attempt-1'
    `).run();
    sqlite.prepare("DELETE FROM competition_round_quizzes WHERE id = 'mapping-1'").run();
    await expectNonMutatingPreflight('campaign-1', 'round-1', {
      status: 'BLOCKED', reason: 'QUIZ_MAPPING_UNAVAILABLE', attemptsRemaining: 1,
    });
  });

  it('rejects structurally corrupt and cross-quiz snapshots without mutation', async () => {
    const malformedPayload = JSON.stringify({ quiz: { id: 'quiz-4', title: 'Malformed snapshot' } });
    const malformedHash = createHash('sha256').update(malformedPayload).digest('hex');
    sqlite.prepare(`
      INSERT INTO competition_quiz_snapshots (
        id, quiz_id, canonical_payload_json, sha256, created_at, created_by
      ) VALUES ('snapshot-malformed', 'quiz-4', ?, ?, '2026-08-20T00:00:00.000Z', 'admin')
    `).run(malformedPayload, malformedHash);
    sqlite.prepare(`
      UPDATE competition_round_quizzes
      SET quiz_snapshot_id = 'snapshot-malformed', quiz_snapshot_hash = ?
      WHERE id = 'mapping-1'
    `).run(malformedHash);
    await expectNonMutatingPreflight('campaign-1', 'round-1', {
      status: 'BLOCKED', reason: 'QUIZ_MAPPING_UNAVAILABLE', attemptsRemaining: 1,
    });

    sqlite.prepare(`
      INSERT INTO quizzes (
        id, title, class_level, category, time_limit, created_at, created_by,
        tags, source_type, version_number, revision, updated_at
      ) VALUES (
        'quiz-other', 'Other Quiz', '4', 'Math', 30, '2026-08-01T00:00:00.000Z',
        'admin', '[]', 'manual', 1, 1, '2026-08-01T00:00:00.000Z'
      )
    `).run();
    sqlite.prepare(`
      INSERT INTO questions (id, quiz_id, type, question, options, correct_answer)
      VALUES ('question-other', 'quiz-other', 'MCQ', 'Two plus two?', '3|4', '4')
    `).run();
    const otherSnapshot = await createOrReuseQuizSnapshot(d1, 'quiz-other');
    sqlite.prepare(`
      UPDATE competition_round_quizzes
      SET quiz_snapshot_id = ?, quiz_snapshot_hash = ?
      WHERE id = 'mapping-1'
    `).run(otherSnapshot.id, otherSnapshot.sha256);
    await expectNonMutatingPreflight('campaign-1', 'round-1', {
      status: 'BLOCKED', reason: 'QUIZ_MAPPING_UNAVAILABLE', attemptsRemaining: 1,
    });
  });

  it('returns READY with quiz, server window, and remaining attempts without mutation', async () => {
    const ready = await expectNonMutatingPreflight('campaign-1', 'round-1', {
      status: 'READY', campaignId: 'campaign-1', roundId: 'round-1', quizId: 'quiz-4',
      serverTime: '2026-09-10T12:00:00.000Z', attemptsRemaining: 1,
      window: {
        opensAt: '2026-09-10T00:00:00.000Z',
        closesAt: '2026-09-11T00:00:00.000Z',
        timezone: 'Asia/Ho_Chi_Minh',
      },
    });
    expect(Object.keys(ready).sort()).toEqual([
      'attemptsRemaining', 'campaignId', 'quizId', 'roundId', 'serverTime', 'status', 'window',
    ]);
  });

  it('does not let a READY preflight bypass start-time revalidation', async () => {
    await expectNonMutatingPreflight('campaign-1', 'round-1', { status: 'READY' });
    sqlite.prepare("UPDATE competition_rounds SET status = 'CLOSED' WHERE id = 'round-1'").run();

    const before = rowCounts();
    await expect(startRoundAttempt(d1, {
      campaignId: 'campaign-1', roundId: 'round-1', studentId: 'student-1', requestId: 'start-after-preflight',
    })).rejects.toThrow('COMPETITION_ROUND_NOT_OPEN');
    expect(rowCounts()).toEqual(before);
  });
});

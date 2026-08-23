// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../workers/migrations/0069_competition_core.sql', import.meta.url),
  'utf8',
);
const rollback = readFileSync(
  new URL('../workers/migrations/rollback/0069_competition_core.rollback.sql', import.meta.url),
  'utf8',
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
      id TEXT PRIMARY KEY
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
    INSERT INTO classes (id) VALUES ('class-4a');
    INSERT INTO students (id, class_id) VALUES ('student-1', 'class-4a');
    INSERT INTO students (id, class_id) VALUES ('student-2', 'class-4a');
    INSERT INTO quizzes (id) VALUES ('quiz-1');
    INSERT INTO results DEFAULT VALUES;
  `);
}

function insertCampaign(database: DatabaseSync, id = 'campaign-1'): void {
  database.prepare(`
    INSERT INTO competition_campaigns (
      id, title, school_year, timezone, status, audience_rule_json,
      eligibility_policy_json, starts_at, ends_at, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    'Competition 2026-2027',
    '2026-2027',
    'Asia/Ho_Chi_Minh',
    'DRAFT',
    '{"gradeLevels":[4]}',
    '{"requiredRounds":6,"requiredPassedRounds":6}',
    '2026-09-01T00:00:00.000Z',
    '2027-05-31T23:59:59.000Z',
    'admin',
    '2026-08-20T07:00:00.000Z',
    '2026-08-20T07:00:00.000Z',
  );
}

describe('Competition core migration 0069', () => {
  it('creates the nine core tables and enforces authoritative uniqueness/check constraints', () => {
    db = new DatabaseSync(':memory:');
    createBaseSchema(db);
    db.exec(migration);
    insertCampaign(db);

    const tables = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name LIKE 'competition_%'
      ORDER BY name
    `).all() as Array<{ name: string }>;

    expect(tables.map(({ name }) => name)).toEqual(expect.arrayContaining([
      'competition_campaigns',
      'competition_audience_snapshots',
      'competition_audience_members',
      'competition_quiz_snapshots',
      'competition_rounds',
      'competition_round_quizzes',
      'competition_round_attempts',
      'competition_round_progress',
      'competition_eligibility',
    ]));

    expect(() => db!.prepare(`
      INSERT INTO competition_rounds (
        id, campaign_id, round_number, opens_at, closes_at, max_attempts,
        passing_rule_type, passing_score, status, created_at
      ) VALUES ('round-invalid', 'campaign-1', 7, '2026-09-01T00:00:00.000Z',
        '2026-09-08T00:00:00.000Z', 3, 'MIN_SCORE', 80, 'DRAFT',
        '2026-08-20T07:00:00.000Z')
    `).run()).toThrow();

    db.prepare(`
      INSERT INTO competition_rounds (
        id, campaign_id, round_number, opens_at, closes_at, max_attempts,
        passing_rule_type, passing_score, status, created_at
      ) VALUES ('round-1', 'campaign-1', 1, '2026-09-01T00:00:00.000Z',
        '2026-09-08T00:00:00.000Z', 3, 'MIN_SCORE', 80, 'DRAFT',
        '2026-08-20T07:00:00.000Z')
    `).run();

    expect(() => db!.prepare(`
      INSERT INTO competition_rounds (
        id, campaign_id, round_number, opens_at, closes_at, max_attempts,
        passing_rule_type, passing_score, status, created_at
      ) VALUES ('round-1-duplicate', 'campaign-1', 1,
        '2026-09-01T00:00:00.000Z', '2026-09-08T00:00:00.000Z',
        3, 'MIN_SCORE', 80, 'DRAFT', '2026-08-20T07:00:00.000Z')
    `).run()).toThrow();

    db.prepare(`
      INSERT INTO competition_audience_snapshots (
        id, campaign_id, version, status, member_count, snapshot_hash, created_at, locked_at, created_by
      ) VALUES ('audience-1', 'campaign-1', 1, 'BUILDING', 0, '',
        '2026-08-20T07:00:00.000Z', NULL, 'admin')
    `).run();

    db.prepare(`
      INSERT INTO competition_audience_members (
        audience_snapshot_id, student_id, grade_level_at_snapshot, class_id_at_snapshot,
        student_status_at_snapshot
      ) VALUES ('audience-1', 'student-1', 4, 'class-4a', 'ACTIVE')
    `).run();

    expect(() => db!.prepare(`
      INSERT INTO competition_audience_members (
        audience_snapshot_id, student_id, grade_level_at_snapshot, class_id_at_snapshot,
        student_status_at_snapshot
      ) VALUES ('audience-1', 'student-1', 4, 'class-4a', 'ACTIVE')
    `).run()).toThrow();

    db.prepare(`
      UPDATE competition_audience_snapshots
      SET status = 'LOCKED', member_count = 1,
          snapshot_hash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          locked_at = '2026-08-20T07:01:00.000Z'
      WHERE id = 'audience-1' AND status = 'BUILDING'
    `).run();

    db.prepare(`
      INSERT INTO competition_quiz_snapshots (
        id, quiz_id, canonical_payload_json, sha256, created_at, created_by
      ) VALUES ('quiz-snapshot-1', 'quiz-1', '{"questions":[]}',
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        '2026-08-20T07:00:00.000Z', 'admin')
    `).run();

    db.prepare(`
      INSERT INTO competition_round_attempts (
        id, campaign_id, round_id, student_id, attempt_no, quiz_id,
        quiz_snapshot_id, quiz_snapshot_hash, result_id, status, score,
        correct_count, time_taken, started_at, submitted_at, scored_at,
        idempotency_key
      ) VALUES ('attempt-1', 'campaign-1', 'round-1', 'student-1', 1, 'quiz-1',
        'quiz-snapshot-1',
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        1, 'SCORED', 90, 9, 120, '2026-09-02T00:00:00.000Z',
        '2026-09-02T00:02:00.000Z', '2026-09-02T00:02:01.000Z', 'idem-attempt-000001')
    `).run();

    expect(() => db!.prepare(`
      INSERT INTO competition_round_attempts (
        id, campaign_id, round_id, student_id, attempt_no, quiz_id,
        quiz_snapshot_id, quiz_snapshot_hash, status, started_at, idempotency_key
      ) VALUES ('attempt-duplicate', 'campaign-1', 'round-1', 'student-1', 1,
        'quiz-1', 'quiz-snapshot-1',
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'STARTED', '2026-09-02T01:00:00.000Z', 'idem-attempt-000002')
    `).run()).toThrow();

    db.prepare(`
      INSERT INTO competition_round_progress (
        campaign_id, round_id, student_id, attempts_used, best_attempt_id,
        best_score, is_passed, passed_at, status, version, updated_at
      ) VALUES ('campaign-1', 'round-1', 'student-1', 1, 'attempt-1', 90,
        1, '2026-09-02T00:02:01.000Z', 'PASSED', 1, '2026-09-02T00:02:01.000Z')
    `).run();

    expect(() => db!.prepare(`
      INSERT INTO competition_round_progress (
        campaign_id, round_id, student_id, attempts_used, is_passed, status, version, updated_at
      ) VALUES ('campaign-1', 'round-1', 'student-1', 1, 1, 'PASSED', 2,
        '2026-09-02T00:03:00.000Z')
    `).run()).toThrow();

    db.prepare(`
      INSERT INTO competition_eligibility (
        id, campaign_id, eligibility_snapshot_version, student_id, qualified,
        reason_codes_json, qualified_at, computed_at, progress_digest
      ) VALUES ('eligibility-1', 'campaign-1', 1, 'student-1', 1,
        '["QUALIFIED"]', '2027-03-01T00:00:00.000Z',
        '2027-03-01T00:00:00.000Z', 'digest-1')
    `).run();

    expect(() => db!.prepare(`
      INSERT INTO competition_eligibility (
        id, campaign_id, eligibility_snapshot_version, student_id, qualified,
        reason_codes_json, computed_at, progress_digest
      ) VALUES ('eligibility-duplicate', 'campaign-1', 1, 'student-1', 0,
        '["ROUND_1_NOT_PASSED"]', '2027-03-01T00:00:00.000Z', 'digest-2')
    `).run()).toThrow();
  });

  it('rolls back only Competition core tables in reverse dependency order', () => {
    db = new DatabaseSync(':memory:');
    createBaseSchema(db);
    db.exec(migration);
    db.exec(rollback);

    const competitionTables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name LIKE 'competition_%'
    `).all();
    expect(competitionTables).toEqual([]);

    const baseTables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name IN ('students', 'classes', 'quizzes', 'results')
      ORDER BY name
    `).all() as Array<{ name: string }>;
    expect(baseTables.map(({ name }) => name)).toEqual(['classes', 'quizzes', 'results', 'students']);
  });
});

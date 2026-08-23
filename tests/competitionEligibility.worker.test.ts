// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { overrideCompetitionEligibility } from '../workers/src/competition/eligibilityService';
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

    CREATE TABLE students (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL DEFAULT '',
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL DEFAULT '',
      class_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '',
      archived_at TEXT
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

    INSERT INTO students (id, username) VALUES ('student-1', 'student1'), ('student-2', 'student2');
  `);
}

function seedLockedEligibility(): void {
  sqlite.exec(migration);
  sqlite.prepare(`
    INSERT INTO competition_campaigns (
      id, title, school_year, timezone, status, audience_rule_json,
      eligibility_policy_json, starts_at, ends_at, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'ELIGIBILITY_LOCKED', '{}', ?, ?, ?, ?, ?, ?)
  `).run(
    'campaign-1',
    'Competition',
    '2026-2027',
    'Asia/Ho_Chi_Minh',
    '{"requiredRounds":6,"requiredPassedRounds":6}',
    '2026-09-01T00:00:00.000Z',
    '2027-05-31T23:59:59.000Z',
    'admin',
    '2026-08-20T00:00:00.000Z',
    '2026-08-20T00:00:00.000Z',
  );

  sqlite.prepare(`
    INSERT INTO competition_eligibility (
      id, campaign_id, eligibility_snapshot_version, student_id, qualified,
      reason_codes_json, qualified_at, computed_at, progress_digest
    ) VALUES (?, 'campaign-1', 1, 'student-1', 0, ?, NULL, ?, ?)
  `).run(
    'eligibility-v1-student-1',
    '["ROUND_6_NOT_PASSED","ONLY_5_OF_6_ROUNDS_PASSED"]',
    '2027-03-01T00:00:00.000Z',
    'a'.repeat(64),
  );
  sqlite.prepare(`
    INSERT INTO competition_eligibility (
      id, campaign_id, eligibility_snapshot_version, student_id, qualified,
      reason_codes_json, qualified_at, computed_at, progress_digest
    ) VALUES (?, 'campaign-1', 1, 'student-2', 1, '["QUALIFIED"]', ?, ?, ?)
  `).run(
    'eligibility-v1-student-2',
    '2027-03-01T00:00:00.000Z',
    '2027-03-01T00:00:00.000Z',
    'b'.repeat(64),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2027-03-02T00:00:00.000Z'));
  sqlite = new DatabaseSync(':memory:');
  createBaseSchema(sqlite);
  d1 = createSqliteD1(sqlite);
  seedLockedEligibility();
});

afterEach(() => {
  vi.useRealTimers();
  sqlite.close();
});

describe('Competition V1 eligibility overrides', () => {
  it('creates a new immutable version with reason, actor, and timestamp', async () => {
    const overridden = await overrideCompetitionEligibility(d1, {
      campaignId: 'campaign-1',
      studentId: 'student-1',
      qualified: true,
      reason: 'Approved administrative exception',
      actorUsername: 'admin',
      requestId: 'eligibility-override-0001',
    });

    expect(overridden).toMatchObject({
      campaignId: 'campaign-1',
      version: 2,
      studentId: 'student-1',
      qualified: true,
      reasonCodes: ['QUALIFIED'],
      override: {
        reason: 'Approved administrative exception',
        actor: 'admin',
        timestamp: '2027-03-02T00:00:00.000Z',
      },
    });

    const original = sqlite.prepare(`
      SELECT qualified, reason_codes_json, override_reason
      FROM competition_eligibility
      WHERE campaign_id = 'campaign-1' AND eligibility_snapshot_version = 1 AND student_id = 'student-1'
    `).get() as any;
    expect(original).toMatchObject({ qualified: 0, override_reason: null });
    expect(JSON.parse(original.reason_codes_json)).toEqual([
      'ROUND_6_NOT_PASSED',
      'ONLY_5_OF_6_ROUNDS_PASSED',
    ]);

    const versionTwo = sqlite.prepare(`
      SELECT COUNT(*) AS count
      FROM competition_eligibility
      WHERE campaign_id = 'campaign-1' AND eligibility_snapshot_version = 2
    `).get() as { count: number };
    expect(versionTwo.count).toBe(2);

    const copiedPeer = sqlite.prepare(`
      SELECT qualified, reason_codes_json, progress_digest
      FROM competition_eligibility
      WHERE campaign_id = 'campaign-1' AND eligibility_snapshot_version = 2 AND student_id = 'student-2'
    `).get() as any;
    expect(copiedPeer).toMatchObject({ qualified: 1, progress_digest: 'b'.repeat(64) });
    expect(JSON.parse(copiedPeer.reason_codes_json)).toEqual(['QUALIFIED']);

    const audit = sqlite.prepare(`
      SELECT actor_username, action, request_id, after_json
      FROM admin_audit_logs
      WHERE action = 'ELIGIBILITY_OVERRIDDEN'
    `).get() as any;
    expect(audit).toMatchObject({
      actor_username: 'admin',
      action: 'ELIGIBILITY_OVERRIDDEN',
      request_id: 'eligibility-override-0001',
    });
    expect(JSON.parse(audit.after_json)).toMatchObject({
      campaignId: 'campaign-1',
      version: 2,
      studentId: 'student-1',
      qualified: true,
      reason: 'Approved administrative exception',
    });
  });
});

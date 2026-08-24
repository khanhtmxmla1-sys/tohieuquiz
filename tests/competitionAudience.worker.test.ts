// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createCompetitionCampaign,
  freezeCompetitionAudience,
  listCompetitionAudience,
  previewCompetitionAudience,
  updateCompetitionCampaign,
} from '../workers/src/competition/campaignService';
import { createSqliteD1 } from './helpers/sqliteD1';

const migration = readFileSync(
  new URL('../workers/migrations/0069_competition_core.sql', import.meta.url),
  'utf8',
);

let sqlite: DatabaseSync;
let d1: D1Database;

const campaignInput = {
  title: 'Competition 2026-2027',
  schoolYear: '2026-2027',
  timezone: 'Asia/Ho_Chi_Minh',
  audienceRule: { gradeLevels: [4], classIds: ['class-4a', 'class-4b'] },
  eligibilityPolicy: { requiredRounds: 6 as const, requiredPassedRounds: 6 },
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: '2027-05-31T23:59:59.000Z',
  requestId: 'req_competition_task5_0001',
};

function createBaseSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE teachers (
      username TEXT PRIMARY KEY
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
      id TEXT PRIMARY KEY
    );

    CREATE TABLE results (
      id INTEGER PRIMARY KEY AUTOINCREMENT
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
      ('student-3', 'Chi', 'student3', 'hash', 'class-4a', '2026-08-01T00:00:00.000Z', '2026-08-19T00:00:00.000Z'),
      ('student-4', 'Dung', 'student4', 'hash', 'class-4b', '2026-08-01T00:00:00.000Z', NULL),
      ('student-5', 'Em', 'student5', 'hash', 'class-5a', '2026-08-01T00:00:00.000Z', NULL);
  `);
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  createBaseSchema(sqlite);
  sqlite.exec(migration);
  d1 = createSqliteD1(sqlite);
});

afterEach(() => {
  sqlite.close();
});

describe('Competition V1 campaign and frozen audience', () => {
  it('creates a DRAFT campaign and records CAMPAIGN_CREATED audit', async () => {
    const campaign = await createCompetitionCampaign(d1, campaignInput, 'admin');

    expect(campaign).toMatchObject({
      title: campaignInput.title,
      schoolYear: campaignInput.schoolYear,
      status: 'DRAFT',
      audienceRule: campaignInput.audienceRule,
      audienceSnapshotId: null,
      createdBy: 'admin',
    });

    const persisted = sqlite.prepare(`
      SELECT title, status, audience_rule_json, audience_snapshot_id, created_by
      FROM competition_campaigns
      WHERE id = ?
    `).get(campaign.id) as Record<string, unknown>;
    expect(persisted).toMatchObject({
      title: campaignInput.title,
      status: 'DRAFT',
      audience_snapshot_id: null,
      created_by: 'admin',
    });
    expect(JSON.parse(String(persisted.audience_rule_json))).toEqual(campaignInput.audienceRule);

    const audit = sqlite.prepare(`
      SELECT actor_username, action, target_type, target_id, request_id
      FROM admin_audit_logs
      WHERE action = 'CAMPAIGN_CREATED'
    `).get() as Record<string, unknown>;
    expect(audit).toEqual({
      actor_username: 'admin',
      action: 'CAMPAIGN_CREATED',
      target_type: 'competition_campaign',
      target_id: campaign.id,
      request_id: campaignInput.requestId,
    });
  });

  it('previews matching active students and reports grade/class and exclusions', async () => {
    const campaign = await createCompetitionCampaign(d1, {
      ...campaignInput,
      audienceRule: { gradeLevels: [4], classIds: ['class-4a'] },
      requestId: 'req_competition_task5_0002',
    }, 'admin');

    const preview = await previewCompetitionAudience(d1, campaign.id);

    expect(preview).toEqual({
      matchedCount: 2,
      countsByGrade: { '4': 2 },
      countsByClass: { 'class-4a': 2 },
      excludedArchivedCount: 1,
      excludedByRuleCount: 2,
    });
  });

  it('freezes an immutable LOCKED snapshot and preserves class/grade after roster changes', async () => {
    const campaign = await createCompetitionCampaign(d1, {
      ...campaignInput,
      requestId: 'req_competition_task5_0003',
    }, 'admin');

    const snapshot = await freezeCompetitionAudience(
      d1,
      campaign.id,
      'admin',
      'req_competition_snapshot_0003',
    );

    expect(snapshot.status).toBe('LOCKED');
    expect(snapshot.memberCount).toBe(3);
    expect(snapshot.snapshotHash).toMatch(/^[0-9a-f]{64}$/);

    const campaignRow = sqlite.prepare(`
      SELECT audience_snapshot_id
      FROM competition_campaigns
      WHERE id = ?
    `).get(campaign.id) as { audience_snapshot_id: string | null };
    expect(campaignRow.audience_snapshot_id).toBe(snapshot.id);

    sqlite.prepare(`UPDATE students SET class_id = 'class-5a' WHERE id = 'student-1'`).run();

    const audience = await listCompetitionAudience(d1, campaign.id, { limit: 10 });
    expect(audience.items.find((item) => item.studentId === 'student-1')).toMatchObject({
      gradeLevelAtSnapshot: 4,
      classIdAtSnapshot: 'class-4a',
      studentStatusAtSnapshot: 'ACTIVE',
    });

    expect(() => sqlite.prepare(`
      UPDATE competition_audience_members
      SET class_id_at_snapshot = 'class-5a'
      WHERE audience_snapshot_id = ? AND student_id = 'student-1'
    `).run(snapshot.id)).toThrow();

    const audit = sqlite.prepare(`
      SELECT actor_username, action, target_type, target_id, request_id
      FROM admin_audit_logs
      WHERE action = 'AUDIENCE_SNAPSHOTTED'
    `).get() as Record<string, unknown>;
    expect(audit).toEqual({
      actor_username: 'admin',
      action: 'AUDIENCE_SNAPSHOTTED',
      target_type: 'competition_audience_snapshot',
      target_id: snapshot.id,
      request_id: 'req_competition_snapshot_0003',
    });
  });

  it('creates a new immutable snapshot version after a reviewed DRAFT audience change', async () => {
    const campaign = await createCompetitionCampaign(d1, campaignInput, 'admin');
    const first = await freezeCompetitionAudience(
      d1, campaign.id, 'admin', 'req_competition_snapshot_first', 3,
    );

    await updateCompetitionCampaign(d1, campaign.id, {
      audienceRule: { gradeLevels: [4], classIds: ['class-4a'] },
      requestId: 'req_competition_campaign_narrow',
    }, 'admin');
    expect((await previewCompetitionAudience(d1, campaign.id)).matchedCount).toBe(2);

    const second = await freezeCompetitionAudience(
      d1, campaign.id, 'admin', 'req_competition_snapshot_second', 2,
    );

    expect(second).toMatchObject({ version: 2, memberCount: 2, status: 'LOCKED' });
    expect(second.id).not.toBe(first.id);
    const snapshots = sqlite.prepare(`
      SELECT id, version, member_count, status
      FROM competition_audience_snapshots
      WHERE campaign_id = ?
      ORDER BY version
    `).all(campaign.id) as Array<Record<string, unknown>>;
    expect(snapshots).toEqual([
      { id: first.id, version: 1, member_count: 3, status: 'LOCKED' },
      { id: second.id, version: 2, member_count: 2, status: 'LOCKED' },
    ]);
    expect(sqlite.prepare('SELECT audience_snapshot_id FROM competition_campaigns WHERE id = ?')
      .get(campaign.id)).toEqual({ audience_snapshot_id: second.id });
  });

  it('rejects snapshot creation when membership changed after preview', async () => {
    const campaign = await createCompetitionCampaign(d1, campaignInput, 'admin');

    await expect(freezeCompetitionAudience(
      d1, campaign.id, 'admin', 'req_competition_snapshot_stale', 2,
    )).rejects.toThrow('COMPETITION_AUDIENCE_CHANGED_REVIEW_REQUIRED');

    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM competition_audience_snapshots WHERE campaign_id = ?')
      .get(campaign.id)).toEqual({ count: 0 });
  });

  it('rejects audience resnapshot outside DRAFT campaign state', async () => {
    const campaign = await createCompetitionCampaign(d1, campaignInput, 'admin');
    sqlite.prepare("UPDATE competition_campaigns SET status = 'ACTIVE' WHERE id = ?").run(campaign.id);

    await expect(freezeCompetitionAudience(
      d1, campaign.id, 'admin', 'req_competition_snapshot_active', 3,
    )).rejects.toThrow('COMPETITION_CAMPAIGN_NOT_DRAFT');
  });

  it('paginates frozen audience members with an opaque cursor and no duplicates', async () => {
    const campaign = await createCompetitionCampaign(d1, {
      ...campaignInput,
      requestId: 'req_competition_task5_0004',
    }, 'admin');
    await freezeCompetitionAudience(
      d1,
      campaign.id,
      'admin',
      'req_competition_snapshot_0004',
    );

    const firstPage = await listCompetitionAudience(d1, campaign.id, { limit: 2 });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextCursor).toEqual(expect.any(String));

    const secondPage = await listCompetitionAudience(d1, campaign.id, {
      limit: 2,
      cursor: firstPage.nextCursor!,
    });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();

    const allIds = [...firstPage.items, ...secondPage.items].map((item) => item.studentId);
    expect(new Set(allIds).size).toBe(3);
  });
});

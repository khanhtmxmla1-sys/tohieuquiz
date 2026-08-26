// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const migrationPath = 'workers/migrations/0079_competition_public_portal.sql';
const rollbackPath = 'workers/migrations/rollback/0079_competition_public_portal.rollback.sql';
const portalTables = [
  'competition_public_pages',
  'competition_articles',
  'competition_award_rule_versions',
  'competition_award_rules',
  'competition_golden_board_configs',
] as const;
const portalFlags = [
  'competition_public_portal_read_v1',
  'competition_student_portal_v1',
  'competition_legacy_redirect_v1',
  'competition_golden_board_v1',
  'competition_public_content_admin_v1',
] as const;

let db: DatabaseSync | null = null;

function createFixture(schoolName?: string): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(`
    CREATE TABLE competition_campaigns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      school_year TEXT NOT NULL,
      timezone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      audience_rule_json TEXT NOT NULL DEFAULT '{}',
      audience_snapshot_id TEXT,
      eligibility_policy_json TEXT NOT NULL DEFAULT '{}',
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE competition_school_exam_events (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      eligibility_snapshot_version INTEGER NOT NULL,
      title TEXT NOT NULL,
      exam_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      ranking_policy TEXT NOT NULL DEFAULT 'SCORE_CORRECT_TIME',
      exam_form_policy TEXT NOT NULL DEFAULT 'SAME_FORM',
      capacity_profile_id TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published_at TEXT,
      UNIQUE (campaign_id, id),
      FOREIGN KEY (campaign_id) REFERENCES competition_campaigns(id)
    );
    CREATE TABLE feature_flags (
      flag_key TEXT PRIMARY KEY,
      description TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
      owner TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE feature_flag_rules (
      flag_key TEXT PRIMARY KEY,
      audience TEXT NOT NULL,
      percentage INTEGER NOT NULL,
      allow_users_json TEXT NOT NULL,
      allow_classes_json TEXT NOT NULL,
      starts_at TEXT,
      ends_at TEXT,
      stop_conditions_json TEXT NOT NULL,
      reason TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (flag_key) REFERENCES feature_flags(flag_key) ON DELETE CASCADE
    );
    CREATE TABLE system_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE shared_sentinel (id TEXT PRIMARY KEY);
    INSERT INTO shared_sentinel (id) VALUES ('keep-me');
    INSERT INTO feature_flags (
      flag_key, description, enabled, owner, version, created_at, updated_at
    ) VALUES ('unrelated_flag', 'shared', 1, 'platform', 1, '2026-01-01', '2026-01-01');
  `);
  if (schoolName !== undefined) {
    database.prepare(`
      INSERT INTO system_settings (setting_key, setting_value, updated_at)
      VALUES ('school_name', ?, '2026-01-01')
    `).run(schoolName);
  }
  return database;
}

function insertCampaign(
  database: DatabaseSync,
  id: string,
  title: string,
  schoolYear: string,
): void {
  database.prepare(`
    INSERT INTO competition_campaigns (
      id, title, school_year, timezone, starts_at, ends_at,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, 'Asia/Bangkok', '2026-09-01', '2027-05-31',
      'admin', '2026-08-25', '2026-08-25')
  `).run(id, title, schoolYear);
}

function insertEvent(database: DatabaseSync, id: string, campaignId: string): void {
  database.prepare(`
    INSERT INTO competition_school_exam_events (
      id, campaign_id, eligibility_snapshot_version, title, exam_date,
      created_by, created_at, updated_at
    ) VALUES (?, ?, 1, 'School Exam', '2027-05-01', 'admin', '2026-08-25', '2026-08-25')
  `).run(id, campaignId);
}

function applyMigration(database: DatabaseSync): void {
  database.exec(readFileSync(migrationPath, 'utf8'));
}

afterEach(() => {
  db?.close();
  db = null;
});

describe('Competition public portal migration', () => {
  it('ships the forward and rollback files and creates the complete constrained schema', () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(existsSync(rollbackPath)).toBe(true);
    db = createFixture();
    applyMigration(db);

    const objects = db.prepare(`
      SELECT type, name, sql FROM sqlite_master
      WHERE name LIKE 'competition_%' OR name LIKE 'trg_competition_%'
    `).all() as Array<{ type: string; name: string; sql: string }>;
    const names = objects.map((object) => object.name);
    expect(names).toEqual(expect.arrayContaining([...portalTables]));

    const schemaSql = objects.map((object) => object.sql).join('\n');
    expect(schemaSql).toContain('GOLDEN_BOARD_SOURCE_EVENT_CAMPAIGN_MISMATCH');
    expect(schemaSql).toContain('COMPETITION_PUBLIC_SLUG_IMMUTABLE');
    expect(schemaSql).toContain('COMPETITION_AWARD_VERSION_IMMUTABLE');
    expect(schemaSql).toContain('COMPETITION_AWARD_RULE_IMMUTABLE');

    insertCampaign(db, 'campaign-schema', 'Schema Contract', '2026-2027');
    expect(() => db!.exec(`
      INSERT INTO competition_public_pages (
        id, campaign_id, slug, status, hero_title, created_by, created_at, updated_at
      ) VALUES ('page-upper', 'campaign-schema', 'Upper-Case', 'DRAFT', 'Title',
        'admin', '2026-08-25', '2026-08-25')
    `)).toThrow();
    expect(() => db!.exec(`
      INSERT INTO competition_articles (
        id, campaign_id, title, slug, content, type, status, created_by, created_at, updated_at
      ) VALUES ('article-bad', 'campaign-schema', 'Bad', 'bad', '', 'OTHER', 'DRAFT',
        'admin', '2026-08-25', '2026-08-25')
    `)).toThrow();
    expect(() => db!.exec(`
      INSERT INTO competition_award_rule_versions (
        id, campaign_id, version, status, created_by, created_at, updated_at
      ) VALUES ('version-schema', 'campaign-schema', 1, 'DRAFT', 'admin', '2026-08-25', '2026-08-25');
      INSERT INTO competition_award_rules (
        id, campaign_id, version, scope, grade_level, rank_from, rank_to,
        award_code, award_label, sort_order, created_by, created_at, updated_at
      ) VALUES ('rule-bad-grade', 'campaign-schema', 1, 'EVENT', 5, 1, 1,
        'GOLD', 'Gold', 1, 'admin', '2026-08-25', '2026-08-25')
    `)).toThrow();
    expect(() => db!.exec(`
      INSERT INTO competition_golden_board_configs (
        id, campaign_id, enabled, display_mode, title, updated_by, updated_at
      ) VALUES ('board-bad', 'campaign-schema', 0, 'MANUAL', 'Board', 'admin', '2026-08-25')
    `)).toThrow();
  });

  it('backfills deterministic collision-safe slugs exactly once and preserves them on rerun', () => {
    db = createFixture();
    insertCampaign(db, 'campaign-a', 'Hội khỏe Phù Đổng!', '2026 - 2027');
    insertCampaign(db, 'campaign-b', 'Hoi khoe Phu Dong', '2026-2027');
    insertCampaign(db, 'campaign-c', 'STEM Challenge', '2026/2027');

    applyMigration(db);
    const first = db.prepare(`
      SELECT campaign_id, slug, status FROM competition_public_pages ORDER BY campaign_id
    `).all() as Array<{ campaign_id: string; slug: string; status: string }>;
    expect(first).toHaveLength(3);
    expect(first.every((page) => page.status === 'DRAFT')).toBe(true);
    expect(first[0].slug).toBe('hoi-khoe-phu-dong-2026-2027');
    expect(first[1].slug).toMatch(/^hoi-khoe-phu-dong-2026-2027-[0-9a-f]+$/);
    expect(first[2].slug).toBe('stem-challenge-2026-2027');

    db.prepare(`UPDATE competition_public_pages SET slug = 'preserved-custom-slug' WHERE campaign_id = ?`)
      .run('campaign-c');
    applyMigration(db);
    const second = db.prepare(`
      SELECT campaign_id, slug FROM competition_public_pages ORDER BY campaign_id
    `).all() as Array<{ campaign_id: string; slug: string }>;
    expect(second).toHaveLength(3);
    expect(second.find((page) => page.campaign_id === 'campaign-c')?.slug)
      .toBe('preserved-custom-slug');
  });

  it('enforces same-campaign Golden Board sources and immutable published slugs', () => {
    db = createFixture();
    insertCampaign(db, 'campaign-one', 'First', '2026-2027');
    insertCampaign(db, 'campaign-two', 'Second', '2026-2027');
    insertEvent(db, 'event-one', 'campaign-one');
    insertEvent(db, 'event-two', 'campaign-two');
    applyMigration(db);

    db.exec(`
      INSERT INTO competition_award_rule_versions (
        id, campaign_id, version, status, created_by, created_at, updated_at
      ) VALUES ('version-one', 'campaign-one', 1, 'DRAFT', 'admin', '2026-08-25', '2026-08-25');
      UPDATE competition_award_rule_versions
      SET status = 'ACTIVE', activated_at = '2026-08-25'
      WHERE id = 'version-one';
    `);
    expect(() => db!.exec(`
      INSERT INTO competition_golden_board_configs (
        id, campaign_id, source_event_id, enabled, display_mode, title,
        award_rule_version, updated_by, updated_at
      ) VALUES ('board-one', 'campaign-one', 'event-two', 1, 'AWARD_WINNERS', 'Board',
        1, 'admin', '2026-08-25')
    `)).toThrow(/GOLDEN_BOARD_SOURCE_EVENT_CAMPAIGN_MISMATCH/);

    db.exec(`
      UPDATE competition_public_pages
      SET status = 'PUBLISHED', published_at = '2026-09-01'
      WHERE campaign_id = 'campaign-one';
    `);
    expect(() => db!.exec(`
      UPDATE competition_public_pages SET slug = 'changed' WHERE campaign_id = 'campaign-one'
    `)).toThrow(/COMPETITION_PUBLIC_SLUG_IMMUTABLE/);
  });

  it('requires an ACTIVE award rule version when enabling a Golden Board', () => {
    db = createFixture();
    insertCampaign(db, 'campaign-board', 'Board', '2026-2027');
    insertEvent(db, 'event-board', 'campaign-board');
    applyMigration(db);
    db.exec(`
      INSERT INTO competition_award_rule_versions (
        id, campaign_id, version, status, created_by, created_at, updated_at
      ) VALUES ('version-draft', 'campaign-board', 1, 'DRAFT', 'admin', '2026-08-25', '2026-08-25');
    `);

    expect(() => db!.exec(`
      INSERT INTO competition_golden_board_configs (
        id, campaign_id, source_event_id, enabled, display_mode, title,
        award_rule_version, updated_by, updated_at
      ) VALUES ('board-enabled', 'campaign-board', 'event-board', 1, 'AWARD_WINNERS', 'Board',
        1, 'admin', '2026-08-25')
    `)).toThrow(/GOLDEN_BOARD_AWARD_VERSION_NOT_ACTIVE/);

    db.exec(`
      INSERT INTO competition_golden_board_configs (
        id, campaign_id, source_event_id, enabled, display_mode, title,
        award_rule_version, updated_by, updated_at
      ) VALUES ('board-disabled', 'campaign-board', 'event-board', 0, 'AWARD_WINNERS', 'Board',
        1, 'admin', '2026-08-25');
    `);
    expect(() => db!.exec(`
      UPDATE competition_golden_board_configs SET enabled = 1 WHERE id = 'board-disabled'
    `)).toThrow(/GOLDEN_BOARD_AWARD_VERSION_NOT_ACTIVE/);

    db.exec(`
      UPDATE competition_award_rule_versions
      SET status = 'ACTIVE', activated_at = '2026-08-25'
      WHERE id = 'version-draft';
      UPDATE competition_golden_board_configs SET enabled = 1 WHERE id = 'board-disabled';
      INSERT INTO competition_award_rule_versions (
        id, campaign_id, version, status, created_by, created_at, updated_at
      ) VALUES ('version-other-draft', 'campaign-board', 2, 'DRAFT',
        'admin', '2026-08-25', '2026-08-25');
    `);
    expect(db.prepare(`
      SELECT enabled FROM competition_golden_board_configs WHERE id = 'board-disabled'
    `).get()).toEqual({ enabled: 1 });
    expect(() => db!.exec(`
      UPDATE competition_golden_board_configs
      SET award_rule_version = 2 WHERE id = 'board-disabled'
    `)).toThrow(/GOLDEN_BOARD_AWARD_VERSION_NOT_ACTIVE/);
  });

  it('prevents moving a DRAFT award rule into an immutable target version', () => {
    db = createFixture();
    insertCampaign(db, 'campaign-transfer', 'Transfer', '2026-2027');
    applyMigration(db);
    db.exec(`
      INSERT INTO competition_award_rule_versions (
        id, campaign_id, version, status, created_by, created_at, updated_at
      ) VALUES
        ('version-draft', 'campaign-transfer', 1, 'DRAFT', 'admin', '2026-08-25', '2026-08-25'),
        ('version-target', 'campaign-transfer', 2, 'DRAFT', 'admin', '2026-08-25', '2026-08-25');
      INSERT INTO competition_award_rules (
        id, campaign_id, version, scope, grade_level, rank_from, rank_to,
        award_code, award_label, sort_order, created_by, created_at, updated_at
      ) VALUES ('rule-draft', 'campaign-transfer', 1, 'GRADE', 5, 1, 3,
        'FIRST', 'First Prize', 1, 'admin', '2026-08-25', '2026-08-25');
      UPDATE competition_award_rule_versions
      SET status = 'ACTIVE', activated_at = '2026-08-25'
      WHERE id = 'version-target';
    `);

    expect(() => db!.exec(`
      UPDATE competition_award_rules SET version = 2 WHERE id = 'rule-draft'
    `)).toThrow(/COMPETITION_AWARD_RULE_IMMUTABLE/);
  });

  it('makes activated award versions and their rules immutable', () => {
    db = createFixture();
    insertCampaign(db, 'campaign-awards', 'Awards', '2026-2027');
    applyMigration(db);
    db.exec(`
      INSERT INTO competition_award_rule_versions (
        id, campaign_id, version, status, created_by, created_at, updated_at
      ) VALUES ('version-active', 'campaign-awards', 1, 'DRAFT', 'admin', '2026-08-25', '2026-08-25');
      INSERT INTO competition_award_rules (
        id, campaign_id, version, scope, grade_level, rank_from, rank_to,
        award_code, award_label, sort_order, created_by, created_at, updated_at
      ) VALUES ('rule-active', 'campaign-awards', 1, 'GRADE', 5, 1, 3,
        'FIRST', 'First Prize', 1, 'admin', '2026-08-25', '2026-08-25');
      UPDATE competition_award_rule_versions
      SET status = 'ACTIVE', activated_at = '2026-08-25'
      WHERE id = 'version-active';
    `);

    expect(() => db!.exec(`
      UPDATE competition_award_rule_versions SET status = 'RETIRED' WHERE id = 'version-active'
    `)).toThrow(/COMPETITION_AWARD_VERSION_IMMUTABLE/);
    expect(() => db!.exec(`
      UPDATE competition_award_rules SET award_label = 'Changed' WHERE id = 'rule-active'
    `)).toThrow(/COMPETITION_AWARD_RULE_IMMUTABLE/);
    expect(() => db!.exec(`DELETE FROM competition_award_rules WHERE id = 'rule-active'`))
      .toThrow(/COMPETITION_AWARD_RULE_IMMUTABLE/);
  });

  it('seeds disabled flags and inserts the canonical school name only when absent', () => {
    db = createFixture();
    applyMigration(db);
    const flags = db.prepare(`
      SELECT flag_key, enabled FROM feature_flags
      WHERE flag_key LIKE 'competition_%_v1' ORDER BY flag_key
    `).all() as Array<{ flag_key: string; enabled: number }>;
    expect(flags.map((flag) => flag.flag_key)).toEqual([...portalFlags].sort());
    expect(flags.every((flag) => flag.enabled === 0)).toBe(true);
    const rules = db.prepare(`
      SELECT flag_key, audience, percentage, allow_users_json, allow_classes_json,
             starts_at, ends_at
      FROM feature_flag_rules
      WHERE flag_key LIKE 'competition_%_v1' ORDER BY flag_key
    `).all() as Array<Record<string, unknown>>;
    expect(rules).toHaveLength(5);
    expect(rules.map((rule) => rule.flag_key)).toEqual([...portalFlags].sort());
    expect(rules.every((rule) => rule.audience === 'all' && rule.percentage === 100
      && rule.allow_users_json === '[]' && rule.allow_classes_json === '[]'
      && rule.starts_at === null && rule.ends_at === null)).toBe(true);
    expect(db.prepare(`
      SELECT setting_value FROM system_settings WHERE setting_key = 'school_name'
    `).get()).toEqual({ setting_value: 'Trường Tiểu học Tô Hiệu' });

    db.close();
    db = createFixture('Existing School');
    applyMigration(db);
    expect(db.prepare(`
      SELECT setting_value FROM system_settings WHERE setting_key = 'school_name'
    `).get()).toEqual({ setting_value: 'Existing School' });
  });

  it('rolls back only portal-owned objects and seeds while preserving shared state', () => {
    db = createFixture('Existing School');
    insertCampaign(db, 'campaign-rollback', 'Rollback', '2026-2027');
    applyMigration(db);
    db.exec(readFileSync(rollbackPath, 'utf8'));

    const remainingPortalTables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name IN (${portalTables.map(() => '?').join(', ')})
    `).all(...portalTables);
    expect(remainingPortalTables).toEqual([]);
    expect(db.prepare(`SELECT id FROM shared_sentinel`).get()).toEqual({ id: 'keep-me' });
    expect(db.prepare(`SELECT enabled FROM feature_flags WHERE flag_key = 'unrelated_flag'`).get())
      .toEqual({ enabled: 1 });
    expect(db.prepare(`SELECT setting_value FROM system_settings WHERE setting_key = 'school_name'`).get())
      .toEqual({ setting_value: 'Existing School' });
    for (const flag of portalFlags) {
      expect(db.prepare(`SELECT flag_key FROM feature_flags WHERE flag_key = ?`).get(flag))
        .toBeUndefined();
    }
  });
});

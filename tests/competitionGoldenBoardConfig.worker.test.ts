// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as goldenBoardConfigService from '../workers/src/competition/goldenBoardConfigService';
import {
  activateAwardRuleVersion,
  createAwardRuleVersion,
  getGoldenBoardConfig,
  listAwardRuleVersions,
  updateGoldenBoardConfig,
} from '../workers/src/competition/goldenBoardConfigService';
import { createSqliteD1 } from './helpers/sqliteD1';

const portalMigration = readFileSync(
  new URL('../workers/migrations/0079_competition_public_portal.sql', import.meta.url),
  'utf8',
);
const serviceSource = readFileSync(
  new URL('../workers/src/competition/goldenBoardConfigService.ts', import.meta.url),
  'utf8',
);

let sqlite: DatabaseSync;
let d1: D1Database;

function interleaveBeforeBatch(action: () => void): D1Database {
  let pending = true;
  return {
    prepare: d1.prepare.bind(d1),
    batch: async <T = unknown>(statements: D1PreparedStatement[]) => {
      if (pending) {
        pending = false;
        action();
      }
      return d1.batch<T>(statements);
    },
  } as D1Database;
}

function createBaseSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA foreign_keys = ON;

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

    CREATE TABLE system_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TEXT NOT NULL
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
  `);
}

function insertCampaign(id: string): void {
  sqlite.prepare(`
    INSERT INTO competition_campaigns (
      id, title, school_year, timezone, status, starts_at, ends_at,
      created_by, created_at, updated_at
    ) VALUES (?, ?, '2026-2027', 'Asia/Ho_Chi_Minh', 'REGISTRATION',
      '2026-09-01T00:00:00.000Z', '2027-05-31T23:59:59.000Z',
      'admin', '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z')
  `).run(id, `Competition ${id}`);
}

function insertEvent(id: string, campaignId: string): void {
  sqlite.prepare(`
    INSERT INTO competition_school_exam_events (
      id, campaign_id, eligibility_snapshot_version, title, exam_date,
      created_by, created_at, updated_at
    ) VALUES (?, ?, 1, ?, '2027-05-01', 'admin',
      '2026-08-25T00:00:00.000Z', '2026-08-25T00:00:00.000Z')
  `).run(id, campaignId, `School exam ${id}`);
}

function auditRows() {
  return sqlite.prepare(`
    SELECT actor_username, action, target_type, target_id, request_id, before_json, after_json
    FROM admin_audit_logs
    ORDER BY rowid
  `).all() as Array<{
    actor_username: string;
    action: string;
    target_type: string;
    target_id: string;
    request_id: string;
    before_json: string | null;
    after_json: string | null;
  }>;
}

async function createVersion(
  campaignId = 'campaign-a',
  requestId = 'req_award_create_0001',
) {
  return createAwardRuleVersion(d1, {
    campaignId,
    requestId,
    rules: [
      {
        scope: 'EVENT' as const,
        rankFrom: 1,
        rankTo: 2,
        awardCode: 'EVENT_GOLD',
        awardLabel: 'Giải Vàng',
        sortOrder: 10,
      },
      {
        scope: 'GRADE' as const,
        gradeLevel: 5,
        rankFrom: 1,
        rankTo: 3,
        awardCode: 'GRADE_5_GOLD',
        awardLabel: 'Giải Khối 5',
        sortOrder: 20,
      },
    ],
  }, 'award-admin');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-25T01:00:00.000Z'));
  sqlite = new DatabaseSync(':memory:');
  createBaseSchema(sqlite);
  insertCampaign('campaign-a');
  insertCampaign('campaign-b');
  insertEvent('event-a', 'campaign-a');
  insertEvent('event-b', 'campaign-b');
  sqlite.exec(portalMigration);
  d1 = createSqliteD1(sqlite);
});

afterEach(() => {
  sqlite.close();
  vi.useRealTimers();
});

describe('Golden Board config and immutable versioned Award Rules', () => {
  it('creates MAX(version)+1 with stable rule fields and lists campaign-owned versions', async () => {
    const first = await createVersion();
    const second = await createAwardRuleVersion(d1, {
      campaignId: 'campaign-a',
      requestId: 'req_award_create_0002',
      rules: [{
        scope: 'EVENT',
        rankFrom: 3,
        rankTo: 4,
        awardCode: 'EVENT_SILVER',
        awardLabel: 'Giải Bạc',
        sortOrder: 30,
      }],
    }, 'award-admin');

    expect(first).toMatchObject({ campaignId: 'campaign-a', version: 1, status: 'DRAFT' });
    expect(first.rules).toEqual([
      expect.objectContaining({
        scope: 'EVENT', rankFrom: 1, rankTo: 2,
        awardCode: 'EVENT_GOLD', awardLabel: 'Giải Vàng', sortOrder: 10,
      }),
      expect.objectContaining({
        scope: 'GRADE', gradeLevel: 5, rankFrom: 1, rankTo: 3,
        awardCode: 'GRADE_5_GOLD', awardLabel: 'Giải Khối 5', sortOrder: 20,
      }),
    ]);
    expect(first.rules[0]).not.toHaveProperty('gradeLevel');
    expect(second.version).toBe(2);
    expect(await listAwardRuleVersions(d1, 'campaign-a')).toEqual([second, first]);
    expect(await listAwardRuleVersions(d1, 'campaign-b')).toEqual([]);
  });

  it.each([
    ['scope', { scope: 'SCHOOL', rankFrom: 1, rankTo: 1, awardCode: 'BAD', awardLabel: 'Bad', sortOrder: 0 }, 'COMPETITION_AWARD_RULE_SCOPE_INVALID'],
    ['EVENT grade', { scope: 'EVENT', gradeLevel: 5, rankFrom: 1, rankTo: 1, awardCode: 'BAD', awardLabel: 'Bad', sortOrder: 0 }, 'COMPETITION_AWARD_RULE_GRADE_INVALID'],
    ['GRADE missing grade', { scope: 'GRADE', rankFrom: 1, rankTo: 1, awardCode: 'BAD', awardLabel: 'Bad', sortOrder: 0 }, 'COMPETITION_AWARD_RULE_GRADE_INVALID'],
    ['GRADE range', { scope: 'GRADE', gradeLevel: 13, rankFrom: 1, rankTo: 1, awardCode: 'BAD', awardLabel: 'Bad', sortOrder: 0 }, 'COMPETITION_AWARD_RULE_GRADE_INVALID'],
    ['rank from', { scope: 'EVENT', rankFrom: 0, rankTo: 1, awardCode: 'BAD', awardLabel: 'Bad', sortOrder: 0 }, 'COMPETITION_AWARD_RULE_RANK_INVALID'],
    ['rank to', { scope: 'EVENT', rankFrom: 3, rankTo: 2, awardCode: 'BAD', awardLabel: 'Bad', sortOrder: 0 }, 'COMPETITION_AWARD_RULE_RANK_INVALID'],
  ])('rejects invalid %s before any writes', async (_label, rule, errorCode) => {
    await expect(createAwardRuleVersion(d1, {
      campaignId: 'campaign-a',
      requestId: 'req_award_invalid_0003',
      rules: [rule as never],
    }, 'award-admin')).rejects.toThrow(errorCode);
    expect(sqlite.prepare('SELECT count(*) AS count FROM competition_award_rule_versions').get())
      .toEqual({ count: 0 });
  });

  it('rejects only overlapping rank ranges in the same scope and grade, preserving tie-compatible ranges', async () => {
    await expect(createAwardRuleVersion(d1, {
      campaignId: 'campaign-a',
      requestId: 'req_award_overlap_0004',
      rules: [
        { scope: 'GRADE', gradeLevel: 5, rankFrom: 1, rankTo: 3, awardCode: 'G5_A', awardLabel: 'A', sortOrder: 1 },
        { scope: 'GRADE', gradeLevel: 5, rankFrom: 3, rankTo: 4, awardCode: 'G5_B', awardLabel: 'B', sortOrder: 2 },
      ],
    }, 'award-admin')).rejects.toThrow('COMPETITION_AWARD_RULE_RANGES_OVERLAP');

    const version = await createAwardRuleVersion(d1, {
      campaignId: 'campaign-a',
      requestId: 'req_award_ties_0004',
      rules: [
        { scope: 'EVENT', rankFrom: 1, rankTo: 2, awardCode: 'EVENT_A', awardLabel: 'A', sortOrder: 1 },
        { scope: 'EVENT', rankFrom: 3, rankTo: 4, awardCode: 'EVENT_B', awardLabel: 'B', sortOrder: 2 },
        { scope: 'GRADE', gradeLevel: 4, rankFrom: 1, rankTo: 2, awardCode: 'G4_A', awardLabel: 'A', sortOrder: 3 },
        { scope: 'GRADE', gradeLevel: 5, rankFrom: 1, rankTo: 2, awardCode: 'G5_A', awardLabel: 'A', sortOrder: 4 },
      ],
    }, 'award-admin');
    expect(version.rules.map((rule) => [rule.rankFrom, rule.rankTo])).toContainEqual([1, 2]);
  });

  it('activates only a campaign-owned DRAFT version and exposes no edit-in-place rule surface', async () => {
    const draft = await createVersion();
    vi.setSystemTime(new Date('2026-08-26T02:03:04.000Z'));
    const active = await activateAwardRuleVersion(
      d1, 'campaign-a', draft.version, 'activation-admin', 'req_award_activate_0005',
    );
    expect(active).toMatchObject({ status: 'ACTIVE', activatedAt: '2026-08-26T02:03:04.000Z' });

    await expect(activateAwardRuleVersion(
      d1, 'campaign-a', draft.version, 'activation-admin', 'req_award_activate_again_0005',
    )).rejects.toThrow('COMPETITION_AWARD_RULE_VERSION_NOT_DRAFT');
    await expect(activateAwardRuleVersion(
      d1, 'campaign-b', draft.version, 'activation-admin', 'req_award_cross_activate_0005',
    )).rejects.toThrow('COMPETITION_AWARD_RULE_VERSION_NOT_FOUND');

    expect(() => sqlite.prepare(`
      UPDATE competition_award_rules SET award_label = 'Changed'
      WHERE campaign_id = 'campaign-a' AND version = 1
    `).run()).toThrow('COMPETITION_AWARD_RULE_IMMUTABLE');
    expect(() => sqlite.prepare(`
      UPDATE competition_award_rule_versions SET updated_at = 'changed'
      WHERE campaign_id = 'campaign-a' AND version = 1
    `).run()).toThrow('COMPETITION_AWARD_VERSION_IMMUTABLE');

    expect(Object.keys(goldenBoardConfigService).sort()).toEqual([
      'activateAwardRuleVersion',
      'createAwardRuleVersion',
      'getGoldenBoardConfig',
      'listAwardRuleVersions',
      'updateGoldenBoardConfig',
    ]);
  });

  it('creates and updates fixed-mode config with same-campaign owned sources', async () => {
    const draft = await createVersion();
    await activateAwardRuleVersion(
      d1, 'campaign-a', draft.version, 'activation-admin', 'req_award_activate_0006',
    );
    expect(await getGoldenBoardConfig(d1, 'campaign-a')).toBeNull();

    const created = await updateGoldenBoardConfig(d1, 'campaign-a', {
      sourceEventId: 'event-a',
      enabled: true,
      displayMode: 'AWARD_WINNERS',
      title: 'Bảng Vàng',
      awardRuleVersion: 1,
      requestId: 'req_board_create_0006',
    }, 'board-admin');
    expect(created).toMatchObject({
      campaignId: 'campaign-a', sourceEventId: 'event-a', enabled: true,
      displayMode: 'AWARD_WINNERS', title: 'Bảng Vàng', awardRuleVersion: 1,
    });
    expect(await getGoldenBoardConfig(d1, 'campaign-a')).toEqual(created);

    const updated = await updateGoldenBoardConfig(d1, 'campaign-a', {
      enabled: false,
      title: 'Bảng Vàng chính thức',
      requestId: 'req_board_update_0006',
    }, 'board-admin-2');
    expect(updated).toMatchObject({
      sourceEventId: 'event-a', enabled: false, awardRuleVersion: 1,
      displayMode: 'AWARD_WINNERS', title: 'Bảng Vàng chính thức', updatedBy: 'board-admin-2',
    });
  });

  it('rejects another campaign event with a stable safe error', async () => {
    await expect(updateGoldenBoardConfig(d1, 'campaign-a', {
      sourceEventId: 'event-b',
      enabled: false,
      displayMode: 'AWARD_WINNERS',
      title: 'Board',
      requestId: 'req_board_cross_event_0007',
    }, 'board-admin')).rejects.toThrow('GOLDEN_BOARD_SOURCE_EVENT_NOT_FOUND');
    await expect(updateGoldenBoardConfig(d1, 'campaign-a', {
      sourceEventId: 'unknown-event',
      enabled: false,
      displayMode: 'AWARD_WINNERS',
      title: 'Board',
      requestId: 'req_board_unknown_event_0007',
    }, 'board-admin')).rejects.toThrow('GOLDEN_BOARD_SOURCE_EVENT_NOT_FOUND');
  });

  it('rejects another campaign award version and inactive versions with stable safe errors', async () => {
    await createVersion('campaign-b', 'req_award_create_b_0008');
    await expect(updateGoldenBoardConfig(d1, 'campaign-a', {
      sourceEventId: 'event-a', enabled: false, displayMode: 'AWARD_WINNERS',
      title: 'Board', awardRuleVersion: 1, requestId: 'req_board_cross_version_0008',
    }, 'board-admin')).rejects.toThrow('GOLDEN_BOARD_AWARD_VERSION_NOT_FOUND');

    const ownDraft = await createVersion('campaign-a', 'req_award_create_a_0008');
    await expect(updateGoldenBoardConfig(d1, 'campaign-a', {
      sourceEventId: 'event-a', enabled: true, displayMode: 'AWARD_WINNERS',
      title: 'Board', awardRuleVersion: ownDraft.version, requestId: 'req_board_inactive_version_0008',
    }, 'board-admin')).rejects.toThrow('GOLDEN_BOARD_AWARD_VERSION_NOT_ACTIVE');
  });

  it('has no manual winner mutation or identity input and audits every permitted mutation safely', async () => {
    const draft = await createVersion('campaign-a', 'req_audit_award_create_0009');
    await activateAwardRuleVersion(
      d1, 'campaign-a', draft.version, 'activation-admin', 'req_audit_award_activate_0009',
    );
    await updateGoldenBoardConfig(d1, 'campaign-a', {
      sourceEventId: 'event-a', enabled: true, displayMode: 'AWARD_WINNERS',
      title: 'Board', awardRuleVersion: draft.version, requestId: 'req_audit_board_create_0009',
    }, 'board-admin');
    await updateGoldenBoardConfig(d1, 'campaign-a', {
      title: 'Board updated', requestId: 'req_audit_board_update_0009',
    }, 'board-admin');

    expect(serviceSource).not.toMatch(/studentIds?|winnerNames?|manualWinner|createWinner|updateWinner/i);
    expect(auditRows().map((row) => row.action)).toEqual([
      'COMPETITION_AWARD_RULE_VERSION_CREATED',
      'COMPETITION_AWARD_RULE_VERSION_ACTIVATED',
      'COMPETITION_GOLDEN_BOARD_CONFIG_CREATED',
      'COMPETITION_GOLDEN_BOARD_CONFIG_UPDATED',
    ]);
    for (const audit of auditRows()) {
      expect(audit.actor_username).toMatch(/admin/);
      expect(audit.request_id).toMatch(/^req_/);
      expect(audit.target_id).toBeTruthy();
      expect(`${audit.before_json}${audit.after_json}`).not.toContain('student');
      expect(`${audit.before_json}${audit.after_json}`).not.toContain('winner');
    }
  });

  it('rejects a stale activation without returning ACTIVE or writing a false audit', async () => {
    const draft = await createVersion();
    const beforeAuditCount = auditRows().length;
    const staleD1 = interleaveBeforeBatch(() => {
      sqlite.prepare(`
        UPDATE competition_award_rule_versions
        SET status = 'ACTIVE', activated_at = '2026-08-25T01:00:01.000Z',
            updated_by = 'other-admin', updated_at = '2026-08-25T01:00:01.000Z'
        WHERE campaign_id = 'campaign-a' AND version = ? AND status = 'DRAFT'
      `).run(draft.version);
    });

    await expect(activateAwardRuleVersion(
      staleD1, 'campaign-a', draft.version, 'activation-admin', 'req_award_stale_activate_0010',
    )).rejects.toThrow('COMPETITION_AWARD_RULE_VERSION_NOT_DRAFT');

    expect(auditRows()).toHaveLength(beforeAuditCount);
    expect(sqlite.prepare(`
      SELECT status, updated_by FROM competition_award_rule_versions
      WHERE campaign_id = 'campaign-a' AND version = ?
    `).get(draft.version)).toEqual({ status: 'ACTIVE', updated_by: 'other-admin' });
  });

  it('rejects a stale config update without overwriting concurrent partial changes or auditing success', async () => {
    await updateGoldenBoardConfig(d1, 'campaign-a', {
      enabled: false,
      title: 'Original board',
      requestId: 'req_board_stale_create_0011',
    }, 'board-admin');
    const beforeAuditCount = auditRows().length;
    const staleD1 = interleaveBeforeBatch(() => {
      sqlite.prepare(`
        UPDATE competition_golden_board_configs
        SET title = 'Concurrent board', updated_by = 'other-admin',
            updated_at = '2026-08-25T01:00:01.000Z'
        WHERE campaign_id = 'campaign-a'
      `).run();
    });

    await expect(updateGoldenBoardConfig(staleD1, 'campaign-a', {
      title: 'Stale board',
      requestId: 'req_board_stale_update_0011',
    }, 'board-admin')).rejects.toThrow('GOLDEN_BOARD_CONFIG_STALE_WRITE');

    expect(await getGoldenBoardConfig(d1, 'campaign-a')).toMatchObject({
      title: 'Concurrent board',
      enabled: false,
      updatedBy: 'other-admin',
    });
    expect(auditRows()).toHaveLength(beforeAuditCount);
  });

  it('rejects a stale config update after concurrent deletion without recreating or auditing success', async () => {
    await updateGoldenBoardConfig(d1, 'campaign-a', {
      enabled: false,
      title: 'Original board',
      requestId: 'req_board_delete_race_create_0011',
    }, 'board-admin');
    const beforeAuditCount = auditRows().length;
    const staleD1 = interleaveBeforeBatch(() => {
      sqlite.prepare(`
        DELETE FROM competition_golden_board_configs
        WHERE campaign_id = 'campaign-a'
      `).run();
    });

    await expect(updateGoldenBoardConfig(staleD1, 'campaign-a', {
      title: 'Stale board',
      requestId: 'req_board_delete_race_update_0011',
    }, 'board-admin')).rejects.toThrow('GOLDEN_BOARD_CONFIG_STALE_WRITE');

    expect(await getGoldenBoardConfig(d1, 'campaign-a')).toBeNull();
    expect(auditRows()).toHaveLength(beforeAuditCount);
  });

  it('loads each version and its rules through one deterministic aggregate statement', async () => {
    const created = await createVersion();
    const aggregateSql: string[] = [];
    const atomicD1 = {
      prepare(sql: string) {
        if (sql.includes('competition_award_rule_versions') || sql.includes('competition_award_rules')) {
          aggregateSql.push(sql);
        }
        return d1.prepare(sql);
      },
      batch: d1.batch.bind(d1),
    } as D1Database;

    expect(await listAwardRuleVersions(atomicD1, 'campaign-a')).toEqual([created]);
    expect(aggregateSql).toHaveLength(1);
    expect(aggregateSql[0]).toMatch(/competition_award_rule_versions[\s\S]+JOIN competition_award_rules/);
    expect(aggregateSql[0]).toMatch(/ORDER BY[\s\S]+version[\s\S]+sort_order[\s\S]+rank_from[\s\S]+id/);
  });

  it('maps unknown campaign writes to stable errors and leaves no success audits', async () => {
    await expect(createVersion(
      'missing-campaign', 'req_award_missing_campaign_0012',
    )).rejects.toThrow('COMPETITION_CAMPAIGN_NOT_FOUND');
    expect(auditRows()).toEqual([]);

    await expect(updateGoldenBoardConfig(d1, 'missing-campaign', {
      enabled: false,
      title: 'Missing campaign board',
      requestId: 'req_board_missing_campaign_0012',
    }, 'board-admin')).rejects.toThrow('COMPETITION_CAMPAIGN_NOT_FOUND');
    expect(auditRows()).toEqual([]);
  });

  it('maps a concurrent config insert to a stable stale error without a success audit', async () => {
    const staleD1 = interleaveBeforeBatch(() => {
      sqlite.prepare(`
        INSERT INTO competition_golden_board_configs (
          id, campaign_id, source_event_id, enabled, display_mode,
          title, award_rule_version, updated_by, updated_at
        ) VALUES (
          'concurrent-config', 'campaign-a', NULL, 0, 'AWARD_WINNERS',
          'Concurrent board', NULL, 'other-admin', '2026-08-25T01:00:01.000Z'
        )
      `).run();
    });

    await expect(updateGoldenBoardConfig(staleD1, 'campaign-a', {
      enabled: false,
      title: 'Stale create',
      requestId: 'req_board_stale_create_0013',
    }, 'board-admin')).rejects.toThrow('GOLDEN_BOARD_CONFIG_STALE_WRITE');

    expect(await getGoldenBoardConfig(d1, 'campaign-a')).toMatchObject({
      id: 'concurrent-config', title: 'Concurrent board', updatedBy: 'other-admin',
    });
    expect(auditRows()).toEqual([]);
  });

  it('maps source-event deletion after validation to a safe stale error and rolls back the config batch', async () => {
    const staleD1 = interleaveBeforeBatch(() => {
      sqlite.prepare(`
        DELETE FROM competition_school_exam_events
        WHERE id = 'event-a' AND campaign_id = 'campaign-a'
      `).run();
    });

    let caught: unknown;
    try {
      await updateGoldenBoardConfig(staleD1, 'campaign-a', {
        sourceEventId: 'event-a',
        enabled: false,
        title: 'Stale source board',
        requestId: 'req_board_source_delete_race_0014',
      }, 'board-admin');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('GOLDEN_BOARD_CONFIG_STALE_WRITE');
    expect((caught as Error).message).not.toMatch(
      /sqlite|d1|trigger|schema|constraint|foreign key|campaign_mismatch/i,
    );
    expect(sqlite.prepare(`
      SELECT count(*) AS count FROM competition_school_exam_events WHERE id = 'event-a'
    `).get()).toEqual({ count: 0 });
    expect(await getGoldenBoardConfig(d1, 'campaign-a')).toBeNull();
    expect(auditRows()).toEqual([]);
  });
});

// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPublicGoldenBoard } from '../workers/src/competition/goldenBoardService';
import { createSqliteD1 } from './helpers/sqliteD1';

let sqlite: DatabaseSync;
let d1: D1Database;

function createSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE competition_school_exam_events (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL
    );
    CREATE TABLE competition_golden_board_configs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL UNIQUE,
      source_event_id TEXT,
      enabled INTEGER NOT NULL,
      display_mode TEXT NOT NULL,
      title TEXT NOT NULL,
      award_rule_version INTEGER,
      updated_by TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE competition_award_rule_versions (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      status TEXT NOT NULL,
      activated_at TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_by TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE (campaign_id, version)
    );
    CREATE TABLE competition_award_rules (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      scope TEXT NOT NULL,
      grade_level INTEGER,
      rank_from INTEGER NOT NULL,
      rank_to INTEGER NOT NULL,
      award_code TEXT NOT NULL,
      award_label TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_by TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE competition_school_exam_publications (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      status TEXT NOT NULL,
      result_digest TEXT NOT NULL,
      published_by TEXT,
      prepared_at TEXT NOT NULL,
      published_at TEXT,
      ranking_version INTEGER,
      request_id TEXT,
      reconcile_version INTEGER
    );
    CREATE TABLE competition_school_exam_publication_results (
      id TEXT PRIMARY KEY,
      publication_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      publication_version INTEGER NOT NULL,
      ranking_version INTEGER NOT NULL,
      canonical_result_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      original_class_id TEXT NOT NULL,
      grade_level INTEGER NOT NULL,
      score REAL NOT NULL,
      correct_count INTEGER,
      time_taken INTEGER,
      rank_event INTEGER NOT NULL,
      rank_grade INTEGER NOT NULL,
      rank_class INTEGER NOT NULL,
      source_reconcile_version INTEGER NOT NULL,
      published_at TEXT NOT NULL
    );
    CREATE TABLE classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE students (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      username TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      guardian_data TEXT,
      class_id TEXT NOT NULL
    );
    CREATE TABLE system_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function seedConfig(enabled = 1, versionStatus = 'ACTIVE'): void {
  sqlite.exec(`
    INSERT INTO competition_school_exam_events (id, campaign_id)
    VALUES ('event-a', 'campaign-a');
  `);
  sqlite.prepare(`
    INSERT INTO competition_award_rule_versions (
      id, campaign_id, version, status, activated_at,
      created_by, created_at, updated_by, updated_at
    ) VALUES ('award-version-7', 'campaign-a', 7, ?, '2026-08-20T00:00:00.000Z',
      'admin', '2026-08-20T00:00:00.000Z', NULL, '2026-08-20T00:00:00.000Z')
  `).run(versionStatus);
  sqlite.prepare(`
    INSERT INTO competition_golden_board_configs (
      id, campaign_id, source_event_id, enabled, display_mode,
      title, award_rule_version, updated_by, updated_at
    ) VALUES ('board-a', 'campaign-a', 'event-a', ?, 'AWARD_WINNERS',
      'Golden Board', 7, 'admin', '2026-08-20T00:00:00.000Z')
  `).run(enabled);
  sqlite.exec(`
    INSERT INTO competition_award_rules (
      id, campaign_id, version, scope, grade_level, rank_from, rank_to,
      award_code, award_label, sort_order, created_by, created_at, updated_at
    ) VALUES
      ('rule-event', 'campaign-a', 7, 'EVENT', NULL, 1, 1,
        'EVENT_GOLD', 'Event Gold', 10, 'admin', '2026-08-20T00:00:00.000Z', '2026-08-20T00:00:00.000Z'),
      ('rule-grade', 'campaign-a', 7, 'GRADE', 5, 1, 1,
        'GRADE_5_GOLD', 'Grade 5 Gold', 20, 'admin', '2026-08-20T00:00:00.000Z', '2026-08-20T00:00:00.000Z');
  `);
}

function seedIdentity(): void {
  sqlite.exec(`
    INSERT INTO classes (id, name) VALUES
      ('class-original-a', '4A at publication'),
      ('class-original-b', '4B at publication'),
      ('class-current', 'Current class');
    INSERT INTO students (
      id, full_name, username, email, phone, guardian_data, class_id
    ) VALUES
      ('student-a', 'An Canonical', 'an-secret', 'an@example.test', '0901', 'guardian-a', 'class-current'),
      ('student-b', 'Binh Canonical', 'binh-secret', 'binh@example.test', '0902', 'guardian-b', 'class-current'),
      ('student-c', 'Chi Canonical', 'chi-secret', 'chi@example.test', '0903', 'guardian-c', 'class-current'),
      ('student-d', 'Dung Canonical', 'dung-secret', 'dung@example.test', '0904', 'guardian-d', 'class-current');
    INSERT INTO system_settings (setting_key, setting_value, updated_at)
    VALUES ('school_name', 'Canonical School', '2026-08-20T00:00:00.000Z');
  `);
}

function seedPublication(
  id: string,
  version: number,
  status: 'PREPARED' | 'PUBLISHED' | 'SUPERSEDED',
  rankingVersion: number,
  publishedAt: string | null,
): void {
  sqlite.prepare(`
    INSERT INTO competition_school_exam_publications (
      id, event_id, version, status, result_digest, published_by,
      prepared_at, published_at, ranking_version, request_id, reconcile_version
    ) VALUES (?, 'event-a', ?, ?, 'digest', 'publisher',
      '2026-08-20T00:00:00.000Z', ?, ?, ?, 1)
  `).run(id, version, status, publishedAt, rankingVersion, `publish-${version}`);
}

function seedResult(
  publicationId: string,
  publicationVersion: number,
  rankingVersion: number,
  studentId: string,
  originalClassId: string,
  gradeLevel: number,
  rankEvent: number,
  rankGrade: number,
): void {
  sqlite.prepare(`
    INSERT INTO competition_school_exam_publication_results (
      id, publication_id, event_id, publication_version, ranking_version,
      canonical_result_id, student_id, original_class_id, grade_level,
      score, correct_count, time_taken, rank_event, rank_grade, rank_class,
      source_reconcile_version, published_at
    ) VALUES (?, ?, 'event-a', ?, ?, ?, ?, ?, ?,
      99, 10, 20, ?, ?, 1, 1, '2026-08-25T00:00:00.000Z')
  `).run(
    `snapshot-${publicationId}-${studentId}`,
    publicationId,
    publicationVersion,
    rankingVersion,
    `canonical-${studentId}`,
    studentId,
    originalClassId,
    gradeLevel,
    rankEvent,
    rankGrade,
  );
}

function seedPublishedV1(): void {
  seedPublication('publication-v1', 1, 'PUBLISHED', 11, '2026-08-24T00:00:00.000Z');
  seedResult('publication-v1', 1, 11, 'student-d', 'class-original-a', 4, 1, 1);
}

function seedPublishedV2(): void {
  seedPublication('publication-v2', 2, 'PUBLISHED', 12, '2026-08-25T00:00:00.000Z');
  seedResult('publication-v2', 2, 12, 'student-a', 'class-original-a', 4, 1, 2);
  seedResult('publication-v2', 2, 12, 'student-b', 'class-original-b', 4, 1, 3);
  seedResult('publication-v2', 2, 12, 'student-c', 'class-original-a', 5, 5, 1);
  seedResult('publication-v2', 2, 12, 'student-d', 'class-original-a', 5, 6, 7);
}

function seedPublishedVersions(): void {
  seedPublishedV1();
  seedPublishedV2();
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  createSchema(sqlite);
  seedConfig();
  seedIdentity();
  d1 = createSqliteD1(sqlite);
});

afterEach(() => {
  sqlite.close();
});

describe('getPublicGoldenBoard', () => {
  it('switches from v1 to the latest PUBLISHED v2 without config mutation', async () => {
    seedPublishedV1();
    const configBefore = sqlite.prepare(`
      SELECT * FROM competition_golden_board_configs WHERE campaign_id = 'campaign-a'
    `).get();

    const firstBoard = await getPublicGoldenBoard(d1, 'campaign-a');
    expect(firstBoard.publicationVersion).toBe(1);
    expect(firstBoard.winners.map((winner) => winner.fullName)).toEqual(['Dung Canonical']);

    seedPublishedV2();

    const board = await getPublicGoldenBoard(d1, 'campaign-a');

    expect(board).toMatchObject({
      publicationVersion: 2,
      rankingVersion: 12,
      awardRuleVersion: 7,
      publishedAt: '2026-08-25T00:00:00.000Z',
    });
    expect(board.winners.map((winner) => winner.fullName)).toEqual([
      'An Canonical',
      'Binh Canonical',
      'Chi Canonical',
    ]);
    expect(board.winners.map((winner) => winner.fullName)).not.toContain('Dung Canonical');
    expect(sqlite.prepare(`
      SELECT * FROM competition_golden_board_configs WHERE campaign_id = 'campaign-a'
    `).get()).toEqual(configBefore);
  });

  it('applies EVENT and GRADE rules and gives tied official ranks the same award', async () => {
    seedPublishedVersions();

    const board = await getPublicGoldenBoard(d1, 'campaign-a');

    expect(board.winners).toEqual([
      {
        fullName: 'An Canonical', className: '4A at publication', schoolName: 'Canonical School',
        gradeLevel: 4, awardCode: 'EVENT_GOLD', awardLabel: 'Event Gold',
      },
      {
        fullName: 'Binh Canonical', className: '4B at publication', schoolName: 'Canonical School',
        gradeLevel: 4, awardCode: 'EVENT_GOLD', awardLabel: 'Event Gold',
      },
      {
        fullName: 'Chi Canonical', className: '4A at publication', schoolName: 'Canonical School',
        gradeLevel: 5, awardCode: 'GRADE_5_GOLD', awardLabel: 'Grade 5 Gold',
      },
    ]);
  });

  it('rejects a configured source event owned by another campaign', async () => {
    seedPublishedV1();
    sqlite.prepare(`
      UPDATE competition_school_exam_events
      SET campaign_id = 'campaign-b'
      WHERE id = 'event-a'
    `).run();

    await expect(getPublicGoldenBoard(d1, 'campaign-a'))
      .rejects.toThrow('GOLDEN_BOARD_UNAVAILABLE');
  });

  it('awards each result once when EVENT and GRADE rules overlap, with deterministic ties', async () => {
    sqlite.prepare(`
      UPDATE competition_award_rules
      SET sort_order = 10
      WHERE id = 'rule-grade'
    `).run();
    seedPublication('publication-overlap', 1, 'PUBLISHED', 11, '2026-08-24T00:00:00.000Z');
    seedResult('publication-overlap', 1, 11, 'student-b', 'class-original-b', 5, 1, 1);
    seedResult('publication-overlap', 1, 11, 'student-a', 'class-original-a', 5, 1, 1);

    const board = await getPublicGoldenBoard(d1, 'campaign-a');

    expect(board.winners).toEqual([
      {
        fullName: 'An Canonical', className: '4A at publication', schoolName: 'Canonical School',
        gradeLevel: 5, awardCode: 'EVENT_GOLD', awardLabel: 'Event Gold',
      },
      {
        fullName: 'Binh Canonical', className: '4B at publication', schoolName: 'Canonical School',
        gradeLevel: 5, awardCode: 'EVENT_GOLD', awardLabel: 'Event Gold',
      },
    ]);
  });

  it('rejects a disabled board with a stable safe error', async () => {
    sqlite.prepare(`UPDATE competition_golden_board_configs SET enabled = 0`).run();
    await expect(getPublicGoldenBoard(d1, 'campaign-a'))
      .rejects.toThrow('GOLDEN_BOARD_UNAVAILABLE');
  });

  it('rejects an inactive configured award version with a stable safe error', async () => {
    sqlite.prepare(`UPDATE competition_award_rule_versions SET status = 'DRAFT'`).run();
    await expect(getPublicGoldenBoard(d1, 'campaign-a'))
      .rejects.toThrow('GOLDEN_BOARD_UNAVAILABLE');
  });

  it('rejects an event without a PUBLISHED publication with a stable safe error', async () => {
    seedPublication('publication-prepared', 1, 'PREPARED', 11, null);
    await expect(getPublicGoldenBoard(d1, 'campaign-a'))
      .rejects.toThrow('GOLDEN_BOARD_PUBLICATION_UNAVAILABLE');
  });

  it('returns valid empty winners when the publication has no matching award', async () => {
    seedPublication('publication-v1', 1, 'PUBLISHED', 11, '2026-08-24T00:00:00.000Z');
    seedResult('publication-v1', 1, 11, 'student-d', 'class-original-a', 4, 9, 9);

    await expect(getPublicGoldenBoard(d1, 'campaign-a')).resolves.toEqual({
      winners: [],
      publicationVersion: 1,
      rankingVersion: 11,
      awardRuleVersion: 7,
      publishedAt: '2026-08-24T00:00:00.000Z',
    });
  });

  it('serializes only the board and winner privacy allowlists', async () => {
    seedPublishedVersions();

    const board = await getPublicGoldenBoard(d1, 'campaign-a');
    const serialized = JSON.stringify(board);

    expect(Object.keys(board).sort()).toEqual([
      'awardRuleVersion', 'publicationVersion', 'publishedAt', 'rankingVersion', 'winners',
    ]);
    for (const winner of board.winners) {
      expect(Object.keys(winner).sort()).toEqual([
        'awardCode', 'awardLabel', 'className', 'fullName', 'gradeLevel', 'schoolName',
      ]);
    }
    expect(serialized).not.toMatch(
      /student-[a-d]|secret|example\.test|090[1-4]|guardian|canonical-result|snapshot-|class-original|score|rankEvent|rankGrade|room|answer|attempt|incident|retest|reconcile|storage/i,
    );
  });

  it('resolves identity from canonical students, original classes, and system settings', async () => {
    seedPublication('publication-v1', 1, 'PUBLISHED', 11, '2026-08-24T00:00:00.000Z');
    seedResult('publication-v1', 1, 11, 'student-a', 'class-original-a', 4, 1, 9);
    sqlite.prepare(`UPDATE students SET full_name = 'Server Joined Name' WHERE id = 'student-a'`).run();
    sqlite.prepare(`UPDATE classes SET name = 'Original Joined Class' WHERE id = 'class-original-a'`).run();
    sqlite.prepare(`UPDATE system_settings SET setting_value = 'Server Joined School' WHERE setting_key = 'school_name'`).run();

    expect((await getPublicGoldenBoard(d1, 'campaign-a')).winners[0]).toEqual({
      fullName: 'Server Joined Name',
      className: 'Original Joined Class',
      schoolName: 'Server Joined School',
      gradeLevel: 4,
      awardCode: 'EVENT_GOLD',
      awardLabel: 'Event Gold',
    });
  });

  it('does not let a newer non-PUBLISHED row supersede latest PUBLISHED v2', async () => {
    seedPublishedVersions();
    seedPublication('publication-v3', 3, 'PREPARED', 13, null);
    seedResult('publication-v3', 3, 13, 'student-d', 'class-original-a', 4, 1, 1);

    const board = await getPublicGoldenBoard(d1, 'campaign-a');

    expect(board.publicationVersion).toBe(2);
    expect(board.winners.map((winner) => winner.fullName)).not.toContain('Dung Canonical');
  });
});

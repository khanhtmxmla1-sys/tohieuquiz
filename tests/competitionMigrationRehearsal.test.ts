import { describe, expect, it } from 'vitest';

import {
  BASELINE_MIGRATION,
  COMPETITION_MIGRATIONS,
  build0068BaselineSql,
  chunkSqlStatements,
  evaluateRehearsalOutcome,
  expectedCompetitionTables,
  splitSqlStatements,
  summarizeRowDeltas,
} from '../workers/scripts/rehearse-competition-migrations.cjs';

describe('Competition V1 migration rehearsal contract', () => {
  it('builds a migration-0068 baseline without embedding Competition DDL', () => {
    const schema = [
      'CREATE TABLE students (id TEXT PRIMARY KEY);',
      '-- Canonical migration 0069_competition_core.sql',
      'CREATE TABLE competition_campaigns (id TEXT PRIMARY KEY);',
    ].join('\n');

    const baseline = build0068BaselineSql(schema);

    expect(BASELINE_MIGRATION).toBe('0068_login_media.sql');
    expect(baseline).toContain('CREATE TABLE students');
    expect(baseline).toContain('CREATE TABLE IF NOT EXISTS d1_migrations');
    expect(baseline).toContain("('0068_login_media.sql')");
    expect(baseline).not.toContain('CREATE TABLE competition_campaigns');
  });

  it('keeps the forward rehearsal set contiguous and ordered', () => {
    expect(COMPETITION_MIGRATIONS).toEqual([
      '0069_competition_core.sql',
      '0070_competition_school_exam.sql',
      '0071_live_exam_capacity_profiles.sql',
      '0072_competition_school_exam_orchestration.sql',
      '0073_competition_school_exam_reconcile.sql',
      '0074_competition_school_exam_incident_retest.sql',
      '0075_competition_school_exam_publication_ranking.sql',
      '0076_competition_certificate_adapter.sql',
      '0077_competition_async_xlsx_export.sql',
      '0078_competition_result_corrections.sql',
      '0079_competition_runtime_rollout.sql',
      '0080_competition_public_portal.sql',
      '0081_competition_school_exam_admissions.sql',
    ]);
  });

  it('splits bootstrap SQL without breaking trigger bodies or quoted semicolons', () => {
    const statements = splitSqlStatements(`
      CREATE TABLE demo (id TEXT, note TEXT);
      CREATE TRIGGER demo_guard BEFORE INSERT ON demo
      BEGIN
        SELECT CASE WHEN NEW.note = 'a;b' THEN RAISE(ABORT, 'blocked') END;
      END;
      INSERT INTO demo(id, note) VALUES ('one', 'a;b');
    `);

    expect(statements).toHaveLength(3);
    expect(statements[1]).toContain("NEW.note = 'a;b'");
    expect(statements[1]).toMatch(/END$/);
  });

  it('chunks SQL files below the D1 statement-size ceiling', () => {
    const chunks = chunkSqlStatements(
      Array.from({ length: 80 }, (_, index) => `CREATE TABLE table_${index}(id TEXT);`).join('\n'),
      1024,
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => Buffer.byteLength(chunk) <= 1024)).toBe(true);
  });

  it('defines the complete integrity table set for the Competition domain', () => {
    expect(expectedCompetitionTables).toEqual(expect.arrayContaining([
      'competition_campaigns',
      'competition_audience_members',
      'competition_round_attempts',
      'competition_eligibility',
      'competition_school_exam_admissions',
      'competition_school_exam_events',
      'competition_school_exam_results',
      'competition_school_exam_result_history',
      'competition_school_exam_publication_results',
      'competition_school_exam_certificate_batch_items',
      'competition_school_exam_result_corrections',
      'live_exam_capacity_profiles',
    ]));
    expect(new Set(expectedCompetitionTables).size).toBe(expectedCompetitionTables.length);
  });

  it('reports row deltas without treating new Competition tables as Live Exam mutations', () => {
    const deltas = summarizeRowDeltas(
      { students: 2, live_exam_sessions: 1 },
      { students: 2, live_exam_sessions: 1, competition_campaigns: 1 },
    );

    expect(deltas).toEqual({
      changedExistingTables: [],
      addedTables: [{ table: 'competition_campaigns', before: 0, after: 1 }],
    });
  });

  it('blocks the exit gate when representative data or rollback evidence is missing', () => {
    expect(evaluateRehearsalOutcome({
      emptyBootstrap: true,
      forward0068: true,
      representative: false,
      applicationRollback: false,
    })).toMatchObject({
      status: 'BLOCKED',
      blockingGaps: [
        'representative_snapshot_missing',
        'application_rollback_evidence_missing',
      ],
    });
  });

  it('passes only when every WP3 evidence gate is present', () => {
    expect(evaluateRehearsalOutcome({
      emptyBootstrap: true,
      forward0068: true,
      representative: true,
      applicationRollback: true,
    })).toEqual({ status: 'PASS', blockingGaps: [] });
  });
});

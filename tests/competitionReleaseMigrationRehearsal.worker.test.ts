// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

const rollbackFiles = [
  '0078_competition_result_corrections.rollback.sql',
  '0077_competition_async_xlsx_export.rollback.sql',
  '0076_competition_certificate_adapter.rollback.sql',
  '0075_competition_school_exam_publication_ranking.rollback.sql',
  '0074_competition_school_exam_incident_retest.rollback.sql',
  '0073_competition_school_exam_reconcile.rollback.sql',
  '0072_competition_school_exam_orchestration.rollback.sql',
  '0071_live_exam_capacity_profiles.rollback.sql',
  '0070_competition_school_exam.rollback.sql',
  '0069_competition_core.rollback.sql',
];

let database: DatabaseSync | null = null;

afterEach(() => {
  database?.close();
  database = null;
});

describe('Competition V1 migration release rehearsal', () => {
  it('boots the canonical schema and rolls Competition migrations back in reverse order', () => {
    database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON;');
    database.exec(readFileSync('workers/schema.sql', 'utf8'));

    const installed = database.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table'
        AND (name LIKE 'competition_%' OR name = 'live_exam_capacity_profiles')
    `).all() as Array<{ name: string }>;
    expect(installed.length).toBeGreaterThan(20);

    for (const rollback of rollbackFiles) {
      database.exec(readFileSync(`workers/migrations/rollback/${rollback}`, 'utf8'));
    }

    const remaining = database.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table'
        AND (name LIKE 'competition_%' OR name = 'live_exam_capacity_profiles')
    `).all();
    expect(remaining).toEqual([]);

    for (const baseTable of ['students', 'quizzes', 'live_exam_sessions']) {
      expect(database.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      ).get(baseTable)).toEqual({ name: baseTable });
    }

    const liveExamColumns = database.prepare('PRAGMA table_info(live_exam_sessions)').all()
      .map((column) => String((column as { name: unknown }).name));
    expect(liveExamColumns).toEqual(expect.arrayContaining([
      'participant_scope_type',
      'participant_scope_id',
      'result_visibility',
    ]));
  });
});

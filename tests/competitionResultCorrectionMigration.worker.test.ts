// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL('../workers/migrations/0078_competition_result_corrections.sql', import.meta.url);
const rollbackUrl = new URL('../workers/migrations/rollback/0078_competition_result_corrections.rollback.sql', import.meta.url);

describe('Competition result correction migration', () => {
  it('ships an immutable, idempotent correction ledger and its rollback', () => {
    expect(existsSync(migrationUrl)).toBe(true);
    expect(existsSync(rollbackUrl)).toBe(true);
    if (!existsSync(migrationUrl) || !existsSync(rollbackUrl)) return;

    const migration = readFileSync(migrationUrl, 'utf8');
    const rollback = readFileSync(rollbackUrl, 'utf8');
    expect(migration).toContain('CREATE TABLE competition_school_exam_result_corrections');
    expect(migration).toContain('UNIQUE(event_id, request_id)');
    expect(migration).toContain('SCHOOL_EXAM_RESULT_CORRECTION_IMMUTABLE');
    expect(migration).toContain('CREATE UNIQUE INDEX');
    expect(rollback).toContain('DROP TABLE IF EXISTS competition_school_exam_result_corrections');
  });
});

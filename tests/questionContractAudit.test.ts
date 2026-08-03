// @vitest-environment node

import { readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error The audit CLI is intentionally plain ESM for direct Node execution.
import {
  auditQuestionRows,
  REMOTE_SELECT_SQL,
} from '../scripts/audit-question-contracts.mjs';

const fixturePath = resolve('tests/fixtures/question-contract-audit.json');
const outputPath = resolve(`.tmp/question-contract-audit-${process.pid}.json`);
const scriptPath = resolve('scripts/audit-question-contracts.mjs');

afterEach(async () => {
  await rm(outputPath, { force: true });
});

describe('read-only question contract audit', () => {
  it('uses the Worker mapper and canonical scoring normalizer for fixture rows', async () => {
    const rows = JSON.parse(await readFile(fixturePath, 'utf8'));
    const report = await auditQuestionRows(rows);

    expect(report.summary).toEqual({
      auditedQuestions: 3,
      validQuestions: 1,
      invalidQuestions: 2,
      issueCounts: {
        MISSING_CORRECT_ANSWER: 1,
        INVALID_MATCHING_CONTRACT: 1,
      },
    });
    expect(report.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        quizId: 'quiz-invalid-short',
        questionId: 'q-invalid-short',
        issueCode: 'MISSING_CORRECT_ANSWER',
        severity: 'ERROR',
      }),
      expect.objectContaining({
        quizId: 'quiz-invalid-matching',
        questionId: 'q-invalid-matching',
        issueCode: 'INVALID_MATCHING_CONTRACT',
        severity: 'ERROR',
      }),
    ]));
  });

  it('writes a local JSON report through the CLI', async () => {
    const command = spawnSync(process.execPath, [
      scriptPath,
      '--input', 'tests/fixtures/question-contract-audit.json',
      '--output', outputPath,
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(command.status, command.stderr).toBe(0);
    const report = JSON.parse(await readFile(outputPath, 'utf8'));
    expect(report.summary.invalidQuestions).toBe(2);
  }, 30_000);

  it('fails safely when no output path is supplied', () => {
    const command = spawnSync(process.execPath, [
      scriptPath,
      '--input', 'tests/fixtures/question-contract-audit.json',
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(command.status).not.toBe(0);
    expect(command.stderr).toContain('Bắt buộc chỉ định --output');
  });

  it('contains only a read-only remote query', async () => {
    const source = await readFile(scriptPath, 'utf8');
    expect(REMOTE_SELECT_SQL.trim().toUpperCase().startsWith('SELECT')).toBe(true);
    expect(source).not.toMatch(/\b(?:UPDATE|DELETE|INSERT|REPLACE|DROP|ALTER)\b/i);
  });
});

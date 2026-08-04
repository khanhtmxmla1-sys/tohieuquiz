// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const cliPath = resolve('scripts/audit-question-contracts.mjs');

describe('question contract audit module boundary', () => {
  it('keeps the executable shebang out of the importable audit module', async () => {
    const cliSource = await readFile(cliPath, 'utf8');

    expect(cliSource.startsWith('#!/usr/bin/env node')).toBe(true);
    expect(cliSource).toContain("from './audit-question-contracts-core.mjs'");
    expect(cliSource).not.toContain('export const auditQuestionRows');
  });
});

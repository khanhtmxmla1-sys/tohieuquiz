import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const allowedFiles = new Set([
  'src/utils/dateTime.ts',
  'workers/src/utils/systemTime.ts',
]);

const trackedFiles = (scope: 'src' | 'workers/src'): string[] => execFileSync(
  'git',
  ['ls-files', `${scope}/**/*.ts`, `${scope}/**/*.tsx`],
  { cwd: root, encoding: 'utf8' },
)
  .split(/\r?\n/)
  .map((value) => value.trim().replaceAll('\\', '/'))
  .filter(Boolean)
  .filter((file) => !allowedFiles.has(file));

const findViolations = (scope: 'src' | 'workers/src'): string[] => {
  const violations: string[] = [];
  for (const file of trackedFiles(scope)) {
    const source = readFileSync(file, 'utf8');
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      const directDateLocale = /\.toLocale(?:DateString|TimeString)\s*\(/.test(line);
      const directDateTimeFormat = /new\s+Intl\.DateTimeFormat\s*\(/.test(line);
      const dateToLocaleString = /new\s+Date\s*\([^)]*\)\.toLocaleString\s*\(/.test(line)
        || /\b(?:date|timestamp|deadlineDate|startDate|endDate)\.toLocaleString\s*\(/i.test(line);
      const bangkokAlias = /Asia\/Bangkok|getBangkokDateKey/.test(line);
      if (directDateLocale || directDateTimeFormat || dateToLocaleString || bangkokAlias) {
        violations.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  return violations;
};

describe('system time usage guard', () => {
  it('requires frontend date formatting to use the Hanoi helpers', () => {
    expect(findViolations('src')).toEqual([]);
  });

  it('requires Worker business dates and formatting to use the Hanoi helpers', () => {
    expect(findViolations('workers/src')).toEqual([]);
  });
});

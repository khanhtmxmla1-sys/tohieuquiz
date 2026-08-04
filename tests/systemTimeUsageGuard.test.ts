import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as ts from 'typescript';
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

const containsDateConstruction = (node: ts.Node | undefined): boolean => {
  if (!node) return false;
  let found = false;
  const visit = (current: ts.Node) => {
    if (ts.isNewExpression(current)
      && ts.isIdentifier(current.expression)
      && current.expression.text === 'Date') {
      found = true;
      return;
    }
    if (!found) ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
};

const findDateLocaleStringViolations = (
  file: string,
  source: string,
  sourceFile: ts.SourceFile,
): string[] => {
  const dateIdentifiers = new Set<string>();
  const collectDateIdentifiers = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && containsDateConstruction(node.initializer)) {
      dateIdentifiers.add(node.name.text);
    }
    if (ts.isParameter(node)
      && ts.isIdentifier(node.name)
      && node.type?.getText(sourceFile).includes('Date')) {
      dateIdentifiers.add(node.name.text);
    }
    ts.forEachChild(node, collectDateIdentifiers);
  };
  collectDateIdentifiers(sourceFile);

  const lines = source.split(/\r?\n/);
  const violations: string[] = [];
  const inspectCalls = (node: ts.Node) => {
    if (ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'toLocaleString') {
      const receiver = node.expression.expression;
      const isDateReceiver = containsDateConstruction(receiver)
        || (ts.isIdentifier(receiver) && dateIdentifiers.has(receiver.text));
      if (isDateReceiver) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        violations.push(`${file}:${line}: ${lines[line - 1]?.trim() || 'toLocaleString'}`);
      }
    }
    ts.forEachChild(node, inspectCalls);
  };
  inspectCalls(sourceFile);
  return violations;
};

const findViolations = (scope: 'src' | 'workers/src'): string[] => {
  const violations: string[] = [];
  for (const file of trackedFiles(scope)) {
    const source = readFileSync(file, 'utf8');
    if (source.includes('.toLocaleString')) {
      const sourceFile = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      violations.push(...findDateLocaleStringViolations(file, source, sourceFile));
    }

    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      const directDateLocale = /\.toLocale(?:DateString|TimeString)\s*\(/.test(line);
      const directDateTimeFormat = /new\s+Intl\.DateTimeFormat\s*\(/.test(line);
      const bangkokAlias = /Asia\/Bangkok|getBangkokDateKey/.test(line);
      const directSystemZoneLiteral = /Asia\/Ho_Chi_Minh/.test(line);
      const runtimeLocalCalendar = /\.(?:getFullYear|getMonth|getDate|getHours|getDay|setDate|setHours)\s*\(/.test(line);
      if (directDateLocale || directDateTimeFormat || bangkokAlias || directSystemZoneLiteral || runtimeLocalCalendar) {
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

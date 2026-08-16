import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, 'src');
const allowedHotToastFiles = new Set([
  path.join(srcRoot, 'app', 'AppGlobals.tsx'),
  path.join(srcRoot, 'utils', 'toast.ts'),
]);

const collectSourceFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });

const sourceFiles = collectSourceFiles(srcRoot);

describe('system notification migration guard', () => {
  it('keeps react-hot-toast direct imports confined to infrastructure', () => {
    const offenders = sourceFiles
      .filter((file) => !allowedHotToastFiles.has(file))
      .filter((file) => fs.readFileSync(file, 'utf8').includes('react-hot-toast'))
      .map((file) => path.relative(projectRoot, file));

    expect(offenders).toEqual([]);
  });

  it('removes native window confirm/alert/prompt usage from source', () => {
    const nativeDialogPattern = /\bwindow\.(confirm|alert|prompt)\s*\(/;
    const offenders = sourceFiles
      .filter((file) => nativeDialogPattern.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(projectRoot, file));

    expect(offenders).toEqual([]);
  });
});

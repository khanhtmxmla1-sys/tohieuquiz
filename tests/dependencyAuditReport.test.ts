// @vitest-environment node

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseNpmAuditResult, runDependencyAudit } from '../scripts/dependency-audit-report.mjs';

const scriptPath = path.resolve('scripts/dependency-audit-report.mjs');

const cleanAudit = {
  metadata: {
    vulnerabilities: {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      info: 0,
      total: 0,
    },
    dependencies: {},
  },
  vulnerabilities: {},
};

const findingsAudit = {
  metadata: {
    vulnerabilities: {
      critical: 0,
      high: 1,
      moderate: 0,
      low: 0,
      info: 0,
      total: 1,
    },
    dependencies: {},
  },
  vulnerabilities: {
    'fixture-package': {
      severity: 'high',
      isDirect: true,
      fixAvailable: true,
      via: ['fixture-advisory'],
    },
  },
};

function runCliFixture(mode: 'empty' | 'eaudit' | 'missing' | 'unexpected' | 'clean' | 'findings') {
  const projectRoot = mkdtempSync(path.join(tmpdir(), 'dependency-audit-red-'));
  const npmCliPath = path.join(projectRoot, 'fixture-npm-cli.cjs');
  const payloads = JSON.stringify({ clean: cleanAudit, findings: findingsAudit });
  writeFileSync(npmCliPath, `
const mode = process.env.FIXTURE_AUDIT_MODE;
const payloads = ${payloads};
if (mode === 'empty') process.exit(0);
if (mode === 'eaudit') {
  process.stdout.write(JSON.stringify({ error: { code: 'EAUDIT', summary: 'fixture registry failure' } }));
  process.exit(1);
}
if (mode === 'missing') {
  process.stdout.write(JSON.stringify({ vulnerabilities: {} }));
  process.exit(0);
}
if (mode === 'unexpected') process.exit(2);
process.stdout.write(JSON.stringify(payloads[mode]));
process.exit(mode === 'findings' ? 1 : 0);
`);

  try {
    const result = spawnSync(process.execPath, [scriptPath, '--production', '--enforce'], {
      cwd: projectRoot,
      env: { ...process.env, npm_execpath: npmCliPath, FIXTURE_AUDIT_MODE: mode },
      encoding: 'utf8',
      timeout: 5_000,
      windowsHide: true,
    });
    const reportPath = path.join(projectRoot, 'reports', 'dependency-audit-root-production.json');
    return {
      result,
      reportExists: existsSync(reportPath),
    };
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
}

describe('dependency audit CLI failure handling', () => {
  it.each([
    ['empty', 2],
    ['eaudit', 2],
    ['missing', 2],
    ['unexpected', 2],
    ['clean', 0],
    ['findings', 1],
  ] as const)('handles a %s fixture with the expected exit behavior', (mode, expectedExitCode) => {
    const { result, reportExists } = runCliFixture(mode);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(expectedExitCode);
    if (expectedExitCode === 2) {
      expect(reportExists).toBe(false);
    }
  });
});

describe('dependency audit result parsing', () => {
  it.each([
    [{ status: 0, stdout: '', stderr: 'fixture diagnostic' }, /valid JSON|empty/i],
    [{ status: 0, stdout: '{not-json}', stderr: '' }, /valid JSON/i],
    [{ status: 1, stdout: JSON.stringify({ error: { code: 'EAUDIT', summary: 'fixture diagnostic' } }), stderr: '' }, /EAUDIT|error payload/i],
    [{ status: 0, stdout: JSON.stringify({ vulnerabilities: {} }), stderr: '' }, /metadata\.vulnerabilities/i],
    [{ status: null, stdout: JSON.stringify(cleanAudit), stderr: '', error: { code: 'ENOENT', message: 'fixture diagnostic' } }, /process|ENOENT/i],
    [{ status: null, stdout: JSON.stringify(cleanAudit), stderr: '', signal: 'SIGTERM' }, /signal|unexpected/i],
    [{ status: 2, stdout: JSON.stringify(cleanAudit), stderr: '' }, /exited|unexpected/i],
  ] as const)('rejects unsafe result %o', (result, errorPattern) => {
    expect(() => parseNpmAuditResult(result)).toThrow(errorPattern);
  });

  it.each([
    [{ status: null, stdout: JSON.stringify(cleanAudit), stderr: '', error: { code: 'SECRET_CANARY' } }, /process failed/i],
    [{ status: 1, stdout: JSON.stringify({ error: { code: 'SECRET_CANARY' } }), stderr: '' }, /error payload/i],
  ] as const)('does not echo an unknown error code from %o', (result, errorPattern) => {
    let thrownMessage = '';
    try {
      parseNpmAuditResult(result);
    } catch (error) {
      thrownMessage = error instanceof Error ? error.message : String(error);
    }

    expect(thrownMessage).toMatch(errorPattern);
    expect(thrownMessage).not.toContain('SECRET_CANARY');
  });

  it('accepts findings with either npm audit success status', () => {
    expect(parseNpmAuditResult({ status: 0, stdout: JSON.stringify(findingsAudit), stderr: '' })).toEqual(findingsAudit);
    expect(parseNpmAuditResult({ status: 1, stdout: JSON.stringify(findingsAudit), stderr: '' })).toEqual(findingsAudit);
  });

  it.each([
    ['missing count', { ...cleanAudit, metadata: { vulnerabilities: { ...cleanAudit.metadata.vulnerabilities, total: undefined } } }, /count total|missing/i],
    ['negative count', { ...cleanAudit, metadata: { vulnerabilities: { ...cleanAudit.metadata.vulnerabilities, low: -1 } } }, /count low|invalid/i],
    ['unsafe count', { ...cleanAudit, metadata: { vulnerabilities: { ...cleanAudit.metadata.vulnerabilities, low: Number.MAX_SAFE_INTEGER + 1 } } }, /count low|invalid/i],
    ['map mismatch', { ...findingsAudit, metadata: { vulnerabilities: { ...findingsAudit.metadata.vulnerabilities, total: 2 } } }, /map|total/i],
    ['severity mismatch', { ...findingsAudit, metadata: { vulnerabilities: { ...findingsAudit.metadata.vulnerabilities, high: 0, total: 1 } } }, /count|total/i],
    ['category mismatch', { ...findingsAudit, metadata: { vulnerabilities: { ...findingsAudit.metadata.vulnerabilities, high: 0, low: 1 } } }, /severity|count|match/i],
  ] as const)('rejects %s', (_label, payload, errorPattern) => {
    expect(() => parseNpmAuditResult({ status: 0, stdout: JSON.stringify(payload), stderr: '' })).toThrow(errorPattern);
  });
});

describe('dependency audit report command', () => {
  function runInjectedAudit(
    result: { status: number | null; signal?: string | null; error?: unknown; stdout: string; stderr?: string },
    options: { enforce?: boolean; existingReport?: string } = {},
  ) {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'dependency-audit-unit-'));
    const npmCliPath = path.join(projectRoot, 'fixture-npm-cli.cjs');
    writeFileSync(npmCliPath, '');
    const reportPath = path.join(projectRoot, 'reports', 'dependency-audit-root-production.json');
    if (options.existingReport !== undefined) {
      mkdirSync(path.dirname(reportPath), { recursive: true });
      writeFileSync(reportPath, options.existingReport);
    }
    const errors: string[] = [];
    const output: string[] = [];

    try {
      const exitCode = runDependencyAudit({
        projectRoot,
        production: true,
        enforce: options.enforce ?? false,
        npmCliPath,
        spawnSyncImpl: () => result,
        writeError: message => errors.push(message),
        writeOutput: message => output.push(message),
        generatedAt: '2026-01-01T00:00:00.000Z',
      });
      return {
        exitCode,
        errors,
        output,
        reportPath,
        reportContent: existsSync(reportPath) ? readFileSync(reportPath, 'utf8') : undefined,
      };
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  }

  it('writes a compatible report and keeps non-enforced findings green', () => {
    const result = runInjectedAudit({ status: 0, stdout: JSON.stringify(findingsAudit), stderr: '' });

    expect(result.exitCode).toBe(0);
    expect(result.output.join(' ')).toMatch(/total=1/);
    expect(result.errors).toEqual([]);
    expect(JSON.parse(result.reportContent ?? '')).toMatchObject({
      generatedAt: '2026-01-01T00:00:00.000Z',
      workspace: 'root',
      scope: 'production',
      vulnerabilities: { high: 1, total: 1 },
      packages: [{ name: 'fixture-package', severity: 'high' }],
    });
  });

  it.each([0, 1] as const)('returns 1 only when enforcement is requested for valid findings with status %d', status => {
    const result = runInjectedAudit({ status, stdout: JSON.stringify(findingsAudit), stderr: '' }, { enforce: true });

    expect(result.exitCode).toBe(1);
    expect(result.errors.join(' ')).toMatch(/security gate failed/i);
  });

  it('returns 2 without changing an existing report for invalid output', () => {
    const existingReport = '{"preserved":true}\n';
    const result = runInjectedAudit({
      status: 0,
      stdout: '',
      stderr: 'https://fixture.invalid/diagnostic-token',
    }, { existingReport });

    expect(result.exitCode).toBe(2);
    expect(result.errors.join(' ')).toMatch(/valid JSON|empty/i);
    expect(result.errors.join(' ')).not.toContain('diagnostic-token');
    expect(result.reportPath).toBeTruthy();
    expect(result.reportContent).toBe(existingReport);
  });

  it('returns 2 when process startup throws without exposing the thrown message', () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'dependency-audit-spawn-'));
    const npmCliPath = path.join(projectRoot, 'fixture-npm-cli.cjs');
    writeFileSync(npmCliPath, '');
    const errors: string[] = [];

    try {
      const exitCode = runDependencyAudit({
        projectRoot,
        npmCliPath,
        spawnSyncImpl: () => {
          throw new Error('fixture-secret-token');
        },
        writeError: message => errors.push(message),
      });

      expect(exitCode).toBe(2);
      expect(errors.join(' ')).toMatch(/could not be started/i);
      expect(errors.join(' ')).not.toContain('fixture-secret-token');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});

describe('dependency audit module import', () => {
  it('does not run the CLI when imported as a module', () => {
    const projectRoot = mkdtempSync(path.join(tmpdir(), 'dependency-audit-import-'));
    const npmCliPath = path.join(projectRoot, 'fixture-npm-cli.cjs');
    const markerPath = path.join(projectRoot, 'npm-fixture-invoked.txt');
    const importUrl = pathToFileURL(scriptPath).href;
    writeFileSync(npmCliPath, `
require('node:fs').writeFileSync(${JSON.stringify(markerPath)}, 'invoked');
process.stdout.write(JSON.stringify(${JSON.stringify(cleanAudit)}));
process.exit(0);
`);

    try {
      const result = spawnSync(
        process.execPath,
        ['--input-type=module', '-e', `import(${JSON.stringify(importUrl)})`],
        {
          cwd: projectRoot,
          env: { ...process.env, npm_execpath: npmCliPath },
          encoding: 'utf8',
          timeout: 5_000,
          windowsHide: true,
        },
      );
      const reportPath = path.join(projectRoot, 'reports', 'dependency-audit-root-all.json');

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
      expect(existsSync(markerPath)).toBe(false);
      expect(existsSync(reportPath)).toBe(false);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});

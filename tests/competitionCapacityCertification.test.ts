// @vitest-environment node
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const scriptUrl = new URL('../workers/scripts/certify-live-exam-capacity.cjs', import.meta.url);
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const exampleConfig = JSON.parse(readFileSync(new URL('../scripts/live-exam-load-test.example.json', import.meta.url), 'utf8'));

function loadCertificationModule(): any | null {
  if (!existsSync(scriptUrl)) return null;
  return require(fileURLToPath(scriptUrl));
}

const report = (overrides: Record<string, unknown> = {}) => ({
  benchmarkRunId: 'run-green-100',
  build: { sha: 'abc123' },
  config: { runtimeConfigVersion: 'cfg-1' },
  polling: { profileVersion: 'poll-1', statusRounds: 3 },
  summary: {
    concurrency: 100,
    statusP95Ms: 499,
    submitP95Ms: 1_999,
    lostAnswers: 0,
    duplicateFailures: 0,
    d1OverloadErrors: 0,
    app5xx: 0,
    networkErrors: 0,
    ...overrides,
  },
});

describe('Live Exam capacity certification', () => {
  it('certifies only a benchmark that passes every capacity gate', () => {
    const certification = loadCertificationModule();
    expect(certification).not.toBeNull();
    if (!certification) return;

    expect(certification.certifyCapacityReport(report())).toMatchObject({
      benchmarkRunId: 'run-green-100',
      buildSha: 'abc123',
      runtimeConfigVersion: 'cfg-1',
      pollingProfileVersion: 'poll-1',
      certifiedConcurrentStudents: 100,
    });

    expect(() => certification.certifyCapacityReport(report({ lostAnswers: 1 })))
      .toThrow(/CAPACITY_CERTIFICATION_FAILED/);
  });

  it('keeps the historical 100 and 150 concurrency evidence uncertified', () => {
    const certification = loadCertificationModule();
    expect(certification).not.toBeNull();
    if (!certification) return;

    expect(() => certification.certifyCapacityReport(report({
      statusP95Ms: 2170.9,
      submitP95Ms: 2259.4,
    }))).toThrow(/CAPACITY_CERTIFICATION_FAILED/);
    expect(() => certification.certifyCapacityReport(report({
      concurrency: 150,
      networkErrors: 1,
    }))).toThrow(/CAPACITY_CERTIFICATION_FAILED/);
  });

  it('wires certification metadata through the example config and package script', () => {
    expect(exampleConfig).toMatchObject({
      buildSha: expect.any(String),
      runtimeConfigVersion: expect.any(String),
      pollingProfileVersion: expect.any(String),
    });
    expect(packageJson.scripts?.['capacity:certify']).toBe('node workers/scripts/certify-live-exam-capacity.cjs');
  });
});

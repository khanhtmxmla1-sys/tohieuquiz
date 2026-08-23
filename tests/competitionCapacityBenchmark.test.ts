// @vitest-environment node
import * as loadTestModule from '../scripts/live-exam-load-test';
import { describe, expect, it } from 'vitest';

describe('Live Exam benchmark capacity metadata', () => {
  it('builds a certification-ready report with build, config, polling, and gate metadata', () => {
    const buildBenchmarkReport = (loadTestModule as any).buildBenchmarkReport;
    expect(buildBenchmarkReport).toBeTypeOf('function');
    if (typeof buildBenchmarkReport !== 'function') return;

    const built = buildBenchmarkReport({
      benchmarkRunId: 'run-100',
      buildSha: 'abc123',
      runtimeConfigVersion: 'cfg-1',
      pollingProfileVersion: 'poll-1',
      statusRounds: 3,
      summary: {
        concurrency: 100,
        statusP95Ms: 499,
        submitP95Ms: 1_999,
        lostAnswers: 0,
        duplicateFailures: 0,
        d1OverloadErrors: 0,
        app5xx: 0,
        networkErrors: 0,
      },
    });

    expect(built).toMatchObject({
      benchmarkRunId: 'run-100',
      build: { sha: 'abc123' },
      config: { runtimeConfigVersion: 'cfg-1' },
      polling: { profileVersion: 'poll-1', statusRounds: 3 },
      gates: {
        lostAnswers: { passed: true },
        duplicateFailures: { passed: true },
        d1Overload: { passed: true },
        app5xx: { passed: true },
        networkErrors: { passed: true },
        statusP95: { passed: true },
        submitP95: { passed: true },
      },
      passed: true,
      failures: [],
    });
  });

  it('preserves the existing failure signal for non-network request errors', () => {
    expect(loadTestModule.evaluateAcceptance({
      statusP95Ms: 100,
      submitP95Ms: 500,
      lostAnswers: 0,
      duplicateFailures: 0,
      d1OverloadErrors: 0,
      app5xx: 0,
      networkErrors: 0,
      requestErrors: 1,
    }).passed).toBe(false);
  });
});

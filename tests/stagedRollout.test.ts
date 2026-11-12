import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildRollbackTarget,
  buildStageTarget,
  evaluateRolloutMetrics,
  summarizeTarget,
} from '../scripts/run-staged-rollout.mjs';
import { runStagedRollout } from '../scripts/run-staged-rollout.mjs';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('staged rollout orchestration', () => {
  it('keeps a local plan network-free without production credentials', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'quizpro-staged-plan-'));
    const output = join(tempDir, 'plan.json');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('plan must not call network'));
    try {
      const code = await runStagedRollout([
        '--action', 'plan',
        '--site', 'https://staging.example',
        '--api', 'https://api.staging.example',
        '--flag', 'fixture_flag',
        '--stage', 'admin-only',
        '--output', output,
      ], {});

      expect(code).toBe(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('keeps a read-only evaluation network-free even when credentials are present', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'quizpro-staged-evaluate-'));
    const output = join(tempDir, 'evaluate.json');
    const metrics = join(tempDir, 'metrics.json');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('read-only evaluate must not call network'));
    writeFileSync(metrics, JSON.stringify({ error5xxRatePercent: 0 }), 'utf8');
    try {
      const code = await runStagedRollout([
        '--action', 'evaluate',
        '--site', 'https://www.thtohieu.com',
        '--api', 'https://api.thtohieu.com',
        '--production-targets',
        '--flag', 'fixture_flag',
        '--stage', 'admin-only',
        '--metrics', metrics,
        '--observation-started-at', '2026-11-01T00:00:00.000Z',
        '--output', output,
      ], { SMOKE_ADMIN_USERNAME: 'fixture-admin', SMOKE_ADMIN_PASSWORD: 'fixture-password' });

      expect(code).toBe(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it.each(['apply', 'rollback'])('blocks credentialed %s before login when the target is untrusted', async (action) => {
    const tempDir = mkdtempSync(join(tmpdir(), 'quizpro-staged-target-'));
    const output = join(tempDir, `${action}.json`);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network should not run'));
    try {
      const code = await runStagedRollout([
        '--action', action,
        '--site', 'https://www.thtohieu.com.untrusted.example',
        '--api', 'https://api.thtohieu.com.untrusted.example',
        '--flag', 'fixture_flag',
        '--stage', 'admin-only',
        '--output', output,
      ], { SMOKE_ADMIN_USERNAME: 'fixture-admin', SMOKE_ADMIN_PASSWORD: 'fixture-password' });

      expect(code).toBe(1);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('blocks evaluate auto-rollback before login when the target is untrusted', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'quizpro-staged-target-'));
    const output = join(tempDir, 'evaluate.json');
    const metrics = join(tempDir, 'metrics.json');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network should not run'));
    writeFileSync(metrics, JSON.stringify({ error5xxRatePercent: 2 }), 'utf8');
    try {
      const code = await runStagedRollout([
        '--action', 'evaluate',
        '--auto-rollback',
        '--site', 'https://www.thtohieu.com.untrusted.example',
        '--api', 'https://api.thtohieu.com.untrusted.example',
        '--flag', 'fixture_flag',
        '--stage', 'admin-only',
        '--metrics', metrics,
        '--observation-started-at', '2026-11-01T00:00:00.000Z',
        '--output', output,
      ], { SMOKE_ADMIN_USERNAME: 'fixture-admin', SMOKE_ADMIN_PASSWORD: 'fixture-password' });

      expect(code).toBe(1);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('builds the required rollout sequence without exposing pilot identifiers in summaries', () => {
    expect(buildStageTarget('admin-only')).toMatchObject({ audience: 'admin', percentage: 100 });
    expect(buildStageTarget('teachers-5')).toMatchObject({ audience: 'teacher', percentage: 5 });
    expect(buildStageTarget('pilot-class', 'class-private')).toMatchObject({
      audience: 'teacher', percentage: 0, allowClasses: ['class-private'],
    });
    expect(buildStageTarget('teachers-25')).toMatchObject({ audience: 'teacher', percentage: 25 });
    expect(buildStageTarget('full')).toMatchObject({ audience: 'all', percentage: 100 });
    expect(JSON.stringify(summarizeTarget(buildStageTarget('pilot-class', 'class-private'))))
      .not.toContain('class-private');
  });

  it('can roll the first admin-only stage back to the disabled baseline', () => {
    expect(buildRollbackTarget('admin-only')).toEqual({
      enabled: false,
      audience: 'all',
      percentage: 0,
      allowUsers: [],
      allowClasses: [],
    });
  });

  it('keeps each stage observing until its 24-48 hour window completes', () => {
    const result = evaluateRolloutMetrics({
      stage: 'pilot-class',
      observationStartedAt: '2026-07-28T00:00:00.000Z',
      now: new Date('2026-07-29T00:00:00.000Z'),
      metrics: {},
    });
    expect(result).toMatchObject({ status: 'observing', requiredHours: 48, elapsedHours: 24 });
  });

  it('blocks on every mandatory stop condition', () => {
    const result = evaluateRolloutMetrics({
      stage: 'teachers-25',
      observationStartedAt: '2026-07-20T00:00:00.000Z',
      now: new Date('2026-07-29T00:00:00.000Z'),
      metrics: {
        error5xxRatePercent: 1.01,
        baselineClientErrorRate: 2,
        clientErrorRate: 4.1,
        baselineP95Ms: 100,
        p95Ms: 131,
        dataCorruption: true,
        authAnomaly: true,
      },
    });
    expect(result.status).toBe('blocked');
    expect(result.breaches).toEqual([
      '5xx_rate', 'client_errors', 'p95_latency', 'data_corruption', 'auth_anomaly',
    ]);
  });

  it('blocks canonical scoring rollout on assessment-specific stop conditions', () => {
    const result = evaluateRolloutMetrics({
      stage: 'teachers-5',
      observationStartedAt: '2026-07-20T00:00:00.000Z',
      now: new Date('2026-07-29T00:00:00.000Z'),
      metrics: {
        scoringInvalidRatePercent: 1.01,
        validation422RatePercent: 1.01,
        unexplainedScoreMismatchCount: 1,
        submissionFailureRatePercent: 1.01,
        liveExamFailureRatePercent: 1.01,
      },
    });

    expect(result.status).toBe('blocked');
    expect(result.breaches).toEqual([
      'scoring_invalid_rate',
      'validation_422_rate',
      'unexplained_score_mismatch',
      'submission_failure_rate',
      'live_exam_failure_rate',
    ]);
  });

  it('marks a healthy fully observed stage ready', () => {
    const result = evaluateRolloutMetrics({
      stage: 'teachers-5',
      observationStartedAt: '2026-07-27T00:00:00.000Z',
      now: new Date('2026-07-29T00:00:00.000Z'),
      metrics: {
        error5xxRatePercent: 0.2,
        baselineClientErrorRate: 2,
        clientErrorRate: 3,
        baselineP95Ms: 100,
        p95Ms: 120,
      },
    });
    expect(result).toMatchObject({ status: 'ready', breaches: [] });
  });
});

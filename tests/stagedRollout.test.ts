import { describe, expect, it } from 'vitest';
import {
  buildStageTarget,
  evaluateRolloutMetrics,
  summarizeTarget,
} from '../scripts/run-staged-rollout.mjs';

describe('staged rollout orchestration', () => {
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

import { describe, expect, it, vi } from 'vitest';
import {
  buildScoringShadowObservation,
  recordScoringShadowObservation,
  resolveQuizScoringRolloutModeFromDecisions,
} from '../workers/src/services/quizScoringRolloutService';

describe('quiz scoring rollout safety', () => {
  it('prefers canonical, then shadow, then compatibility', () => {
    expect(resolveQuizScoringRolloutModeFromDecisions(true, true)).toBe('canonical');
    expect(resolveQuizScoringRolloutModeFromDecisions(false, true)).toBe('shadow');
    expect(resolveQuizScoringRolloutModeFromDecisions(false, false)).toBe('compatibility');
  });

  it('builds privacy-safe shadow comparison data', () => {
    const observation = buildScoringShadowObservation({
      quizId: 'quiz-a',
      canonicalScore: 7.5,
      canonicalCorrectCount: 3,
      canonicalTotalQuestions: 4,
      submittedScore: 10,
      submittedCorrectCount: 4,
      submittedTotalQuestions: 4,
    });
    expect(observation).toEqual({
      event: 'quiz_scoring_shadow_comparison',
      quizId: 'quiz-a',
      canonicalScore: 7.5,
      canonicalCorrectCount: 3,
      canonicalTotalQuestions: 4,
      submittedScore: 10,
      submittedCorrectCount: 4,
      submittedTotalQuestions: 4,
      scoreDelta: -2.5,
      correctCountDelta: -1,
    });
    expect(JSON.stringify(observation)).not.toMatch(/student|username|answer/i);
  });

  it('logs comparisons only in shadow mode', () => {
    const logger = vi.fn();
    const input = {
      quizId: 'quiz-a', canonicalScore: 5, canonicalCorrectCount: 1,
      canonicalTotalQuestions: 2, submittedScore: 10, submittedCorrectCount: 2,
      submittedTotalQuestions: 2,
    };
    recordScoringShadowObservation('compatibility', input, logger);
    recordScoringShadowObservation('canonical', input, logger);
    expect(logger).not.toHaveBeenCalled();
    recordScoringShadowObservation('shadow', input, logger);
    expect(logger).toHaveBeenCalledWith(expect.stringContaining('quiz_scoring_shadow_comparison'));
  });
});

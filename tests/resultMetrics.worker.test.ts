import { describe, expect, it } from 'vitest';
import { deriveResultMetricsFromAnswers } from '../workers/src/routes/results';

describe('deriveResultMetricsFromAnswers', () => {
  it('derives consistent score fields from fully graded answers', () => {
    const answers = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [
        `q${index + 1}`,
        { selectedAnswer: index === 6 ? 'A' : 'C', isCorrect: index !== 6 },
      ]),
    );

    expect(deriveResultMetricsFromAnswers(answers, 10)).toEqual({
      score: 9,
      correctCount: 9,
      totalQuestions: 10,
    });
  });

  it('ignores metadata keys when counting graded answers', () => {
    expect(deriveResultMetricsFromAnswers({
      q1: { isCorrect: true },
      q2: { isCorrect: false },
      _session: { source: 'quiz-player' },
    }, 2)).toEqual({ score: 5, correctCount: 1, totalQuestions: 2 });
  });

  it('falls back to submitted metrics when answers are incomplete or ungraded', () => {
    expect(deriveResultMetricsFromAnswers({ q1: 'A' }, 1)).toBeNull();
    expect(deriveResultMetricsFromAnswers({ q1: { isCorrect: true } }, 2)).toBeNull();
  });
});

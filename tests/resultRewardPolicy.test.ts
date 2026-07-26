import { describe, expect, it } from 'vitest';
import { calculateResultReward } from '../workers/src/gamification/resultRewardPolicy';

describe('calculateResultReward', () => {
  it.each([
    [{ score: 0, correctCount: 0, totalQuestions: 10 }, { exp: 10, coins: 0 }],
    [{ score: 4, correctCount: 4, totalQuestions: 10 }, { exp: 30, coins: 0 }],
    [{ score: 5, correctCount: 5, totalQuestions: 10 }, { exp: 35, coins: 10 }],
    [{ score: 7, correctCount: 7, totalQuestions: 10 }, { exp: 45, coins: 15 }],
    [{ score: 8, correctCount: 8, totalQuestions: 10 }, { exp: 60, coins: 15 }],
    [{ score: 9, correctCount: 9, totalQuestions: 10 }, { exp: 65, coins: 20 }],
    [{ score: 10, correctCount: 10, totalQuestions: 10 }, { exp: 90, coins: 30 }],
  ])('returns the approved score-band reward for %o', (input, expected) => {
    expect(calculateResultReward(input)).toEqual(expected);
  });

  it('returns no reward for an invalid empty result', () => {
    expect(calculateResultReward({ score: 10, correctCount: 0, totalQuestions: 0 })).toEqual({
      exp: 0,
      coins: 0,
    });
  });

  it('clamps inconsistent counts before calculating accuracy', () => {
    expect(calculateResultReward({ score: 10, correctCount: 99, totalQuestions: 10 })).toEqual({
      exp: 90,
      coins: 30,
    });
  });
});

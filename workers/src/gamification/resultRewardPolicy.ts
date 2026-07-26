export interface ResultRewardInput {
  score: number;
  correctCount: number;
  totalQuestions: number;
}

export interface ResultReward {
  exp: number;
  coins: number;
}

const getCoinsForScore = (score: number): number => {
  if (score >= 10) return 30;
  if (score >= 9) return 20;
  if (score >= 7) return 15;
  if (score >= 5) return 10;
  return 0;
};

export const calculateResultReward = ({
  score,
  correctCount,
  totalQuestions,
}: ResultRewardInput): ResultReward => {
  if (!Number.isFinite(totalQuestions) || totalQuestions <= 0) {
    return { exp: 0, coins: 0 };
  }

  const safeTotal = Math.max(1, Math.floor(totalQuestions));
  const safeCorrect = Math.min(safeTotal, Math.max(0, Math.floor(correctCount || 0)));
  const safeScore = Math.min(10, Math.max(0, Number(score) || 0));
  const accuracyPercent = (safeCorrect / safeTotal) * 100;
  const accuracyBands = Math.min(10, Math.floor(accuracyPercent / 10));

  let exp = 10 + accuracyBands * 5;
  if (safeScore >= 8) exp += 10;
  if (safeScore >= 10) exp += 20;

  return {
    exp,
    coins: getCoinsForScore(safeScore),
  };
};

import { calculateLiveExamRewardAmounts } from '../../gamification/liveExamReward';

export function calculateLiveExamRewards(participant: any) {
  const score = Math.max(0, Number(participant?.score) || 0);
  const reward = calculateLiveExamRewardAmounts(participant);
  return {
    participant: {
      score,
      rank: Number(participant?.rank) || 0,
      correctCount: Number(participant?.correct_count) || 0,
      wrongCount: Number(participant?.wrong_count) || 0,
      submittedAt: participant?.submitted_at,
    },
    rewards: {
      coins: reward.coins,
      xp: reward.exp,
      bonusCoins: reward.bonusCoins > 0 ? reward.bonusCoins : undefined,
    },
  };
}

export function calculateLiveExamRewards(participant: any) {
  const score = participant.score || 0;
  let bonusCoins = 0;
  if (participant.rank === 1) bonusCoins = 500;
  else if (participant.rank === 2) bonusCoins = 300;
  else if (participant.rank === 3) bonusCoins = 200;
  else if (participant.rank === 4) bonusCoins = 100;
  else if (participant.rank > 4) bonusCoins = 50;

  return {
    participant: {
      score,
      rank: participant.rank || 0,
      correctCount: participant.correct_count || 0,
      wrongCount: participant.wrong_count || 0,
      submittedAt: participant.submitted_at,
    },
    rewards: {
      coins: score,
      xp: score * 10,
      bonusCoins: bonusCoins > 0 ? bonusCoins : undefined,
    },
  };
}

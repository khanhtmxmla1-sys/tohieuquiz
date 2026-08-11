import { applyStudentReward } from './studentRewardLedger';

export interface LiveExamRewardAmounts {
  baseCoins: number;
  bonusCoins: number;
  coins: number;
  exp: number;
}

export const calculateLiveExamRewardAmounts = (participant: any): LiveExamRewardAmounts => {
  const score = Math.max(0, Number(participant?.score) || 0);
  const rank = Math.max(0, Math.floor(Number(participant?.rank) || 0));
  let bonusCoins = 0;
  if (rank === 1) bonusCoins = 500;
  else if (rank === 2) bonusCoins = 300;
  else if (rank === 3) bonusCoins = 200;
  else if (rank === 4) bonusCoins = 100;
  else if (rank > 4) bonusCoins = 50;

  const baseCoins = Math.floor(score);
  const exp = Math.floor(score * 10);
  return {
    baseCoins,
    bonusCoins,
    coins: baseCoins + bonusCoins,
    exp,
  };
};

export const awardClosedLiveExamRewards = async (
  db: D1Database,
  sessionId: string,
): Promise<void> => {
  const session = await db.prepare(`
    SELECT id, status
    FROM live_exam_sessions
    WHERE id = ?
    LIMIT 1
  `).bind(sessionId).first<any>();
  if (!session) throw new Error('Live exam session not found');
  if (String(session.status) !== 'closed') {
    throw new Error('Live exam rewards can only be awarded after the session is closed');
  }

  const participants = await db.prepare(`
    SELECT id, student_id, username, score, rank, correct_count, wrong_count, submitted_at
    FROM live_exam_participants
    WHERE live_exam_id = ?
      AND score IS NOT NULL
      AND rank IS NOT NULL
    ORDER BY rank ASC, submitted_at ASC, student_id ASC
  `).bind(sessionId).all<any>();

  const errors: unknown[] = [];
  for (const participant of participants.results || []) {
    const studentId = String(participant.student_id || '').trim();
    const username = String(participant.username || '').trim();
    if (!studentId || !username) {
      errors.push(new Error(`Participant ${String(participant.id || '')} has no canonical student identity`));
      continue;
    }

    const reward = calculateLiveExamRewardAmounts(participant);
    try {
      await applyStudentReward(db, {
        studentId,
        username,
        sourceType: 'LIVE_EXAM',
        sourceKey: sessionId,
        rewardType: 'COINS_EXP',
        coinsDelta: reward.coins,
        expDelta: reward.exp,
        payload: {
          sessionId,
          participantId: String(participant.id || ''),
          score: Number(participant.score) || 0,
          rank: Number(participant.rank) || 0,
          correctCount: Number(participant.correct_count) || 0,
          wrongCount: Number(participant.wrong_count) || 0,
          baseCoins: reward.baseCoins,
          bonusCoins: reward.bonusCoins,
          awardedCoins: reward.coins,
          awardedExp: reward.exp,
        },
      });
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length > 0) {
    throw new AggregateError(errors, `Failed to award ${errors.length} live exam participant reward(s)`);
  }
};

export const retryMissingClosedLiveExamRewards = async (
  db: D1Database,
  limit = 25,
): Promise<number> => {
  const rows = await db.prepare(`
    SELECT DISTINCT sessions.id
    FROM live_exam_sessions sessions
    JOIN live_exam_participants participants
      ON participants.live_exam_id = sessions.id
    WHERE sessions.status = 'closed'
      AND sessions.archived_at IS NULL
      AND participants.score IS NOT NULL
      AND participants.rank IS NOT NULL
      AND participants.student_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM student_reward_ledger ledger
        WHERE ledger.student_id = participants.student_id
          AND ledger.source_type = 'LIVE_EXAM'
          AND ledger.source_key = sessions.id
      )
    ORDER BY sessions.closed_at ASC, sessions.id ASC
    LIMIT ?
  `).bind(Math.max(1, Math.min(100, Math.floor(limit)))).all<any>();

  let processed = 0;
  for (const row of rows.results || []) {
    await awardClosedLiveExamRewards(db, String(row.id));
    processed += 1;
  }
  return processed;
};

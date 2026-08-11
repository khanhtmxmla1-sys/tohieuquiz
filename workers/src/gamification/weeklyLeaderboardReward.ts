import { getWeekUtcRange } from '../gameLoop/dateKeys';
import { applyStudentReward } from './studentRewardLedger';

const WEEKLY_LEADERBOARD_REWARDS = [
  { rank: 1, coins: 500, badge: 'weekly_champion_1st' },
  { rank: 2, coins: 300, badge: 'weekly_champion_2nd' },
  { rank: 3, coins: 150, badge: 'weekly_champion_3rd' },
] as const;

export interface WeeklyLeaderboardAwardResult {
  studentId: string;
  username: string;
  rank: number;
  coins: number;
  badge: string;
  alreadyClaimed: boolean;
}

export const awardWeeklyLeaderboardRewards = async (
  db: D1Database,
  weekKey: string,
): Promise<WeeklyLeaderboardAwardResult[]> => {
  const { startIso, endIsoExclusive } = getWeekUtcRange(weekKey);
  const topStudents = await db.prepare(`
    SELECT r.student_id,
           s.username,
           SUM(COALESCE(r.score, 0)) AS total_score,
           SUM(COALESCE(r.correct_count, 0)) AS total_correct,
           MIN(r.submitted_at) AS first_submitted_at
    FROM results r
    JOIN students s ON s.id = r.student_id
    WHERE r.student_id IS NOT NULL
      AND r.submitted_at >= ?
      AND r.submitted_at < ?
    GROUP BY r.student_id, s.username
    ORDER BY total_score DESC,
             total_correct DESC,
             first_submitted_at ASC,
             r.student_id ASC
    LIMIT 3
  `).bind(startIso, endIsoExclusive).all<any>();

  const results: WeeklyLeaderboardAwardResult[] = [];
  for (let index = 0; index < (topStudents.results || []).length; index += 1) {
    const student = topStudents.results[index];
    const reward = WEEKLY_LEADERBOARD_REWARDS[index];
    if (!reward) break;

    const studentId = String(student.student_id || '').trim();
    const username = String(student.username || '').trim();
    if (!studentId || !username) continue;
    const now = new Date().toISOString();
    const achievementId = `ach-${crypto.randomUUID()}`;
    const historyId = `lbrew-${crypto.randomUUID()}`;
    const rewardResult = await applyStudentReward(db, {
      studentId,
      username,
      sourceType: 'WEEKLY_LEADERBOARD',
      sourceKey: weekKey,
      rewardType: 'COINS_BADGE',
      coinsDelta: reward.coins,
      expDelta: 0,
      payload: {
        weekKey,
        rank: reward.rank,
        coins: reward.coins,
        badge: reward.badge,
        totalScore: Number(student.total_score) || 0,
        totalCorrect: Number(student.total_correct) || 0,
        firstSubmittedAt: String(student.first_submitted_at || ''),
      },
      extraStatements: [
        db.prepare(`
          INSERT OR IGNORE INTO student_achievement_unlocks
          (id, username, achievement_code, unlocked_at, metadata)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          achievementId,
          username,
          reward.badge,
          now,
          JSON.stringify({ weekKey, rank: reward.rank }),
        ),
        db.prepare(`
          INSERT INTO leaderboard_rewards_history
          (id, username, period, period_key, rank, coins_awarded, badge_code, awarded_at)
          VALUES (?, ?, 'weekly', ?, ?, ?, ?, ?)
        `).bind(
          historyId,
          username,
          weekKey,
          reward.rank,
          reward.coins,
          reward.badge,
          now,
        ),
      ],
    });

    results.push({
      studentId,
      username,
      rank: reward.rank,
      coins: reward.coins,
      badge: reward.badge,
      alreadyClaimed: rewardResult.alreadyClaimed,
    });
  }

  return results;
};

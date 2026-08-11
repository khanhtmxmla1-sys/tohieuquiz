import { recordQuizActivity } from '../gameLoop/activityService';
import { getCurrentWeekKey, getWeekUtcRange } from '../gameLoop/dateKeys';
import { normalizeGameLoopCategory } from '../gameLoop/normalization';

export interface RewardReconciliationRow {
  studentId: string;
  username: string;
  walletCoins: number;
  ledgerCoins: number;
  difference: number;
}

export interface SuspiciousRewardGrowthRow {
  studentId: string;
  username: string;
  walletCoins: number;
  coinsGrowth: number;
  rewardEvents: number;
  largestSingleDelta: number;
}

export const getRewardReconciliationReport = async (
  db: D1Database,
  limit = 100,
): Promise<RewardReconciliationRow[]> => {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit) || 100)));
  const rows = await db.prepare(`
    SELECT student_id, username, wallet_coins, ledger_coins, difference
    FROM student_reward_reconciliation
    WHERE difference <> 0
    ORDER BY ABS(difference) DESC, student_id ASC
    LIMIT ?
  `).bind(safeLimit).all<any>();
  return (rows.results || []).map((row: any) => ({
    studentId: String(row.student_id || ''),
    username: String(row.username || ''),
    walletCoins: Number(row.wallet_coins) || 0,
    ledgerCoins: Number(row.ledger_coins) || 0,
    difference: Number(row.difference) || 0,
  }));
};

export const getSuspiciousRewardGrowthReport = async (
  db: D1Database,
  sinceIso: string,
  thresholdCoins = 1_000,
  limit = 100,
): Promise<SuspiciousRewardGrowthRow[]> => {
  const threshold = Math.max(1, Math.floor(Number(thresholdCoins) || 1_000));
  const safeLimit = Math.max(1, Math.min(500, Math.floor(Number(limit) || 100)));
  const rows = await db.prepare(`
    SELECT s.id AS student_id,
           s.username,
           COALESCE(s.coins, 0) AS wallet_coins,
           SUM(CASE WHEN l.coins_delta > 0 THEN l.coins_delta ELSE 0 END) AS coins_growth,
           COUNT(*) AS reward_events,
           MAX(CASE WHEN l.coins_delta > 0 THEN l.coins_delta ELSE 0 END) AS largest_single_delta
    FROM student_reward_ledger l
    JOIN students s ON s.id = l.student_id
    WHERE l.created_at >= ?
      AND l.source_type <> 'BALANCE_OPENING'
    GROUP BY s.id, s.username, s.coins
    HAVING SUM(CASE WHEN l.coins_delta > 0 THEN l.coins_delta ELSE 0 END) >= ?
    ORDER BY coins_growth DESC, reward_events DESC, s.id ASC
    LIMIT ?
  `).bind(sinceIso, threshold, safeLimit).all<any>();
  return (rows.results || []).map((row: any) => ({
    studentId: String(row.student_id || ''),
    username: String(row.username || ''),
    walletCoins: Number(row.wallet_coins) || 0,
    coinsGrowth: Number(row.coins_growth) || 0,
    rewardEvents: Number(row.reward_events) || 0,
    largestSingleDelta: Number(row.largest_single_delta) || 0,
  }));
};

export const rebuildCurrentWeekProgress = async (
  db: D1Database,
  now = new Date(),
): Promise<{ weekKey: string; scanned: number; recorded: number; alreadyRecorded: number }> => {
  const weekKey = getCurrentWeekKey(now);
  const { startIso, endIsoExclusive } = getWeekUtcRange(weekKey);
  const rows = await db.prepare(`
    SELECT r.id,
           r.student_id,
           r.class_id,
           r.quiz_id,
           r.correct_count,
           r.total_questions,
           s.username,
           COALESCE(q.category, '') AS category
    FROM results r
    JOIN students s ON s.id = r.student_id
    LEFT JOIN quizzes q ON q.id = r.quiz_id
    WHERE r.submitted_at >= ?
      AND r.submitted_at < ?
      AND r.student_id IS NOT NULL
      AND r.class_id IS NOT NULL
    ORDER BY r.submitted_at ASC, r.id ASC
  `).bind(startIso, endIsoExclusive).all<any>();

  let recorded = 0;
  let alreadyRecorded = 0;
  for (const row of rows.results || []) {
    const duplicate = await recordQuizActivity(db, String(row.username), {
      activityId: String(row.id),
      quizId: String(row.quiz_id || ''),
      studentId: String(row.student_id),
      classId: String(row.class_id),
      category: normalizeGameLoopCategory(String(row.category || '')),
      correctCount: Math.max(0, Math.floor(Number(row.correct_count) || 0)),
      totalQuestions: Math.max(0, Math.floor(Number(row.total_questions) || 0)),
    });
    if (duplicate) alreadyRecorded += 1;
    else recorded += 1;
  }

  return {
    weekKey,
    scanned: (rows.results || []).length,
    recorded,
    alreadyRecorded,
  };
};

import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamService from '../../services/liveExamService';
import { parseRewardPayload } from '../../gamification/studentRewardLedger';
import { authenticateStudent, isAuthResponse } from './auth';
import type { LiveExamRouteHandler } from './routeContext';
import { liveExamErrorResponse } from './responses';

interface LiveExamRewardReceiptPayload extends Record<string, unknown> {
  baseCoins?: number;
  bonusCoins?: number;
  awardedCoins?: number;
  awardedExp?: number;
}

// GET /api/live-exam/:id/results
// Read-only by design: closing/scoring/rewarding happens in the control/cron paths.
export const handleResultsRoute: LiveExamRouteHandler = async (context) => {
  if (!/^\/api\/live-exam\/[^/]+\/results$/.test(context.path) || context.method !== 'GET') {
    return null;
  }
  const auth = await authenticateStudent(context);
  if (isAuthResponse(auth)) return auth.response;
  const sessionId = context.path.split('/')[3];
  if (!sessionId) return errorResponse('Invalid session ID');

  try {
    const session = await LiveExamService.getLiveExamById(context.db, sessionId);
    if (!session) return errorResponse('Session not found', 404);
    if (session.status !== 'closed') return errorResponse('Results not available yet', 400);

    const participant = await context.db.prepare(`
      SELECT * FROM live_exam_participants
      WHERE live_exam_id = ? AND student_id = ?
    `).bind(sessionId, auth.data.studentId).first<any>();
    if (!participant) return errorResponse('Participant not found', 404);

    const rewardReceipt = await context.db.prepare(`
      SELECT id, student_id, source_type, source_key, reward_type,
             coins_delta, exp_delta, payload_json, created_at
      FROM student_reward_ledger
      WHERE student_id = ? AND source_type = 'LIVE_EXAM' AND source_key = ?
      LIMIT 1
    `).bind(auth.data.studentId, sessionId).first<any>();
    const wallet = await context.db.prepare(`
      SELECT coins
      FROM students
      WHERE id = ?
      LIMIT 1
    `).bind(auth.data.studentId).first<any>();
    const storedReward = rewardReceipt
      ? parseRewardPayload<LiveExamRewardReceiptPayload>(rewardReceipt, {})
      : {};
    const awardedCoins = rewardReceipt
      ? Number(storedReward.awardedCoins ?? rewardReceipt.coins_delta) || 0
      : 0;
    const awardedExp = rewardReceipt
      ? Number(storedReward.awardedExp ?? rewardReceipt.exp_delta) || 0
      : 0;
    const bonusCoins = rewardReceipt ? Number(storedReward.bonusCoins) || 0 : 0;

    const leaderboardVisible = session.settings.showLeaderboard !== false;
    const leaderboard = leaderboardVisible
      ? await context.db.prepare(`
          SELECT username, score, rank
          FROM live_exam_participants
          WHERE live_exam_id = ?
          ORDER BY rank ASC, submitted_at ASC, student_id ASC
          LIMIT 10
        `).bind(sessionId).all()
      : { results: [] as any[] };

    return jsonResponse({
      success: true,
      participant: {
        score: Number(participant.score) || 0,
        rank: Number(participant.rank) || 0,
        correctCount: Number(participant.correct_count) || 0,
        wrongCount: Number(participant.wrong_count) || 0,
        submittedAt: participant.submitted_at,
      },
      rewards: {
        coins: awardedCoins,
        xp: awardedExp,
        bonusCoins: bonusCoins > 0 ? bonusCoins : undefined,
      },
      awardedCoins,
      awardedExp,
      alreadyAwarded: Boolean(rewardReceipt),
      newCoins: Number(wallet?.coins) || 0,
      leaderboardVisible,
      leaderboard: leaderboard.results.map((row: any) => ({
        rank: row.rank,
        username: row.username,
        score: row.score,
      })),
    });
  } catch (error: unknown) {
    return liveExamErrorResponse(error, context.request, 'Failed to get results');
  }
};

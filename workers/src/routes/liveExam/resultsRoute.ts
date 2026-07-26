import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamService from '../../services/liveExamService';
import { authenticateStudent, isAuthResponse } from './auth';
import type { LiveExamRouteHandler } from './routeContext';
import { calculateLiveExamRewards } from './resultRewards';
import { liveExamErrorResponse } from './responses';

// GET /api/live-exam/:id/results
export const handleResultsRoute: LiveExamRouteHandler = async (context) => {
  if (!/^\/api\/live-exam\/[^/]+\/results$/.test(context.path) || context.method !== 'GET') {
    return null;
  }
  const auth = await authenticateStudent(context);
  if (isAuthResponse(auth)) return auth.response;
  const sessionId = context.path.split('/')[3];
  if (!sessionId) return errorResponse('Invalid session ID');

  try {
    await LiveExamService.checkAndAutoCloseExpiredExams(context.db);
    const session = await LiveExamService.getLiveExamById(context.db, sessionId);
    if (!session) return errorResponse('Session not found', 404);
    if (session.status !== 'closed') return errorResponse('Results not available yet', 400);

    const participant = await context.db.prepare(`
      SELECT * FROM live_exam_participants
      WHERE live_exam_id = ? AND student_id = ?
    `).bind(sessionId, auth.data.studentId).first<any>();
    if (!participant) return errorResponse('Participant not found', 404);

    const leaderboardVisible = session.settings.showLeaderboard !== false;
    const leaderboard = leaderboardVisible
      ? await context.db.prepare(`
          SELECT username, score, rank
          FROM live_exam_participants
          WHERE live_exam_id = ?
          ORDER BY rank ASC, submitted_at ASC
          LIMIT 10
        `).bind(sessionId).all()
      : { results: [] as any[] };
    const result = calculateLiveExamRewards(participant);
    return jsonResponse({
      success: true,
      ...result,
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

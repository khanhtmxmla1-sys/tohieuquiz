import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamService from '../../services/liveExamService';
import { authenticateTeacherForSession, isAuthResponse } from './auth';
import type { LiveExamRouteHandler } from './routeContext';
import { liveExamErrorResponse } from './responses';

// GET /api/live-exam/:id/participants
export const handleParticipantsRoute: LiveExamRouteHandler = async (context) => {
  if (!/^\/api\/live-exam\/[^/]+\/participants$/.test(context.path) || context.method !== 'GET') {
    return null;
  }
  const sessionId = context.path.split('/')[3];
  if (!sessionId) return errorResponse('Invalid session ID');
  const auth = await authenticateTeacherForSession(context, sessionId);
  if (isAuthResponse(auth)) return auth.response;

  try {
    await LiveExamService.markInactiveParticipants(context.db, sessionId);
    const participants = await LiveExamService.getParticipants(context.db, sessionId);
    const activityRows = await context.db.prepare(`
      SELECT * FROM live_exam_activity WHERE live_exam_id = ?
    `).bind(sessionId).all();
    const activityMap = new Map(
      activityRows.results.map((row: any) => [row.student_id, {
        currentQuestion: row.current_question,
        answeredCount: row.answered_count,
        isOnline: Boolean(row.is_online),
        lastSeen: row.last_activity,
      }]),
    );
    const combined = participants.map((participant) => {
      const activity = activityMap.get(participant.studentId);
      const lastSeen = activity?.lastSeen || participant.joinedAt;
      const isOnline = activity?.isOnline || false;
      const connectionState = isOnline
        ? 'online'
        : Date.now() - Date.parse(lastSeen) <= 60_000
          ? 'reconnecting'
          : 'offline';
      return {
        id: participant.id,
        username: participant.username,
        joinedAt: participant.joinedAt,
        submittedAt: participant.submittedAt,
        currentQuestion: activity?.currentQuestion,
        answeredCount: activity?.answeredCount || 0,
        isOnline,
        connectionState,
        lastSeen,
        individualEndsAt: participant.individualEndsAt,
      };
    });
    return jsonResponse({
      success: true,
      participants: combined,
      totalCount: participants.length,
      submittedCount: participants.filter((participant) => participant.submittedAt).length,
      onlineCount: combined.filter((participant) => participant.isOnline).length,
    });
  } catch (error: unknown) {
    return liveExamErrorResponse(error, context.request, 'Failed to get participants');
  }
};

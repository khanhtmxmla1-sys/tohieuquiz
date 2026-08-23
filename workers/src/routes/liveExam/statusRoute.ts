import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamService from '../../services/liveExamService';
import { authenticateStudent, isAuthResponse } from './auth';
import type { LiveExamRouteHandler } from './routeContext';
import { calculateTimeRemaining, liveExamErrorResponse } from './responses';

// GET /api/live-exam/:id/status
export const handleStatusRoute: LiveExamRouteHandler = async (context) => {
  if (!/^\/api\/live-exam\/[^/]+\/status$/.test(context.path) || context.method !== 'GET') {
    return null;
  }
  const auth = await authenticateStudent(context);
  if (isAuthResponse(auth)) return auth.response;
  const sessionId = context.path.split('/')[3];
  if (!sessionId) return errorResponse('Invalid session ID');
  try {
    const status = await context.db.prepare(`
      SELECT sessions.id, sessions.status, sessions.started_at, sessions.ends_at,
             sessions.paused_at, sessions.duration, sessions.chat_enabled,
             participant.id AS participant_id,
             participant.individual_ends_at,
             participant.submitted_at,
             (
               SELECT COUNT(*) FROM live_exam_participants AS counted
               WHERE counted.live_exam_id = sessions.id
             ) AS participant_count
      FROM live_exam_sessions AS sessions
      LEFT JOIN live_exam_participants AS participant
        ON participant.live_exam_id = sessions.id
       AND participant.student_id = ?
      WHERE sessions.id = ?
      LIMIT 1
    `).bind(auth.data.studentId, sessionId).first<{
      id: string;
      status: string;
      started_at: string | null;
      ends_at: string | null;
      paused_at: string | null;
      duration: number;
      chat_enabled: number;
      participant_id: string | null;
      individual_ends_at: string | null;
      submitted_at: string | null;
      participant_count: number;
    }>();
    if (!status) return errorResponse('Session not found', 404);
    if (!status.participant_id) return errorResponse('Forbidden: Join session first', 403);
    const effectiveEndsAt = LiveExamService.getEffectiveParticipantEndsAt(
      status.ends_at || undefined,
      status.individual_ends_at || undefined,
    );
    const timeRemaining = ['active', 'paused'].includes(status.status) && effectiveEndsAt
      ? calculateTimeRemaining(effectiveEndsAt, status.status === 'paused' ? status.paused_at || undefined : undefined)
      : undefined;
    return jsonResponse({
      success: true,
      session: {
        id: status.id,
        status: status.status,
        startedAt: status.started_at || undefined,
        endsAt: effectiveEndsAt,
        pausedAt: status.paused_at || undefined,
        duration: status.duration,
        chatEnabled: status.chat_enabled !== 0,
      },
      participantCount: Number(status.participant_count) || 0,
      participantSubmittedAt: status.submitted_at || undefined,
      timeRemaining,
    });
  } catch (error: unknown) {
    return liveExamErrorResponse(error, context.request, 'Failed to get status');
  }
};

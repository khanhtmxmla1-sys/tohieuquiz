import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamService from '../../services/liveExamService';
import { authenticateStudent, isAuthResponse, requireStudentParticipant } from './auth';
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
  const participant = await requireStudentParticipant(context.db, sessionId, auth.data.studentId);
  if (!participant) return errorResponse('Forbidden: Join session first', 403);

  try {
    await LiveExamService.checkAndAutoCloseExpiredExams(context.db);
    const session = await LiveExamService.getLiveExamById(context.db, sessionId);
    if (!session) return errorResponse('Session not found', 404);
    const countResult = await context.db
      .prepare('SELECT COUNT(*) as count FROM live_exam_participants WHERE live_exam_id = ?')
      .bind(sessionId)
      .first<{ count: number }>();
    const timeRemaining = session.status === 'active' && session.endsAt
      ? calculateTimeRemaining(session.endsAt)
      : undefined;
    return jsonResponse({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        startedAt: session.startedAt,
        endsAt: session.endsAt,
        duration: session.duration,
        chatEnabled: (session as any).chatEnabled ?? true,
      },
      participantCount: countResult?.count || 0,
      timeRemaining,
    });
  } catch (error: unknown) {
    return liveExamErrorResponse(error, context.request, 'Failed to get status');
  }
};

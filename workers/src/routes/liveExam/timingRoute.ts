import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamAnalyticsService from '../../services/liveExamAnalyticsService';
import * as LiveExamService from '../../services/liveExamService';
import { authenticateStudent, isAuthResponse, requireStudentParticipant } from './auth';
import type { LiveExamRouteHandler } from './routeContext';
import { liveExamErrorResponse } from './responses';

// POST /api/live-exam/:id/track-timing
export const handleTimingRoute: LiveExamRouteHandler = async (context) => {
  if (!/^\/api\/live-exam\/[^/]+\/track-timing$/.test(context.path)
    || context.method !== 'POST') return null;
  const auth = await authenticateStudent(context);
  if (isAuthResponse(auth)) return auth.response;
  const sessionId = context.path.split('/')[3];
  if (!sessionId) return errorResponse('Invalid session ID');
  const participant = await requireStudentParticipant(context.db, sessionId, auth.data.studentId);
  if (!participant) return errorResponse('Forbidden: Join session first', 403);
  if (participant.submitted_at) return errorResponse('Answers already submitted', 409);
  const session = await LiveExamService.getLiveExamById(context.db, sessionId);
  if (!session || session.archivedAt) return errorResponse('Session not found', 404);
  if (session.status !== 'active' || !session.endsAt || Date.parse(session.endsAt) <= Date.now()) {
    return errorResponse('Exam is not active', 409);
  }

  const body = await parseBody(context.request);
  if (!body) return errorResponse('Invalid JSON body');
  if (Array.isArray(body.timings)) {
    try {
      await LiveExamAnalyticsService.batchTrackQuestionTiming(
        context.db,
        sessionId,
        participant.id,
        body.timings,
      );
      return jsonResponse({ success: true });
    } catch (error: unknown) {
      return liveExamErrorResponse(error, context.request, 'Failed to track timing', 400);
    }
  }

  const { questionIndex, timeSpentSeconds } = body;
  if (typeof questionIndex !== 'number' || typeof timeSpentSeconds !== 'number') {
    return errorResponse('Invalid timing data', 400);
  }
  try {
    await LiveExamAnalyticsService.trackQuestionTiming(
      context.db,
      sessionId,
      participant.id,
      questionIndex,
      timeSpentSeconds,
    );
    return jsonResponse({ success: true });
  } catch (error: unknown) {
    return liveExamErrorResponse(error, context.request, 'Failed to track timing', 400);
  }
};

import { TeacherControlRequestSchema } from '../../../../schemas/liveExam.schema';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamService from '../../services/liveExamService';
import { authenticateTeacherForSession, isAuthResponse } from './auth';
import type { LiveExamRouteHandler } from './routeContext';
import { liveExamErrorResponse } from './responses';

// POST /api/live-exam/:id/control
export const handleControlRoute: LiveExamRouteHandler = async (context) => {
  if (!/^\/api\/live-exam\/[^/]+\/control$/.test(context.path) || context.method !== 'POST') {
    return null;
  }
  const sessionId = context.path.split('/')[3];
  if (!sessionId) return errorResponse('Invalid session ID');
  const auth = await authenticateTeacherForSession(context, sessionId);
  if (isAuthResponse(auth)) return auth.response;

  const body = await parseBody(context.request);
  if (!body) return errorResponse('Invalid JSON body');
  const validation = TeacherControlRequestSchema.safeParse({
    ...body,
    liveExamId: sessionId,
    teacherId: auth.data.username,
  });
  if (!validation.success) {
    return errorResponse(
      `Validation error: ${validation.error.issues.map((issue) => issue.message).join(', ')}`,
      400,
    );
  }

  try {
    const isAdmin = auth.data.role === 'admin';
    const requestId = validation.data.requestId
      || context.request.headers.get('x-request-id')
      || crypto.randomUUID();
    let result: Record<string, unknown> = {};

    switch (validation.data.action) {
      case 'open_session':
        await LiveExamService.openSession(context.db, sessionId, auth.data.username, isAdmin, requestId);
        break;
      case 'start_exam':
        await LiveExamService.startExam(context.db, sessionId, auth.data.username, isAdmin, requestId);
        break;
      case 'pause_exam':
        await LiveExamService.pauseExam(context.db, sessionId, auth.data.username, isAdmin, requestId);
        break;
      case 'resume_exam':
        await LiveExamService.resumeExam(context.db, sessionId, auth.data.username, isAdmin, requestId);
        break;
      case 'prepare_end_early':
        result = await LiveExamService.prepareEndExamEarly(
          context.db,
          sessionId,
          auth.data.username,
          isAdmin,
          requestId,
        );
        break;
      case 'extend_participant': {
        const individualEndsAt = await LiveExamService.extendParticipantTime(
          context.db,
          sessionId,
          validation.data.participantId,
          validation.data.extraMinutes,
          auth.data.username,
          isAdmin,
          requestId,
        );
        result = { individualEndsAt };
        break;
      }
      case 'end_early':
        await LiveExamService.endExamEarly(
          context.db,
          sessionId,
          auth.data.username,
          validation.data.confirmationToken,
          validation.data.reason,
          isAdmin,
          requestId,
        );
        break;
      default:
        return errorResponse('Invalid action', 400);
    }

    const session = await LiveExamService.getLiveExamById(context.db, sessionId);
    return jsonResponse({
      success: true,
      message: `Action ${validation.data.action} completed`,
      session,
      ...result,
    });
  } catch (error: unknown) {
    return liveExamErrorResponse(error, context.request, 'Failed to execute action');
  }
};

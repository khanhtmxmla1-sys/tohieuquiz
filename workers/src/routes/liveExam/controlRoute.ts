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
    const actions = {
      open_session: LiveExamService.openSession,
      start_exam: LiveExamService.startExam,
      end_early: LiveExamService.endExamEarly,
    } as const;
    const actionHandler = actions[validation.data.action as keyof typeof actions];
    if (!actionHandler) return errorResponse('Invalid action', 400);
    await actionHandler(context.db, sessionId, auth.data.username, isAdmin);
    const session = await LiveExamService.getLiveExamById(context.db, sessionId);
    return jsonResponse({
      success: true,
      message: `Action ${validation.data.action} completed`,
      session,
    });
  } catch (error: unknown) {
    return liveExamErrorResponse(error, context.request, 'Failed to execute action');
  }
};

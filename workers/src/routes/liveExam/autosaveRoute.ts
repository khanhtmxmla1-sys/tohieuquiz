import { LiveExamAutosaveRequestSchema } from '../../../../schemas/liveExam.schema';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamService from '../../services/liveExamService';
import { authenticateStudent, isAuthResponse, requireStudentParticipant } from './auth';
import type { LiveExamRouteHandler } from './routeContext';
import { liveExamErrorResponse } from './responses';

const AUTOSAVE_PATH = /^\/api\/live-exam\/[^/]+\/autosave$/;

export const handleAutosaveRoute: LiveExamRouteHandler = async (context) => {
  if (!AUTOSAVE_PATH.test(context.path) || !['GET', 'PUT'].includes(context.method)) return null;
  const auth = await authenticateStudent(context);
  if (isAuthResponse(auth)) return auth.response;
  const sessionId = context.path.split('/')[3];
  if (!sessionId) return errorResponse('Invalid session ID');
  const participant = await requireStudentParticipant(context.db, sessionId, auth.data.studentId);
  if (!participant) return errorResponse('Forbidden: Join session first', 403);

  try {
    if (context.method === 'GET') {
      const snapshot = await LiveExamService.getAnswerSnapshot(context.db, sessionId, auth.data.studentId);
      await LiveExamService.recordConnectionEvent(context.db, sessionId, auth.data.studentId, 'reconnected');
      return jsonResponse({ success: true, snapshot });
    }

    const body = await parseBody(context.request);
    if (!body) return errorResponse('Invalid JSON body');
    const validation = LiveExamAutosaveRequestSchema.safeParse({ ...body, liveExamId: sessionId });
    if (!validation.success) {
      return errorResponse(`Validation error: ${validation.error.issues.map((issue) => issue.message).join(', ')}`, 400);
    }
    const snapshot = await LiveExamService.saveAnswerSnapshot(context.db, {
      ...validation.data,
      studentId: auth.data.studentId,
    });
    return jsonResponse({ success: true, snapshot });
  } catch (error: unknown) {
    return liveExamErrorResponse(error, context.request, 'Failed to synchronize answers');
  }
};

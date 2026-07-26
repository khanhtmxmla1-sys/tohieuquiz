import { isStudent } from '../../middleware/jwtAuth';
import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamService from '../../services/liveExamService';
import {
  authenticateUser,
  authorizeTeacherForSession,
  isAuthResponse,
  requireStudentParticipant,
  resolveAuthenticatedStudentId,
} from './auth';
import type { LiveExamRouteHandler } from './routeContext';

// GET /api/live-exam/:id/chat
export const handleChatReadRoute: LiveExamRouteHandler = async (context) => {
  if (!/^\/api\/live-exam\/[^/]+\/chat$/.test(context.path) || context.method !== 'GET') {
    return null;
  }
  const auth = await authenticateUser(context);
  if (isAuthResponse(auth)) return auth.response;
  const sessionId = context.path.split('/')[3];
  if (!sessionId) return errorResponse('Invalid session ID');
  const session = await LiveExamService.getLiveExamById(context.db, sessionId);
  if (!session) return errorResponse('Session not found', 404);

  if (isStudent(auth.data)) {
    const studentId = await resolveAuthenticatedStudentId(context.db, auth.data);
    if (!studentId) return errorResponse('Student not found', 404);
    const participant = await requireStudentParticipant(context.db, sessionId, studentId);
    if (!participant) return errorResponse('Forbidden: Join session first', 403);
    const result = await LiveExamService.getWaitingRoomChat(context.db, sessionId, false);
    return jsonResponse({
      success: true,
      messages: result.messages,
      settings: { enabled: result.enabled },
    });
  }

  const authError = await authorizeTeacherForSession(context, auth.data, sessionId);
  if (authError) return authError;
  const result = await LiveExamService.getWaitingRoomChat(context.db, sessionId, true);
  return jsonResponse({
    success: true,
    messages: result.messages,
    settings: { enabled: result.enabled },
  });
};

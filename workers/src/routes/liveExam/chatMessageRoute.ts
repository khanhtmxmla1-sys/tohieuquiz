import { WaitingRoomChatMessageSchema } from '../../../../schemas/liveExam.schema';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamService from '../../services/liveExamService';
import { authenticateStudent, isAuthResponse, requireStudentParticipant } from './auth';
import type { LiveExamRouteHandler } from './routeContext';

// POST /api/live-exam/:id/chat/message
export const handleChatMessageRoute: LiveExamRouteHandler = async (context) => {
  if (!/^\/api\/live-exam\/[^/]+\/chat\/message$/.test(context.path) || context.method !== 'POST') {
    return null;
  }
  const auth = await authenticateStudent(context);
  if (isAuthResponse(auth)) return auth.response;
  const sessionId = context.path.split('/')[3];
  if (!sessionId) return errorResponse('Invalid session ID');
  const session = await LiveExamService.getLiveExamById(context.db, sessionId);
  if (!session) return errorResponse('Session not found', 404);
  if (session.status !== 'waiting') {
    return errorResponse('Chat is only available in waiting room', 400);
  }
  if (!(session as any).chatEnabled && (session as any).chatEnabled !== undefined) {
    return errorResponse('Chat is disabled', 403);
  }
  const participant = await requireStudentParticipant(context.db, sessionId, auth.data.studentId);
  if (!participant) return errorResponse('Forbidden: Join session first', 403);
  const body = await parseBody(context.request);
  if (!body) return errorResponse('Invalid JSON body');
  const validation = WaitingRoomChatMessageSchema.safeParse(body);
  if (!validation.success) {
    return errorResponse(validation.error.issues.map((issue) => issue.message).join(', '), 400);
  }
  const message = await LiveExamService.createWaitingRoomChatMessage(context.db, {
    sessionId,
    senderRole: 'student',
    senderId: auth.data.studentId,
    senderName: auth.data.user.username,
    content: validation.data.content,
    kind: 'message',
  });
  return jsonResponse({ success: true, message });
};

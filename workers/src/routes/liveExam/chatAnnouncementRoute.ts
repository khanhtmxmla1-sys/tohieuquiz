import { WaitingRoomChatMessageSchema } from '../../../../schemas/liveExam.schema';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamService from '../../services/liveExamService';
import { authenticateTeacherForSession, isAuthResponse } from './auth';
import type { LiveExamRouteHandler } from './routeContext';

// POST /api/live-exam/:id/chat/announcement
export const handleChatAnnouncementRoute: LiveExamRouteHandler = async (context) => {
  if (!/^\/api\/live-exam\/[^/]+\/chat\/announcement$/.test(context.path)
    || context.method !== 'POST') return null;
  const sessionId = context.path.split('/')[3];
  if (!sessionId) return errorResponse('Invalid session ID');
  const auth = await authenticateTeacherForSession(context, sessionId);
  if (isAuthResponse(auth)) return auth.response;
  const session = await LiveExamService.getLiveExamById(context.db, sessionId);
  if (!session) return errorResponse('Session not found', 404);
  if (session.status !== 'waiting') {
    return errorResponse('Announcements are only available in waiting room', 400);
  }
  const body = await parseBody(context.request);
  if (!body) return errorResponse('Invalid JSON body');
  const validation = WaitingRoomChatMessageSchema.safeParse(body);
  if (!validation.success) {
    return errorResponse(validation.error.issues.map((issue) => issue.message).join(', '), 400);
  }
  const message = await LiveExamService.createWaitingRoomChatMessage(context.db, {
    sessionId,
    senderRole: 'teacher',
    senderId: auth.data.username,
    senderName: auth.data.fullName || auth.data.username,
    content: validation.data.content,
    kind: 'announcement',
  });
  return jsonResponse({ success: true, message });
};

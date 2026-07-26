import { WaitingRoomChatSettingsSchema } from '../../../../schemas/liveExam.schema';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamService from '../../services/liveExamService';
import { authenticateTeacherForSession, isAuthResponse } from './auth';
import type { LiveExamRouteHandler } from './routeContext';

// PUT /api/live-exam/:id/chat/settings
// PUT /api/live-exam/:id/chat/:messageId/hide
export const handleChatModerationRoutes: LiveExamRouteHandler = async (context) => {
  const settingsMatch = /^\/api\/live-exam\/[^/]+\/chat\/settings$/.test(context.path)
    && context.method === 'PUT';
  const hideMatch = /^\/api\/live-exam\/[^/]+\/chat\/[^/]+\/hide$/.test(context.path)
    && context.method === 'PUT';
  if (!settingsMatch && !hideMatch) return null;

  const parts = context.path.split('/');
  const sessionId = parts[3];
  if (!sessionId) return errorResponse('Invalid session ID');
  const auth = await authenticateTeacherForSession(context, sessionId);
  if (isAuthResponse(auth)) return auth.response;

  if (settingsMatch) {
    const body = await parseBody(context.request);
    if (!body) return errorResponse('Invalid JSON body');
    const validation = WaitingRoomChatSettingsSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(validation.error.issues.map((issue) => issue.message).join(', '), 400);
    }
    await LiveExamService.updateWaitingRoomChatEnabled(
      context.db,
      sessionId,
      validation.data.enabled,
    );
    return jsonResponse({ success: true, settings: { enabled: validation.data.enabled } });
  }

  const messageId = parts[5];
  if (!messageId) return errorResponse('Invalid path params');
  await LiveExamService.hideWaitingRoomChatMessage(context.db, sessionId, messageId);
  return jsonResponse({ success: true });
};

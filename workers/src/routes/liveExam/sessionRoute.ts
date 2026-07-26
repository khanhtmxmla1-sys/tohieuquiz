import { extractIdFromPath } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamService from '../../services/liveExamService';
import { authenticateTeacherForSession, isAuthResponse } from './auth';
import type { LiveExamRouteHandler } from './routeContext';
import { liveExamErrorResponse } from './responses';

const SESSION_PATH = /^\/api\/live-exam\/[^/]+$/;

// GET /api/live-exam/:id
// DELETE /api/live-exam/:id
export const handleSessionRoute: LiveExamRouteHandler = async (context) => {
  if (!SESSION_PATH.test(context.path) || !['GET', 'DELETE'].includes(context.method)) return null;
  const sessionId = extractIdFromPath(context.path, '/api/live-exam/');
  if (!sessionId) return errorResponse('Invalid session ID');
  const auth = await authenticateTeacherForSession(context, sessionId);
  if (isAuthResponse(auth)) return auth.response;

  if (context.method === 'GET') {
    try {
      const session = await LiveExamService.getLiveExamById(context.db, sessionId);
      return jsonResponse({ success: true, session });
    } catch (error: unknown) {
      return liveExamErrorResponse(error, context.request, 'Failed to get session');
    }
  }

  try {
    await LiveExamService.deleteLiveExam(
      context.db,
      sessionId,
      auth.data.username,
      auth.data.role === 'admin',
    );
    return jsonResponse({ success: true, message: 'Session archived successfully' });
  } catch (error: unknown) {
    return liveExamErrorResponse(error, context.request, 'Failed to archive session');
  }
};

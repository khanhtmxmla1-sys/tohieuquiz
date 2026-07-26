import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamAnalyticsService from '../../services/liveExamAnalyticsService';
import { authenticateTeacherForSession, isAuthResponse } from './auth';
import type { LiveExamRouteHandler } from './routeContext';
import { liveExamErrorResponse } from './responses';

// GET /api/live-exam/:id/analytics
export const handleAnalyticsRoute: LiveExamRouteHandler = async (context) => {
  if (!/^\/api\/live-exam\/[^/]+\/analytics$/.test(context.path) || context.method !== 'GET') {
    return null;
  }
  const sessionId = context.path.split('/')[3];
  if (!sessionId) return errorResponse('Invalid session ID');
  const auth = await authenticateTeacherForSession(context, sessionId);
  if (isAuthResponse(auth)) return auth.response;
  try {
    const analytics = await LiveExamAnalyticsService.calculateSessionAnalytics(
      context.db,
      sessionId,
    );
    return jsonResponse({ success: true, analytics });
  } catch (error: unknown) {
    return liveExamErrorResponse(error, context.request, 'Failed to calculate analytics');
  }
};

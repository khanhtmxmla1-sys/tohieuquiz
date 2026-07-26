import type { Env } from '../../types';
import { errorResponse } from '../../utils/response';
import { handleActivityRoute } from './activityRoute';
import { handleAnalyticsRoute } from './analyticsRoute';
import { handleChatAnnouncementRoute } from './chatAnnouncementRoute';
import { handleChatMessageRoute } from './chatMessageRoute';
import { handleChatModerationRoutes } from './chatModerationRoutes';
import { handleChatReadRoute } from './chatReadRoute';
import { handleControlRoute } from './controlRoute';
import { handleCreateRoute } from './createRoute';
import { handleJoinRoute } from './joinRoute';
import { handleParticipantsRoute } from './participantsRoute';
import { handleResultsRoute } from './resultsRoute';
import { createLiveExamRouteContext, type LiveExamRouteHandler } from './routeContext';
import { handleSessionRoute } from './sessionRoute';
import { handleStatusRoute } from './statusRoute';
import { handleSubmitRoute } from './submitRoute';
import { handleTeacherSessionsRoute } from './teacherSessionsRoute';
import { handleTimingRoute } from './timingRoute';

const ROUTE_HANDLERS: LiveExamRouteHandler[] = [
  handleCreateRoute,
  handleSessionRoute,
  handleControlRoute,
  handleParticipantsRoute,
  handleJoinRoute,
  handleStatusRoute,
  handleSubmitRoute,
  handleActivityRoute,
  handleResultsRoute,
  handleChatReadRoute,
  handleChatMessageRoute,
  handleChatAnnouncementRoute,
  handleChatModerationRoutes,
  handleTeacherSessionsRoute,
  handleAnalyticsRoute,
  handleTimingRoute,
];

export async function handleLiveExamRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
): Promise<Response> {
  const context = createLiveExamRouteContext(request, env, path, method);
  for (const handler of ROUTE_HANDLERS) {
    const response = await handler(context);
    if (response) return response;
  }
  return errorResponse('Live Exam endpoint not found', 404);
}

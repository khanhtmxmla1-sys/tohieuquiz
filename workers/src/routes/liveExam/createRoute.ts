import { CreateLiveExamRequestSchema } from '../../../../schemas/liveExam.schema';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamService from '../../services/liveExamService';
import { authenticateTeacher, isAuthResponse } from './auth';
import type { LiveExamRouteHandler } from './routeContext';
import { liveExamErrorResponse } from './responses';

// POST /api/live-exam/create
export const handleCreateRoute: LiveExamRouteHandler = async (context) => {
  if (context.path !== '/api/live-exam/create' || context.method !== 'POST') return null;
  const auth = await authenticateTeacher(context);
  if (isAuthResponse(auth)) return auth.response;

  const body = await parseBody(context.request);
  if (!body) return errorResponse('Invalid JSON body');
  const validation = CreateLiveExamRequestSchema.safeParse(body);
  if (!validation.success) {
    return errorResponse(
      `Validation error: ${validation.error.issues.map((issue) => issue.message).join(', ')}`,
      400,
    );
  }

  try {
    const session = await LiveExamService.createLiveExam(context.db, {
      ...validation.data,
      teacherId: auth.data.username,
      actorRole: auth.data.role === 'admin' ? 'admin' : 'teacher',
    });
    return jsonResponse({ success: true, session });
  } catch (error: unknown) {
    return liveExamErrorResponse(error, context.request, 'Failed to create session');
  }
};

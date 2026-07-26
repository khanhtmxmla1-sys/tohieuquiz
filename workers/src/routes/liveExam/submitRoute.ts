import { SubmitAnswersRequestSchema } from '../../../../schemas/liveExam.schema';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamService from '../../services/liveExamService';
import { authenticateStudent, isAuthResponse } from './auth';
import type { LiveExamRouteHandler } from './routeContext';
import { liveExamErrorResponse } from './responses';

// POST /api/live-exam/:id/submit
export const handleSubmitRoute: LiveExamRouteHandler = async (context) => {
  if (!/^\/api\/live-exam\/[^/]+\/submit$/.test(context.path) || context.method !== 'POST') {
    return null;
  }
  const auth = await authenticateStudent(context);
  if (isAuthResponse(auth)) return auth.response;
  const sessionId = context.path.split('/')[3];
  if (!sessionId) return errorResponse('Invalid session ID');
  const body = await parseBody(context.request);
  if (!body) return errorResponse('Invalid JSON body');
  const validation = SubmitAnswersRequestSchema.safeParse({
    ...body,
    liveExamId: sessionId,
    studentId: auth.data.studentId,
  });
  if (!validation.success) {
    return errorResponse(
      `Validation error: ${validation.error.issues.map((issue) => issue.message).join(', ')}`,
      400,
    );
  }

  try {
    const submission = await LiveExamService.submitAnswers(context.db, validation.data);
    return jsonResponse({
      success: true,
      message: 'Answers submitted successfully',
      participant: submission,
    });
  } catch (error: unknown) {
    return liveExamErrorResponse(error, context.request, 'Failed to submit answers');
  }
};

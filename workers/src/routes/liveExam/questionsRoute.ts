import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamService from '../../services/liveExamService';
import {
  isLiveExamQuestionContractError,
  loadLiveExamQuestionContract,
  mapLiveExamQuestionsToStudentDto,
} from '../../services/liveExamQuestionContract';
import { requireParticipantWorkWindow, } from '../../services/liveExam/deadlineService';
import { authenticateStudent, isAuthResponse, requireStudentParticipant } from './auth';
import type { LiveExamRouteHandler } from './routeContext';
import { liveExamErrorResponse } from './responses';

const QUESTIONS_PATH = /^\/api\/live-exam\/[^/]+\/questions$/;

const privateJsonResponse = (data: unknown, status = 200): Response => {
  const response = jsonResponse(data, status);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(response.body, { status: response.status, headers });
};

const privateResponse = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(response.body, { status: response.status, headers });
};

/** GET /api/live-exam/:sessionId/questions */
export const handleQuestionsRoute: LiveExamRouteHandler = async (context) => {
  if (!QUESTIONS_PATH.test(context.path) || context.method !== 'GET') return null;
  const auth = await authenticateStudent(context);
  if (isAuthResponse(auth)) return privateResponse(auth.response);
  const sessionId = context.path.split('/')[3];
  if (!sessionId) return privateResponse(errorResponse('Invalid session ID'));

  try {
    const session = await LiveExamService.getLiveExamById(context.db, sessionId);
    if (!session || session.archivedAt) return privateResponse(errorResponse('Session not found', 404));
    const participant = await requireStudentParticipant(context.db, sessionId, auth.data.studentId);
    if (!participant) return privateResponse(errorResponse('Forbidden: Join session first', 403));
    await requireParticipantWorkWindow(context.db, session, auth.data.studentId);

    const contract = await loadLiveExamQuestionContract(
      context.db,
      session,
      auth.data.studentId,
      context.env.JWT_SECRET,
    );
    const questions = await mapLiveExamQuestionsToStudentDto(contract);
    return privateJsonResponse({
      sessionId: session.id,
      quizId: session.quizId,
      revision: contract.context.revision,
      questions,
    });
  } catch (error: unknown) {
    if (isLiveExamQuestionContractError(error)) {
      return privateResponse(errorResponse('Invalid live exam answer contract', 400));
    }
    return privateResponse(liveExamErrorResponse(error, context.request, 'Failed to load live exam questions'));
  }
};

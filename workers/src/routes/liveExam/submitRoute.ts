import { SubmitAnswersRequestSchema } from '../../../../schemas/liveExam.schema';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamService from '../../services/liveExamService';
import {
  decodeLiveExamAnswers,
  hasOpaqueStudentAnswerIds,
  isLiveExamQuestionContractError,
  loadLiveExamQuestionContract,
} from '../../services/liveExamQuestionContract';
import { requireParticipantWorkWindow } from '../../services/liveExam/deadlineService';
import { authenticateStudent, isAuthResponse, requireStudentParticipant } from './auth';
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
    const session = await LiveExamService.getLiveExamById(context.db, sessionId);
    if (!session || session.archivedAt) return errorResponse('Session not found', 404);
    let submission;
    if (hasOpaqueStudentAnswerIds(validation.data.answers)) {
      const participant = await requireStudentParticipant(context.db, sessionId, auth.data.studentId);
      if (!participant) return errorResponse('Forbidden: Join session first', 403);
      // Preserve committed-submission replay semantics while still requiring
      // the active work window for a first opaque-ID submission.
      if (!participant.submitted_at) {
        await requireParticipantWorkWindow(context.db, session, auth.data.studentId);
      }
      const contract = await loadLiveExamQuestionContract(
        context.db,
        session,
        auth.data.studentId,
        context.env.JWT_SECRET,
      );
      const canonicalAnswers = await decodeLiveExamAnswers(contract, validation.data.answers);
      submission = await LiveExamService.submitAnswers(context.db, {
        ...validation.data,
        answers: canonicalAnswers,
      });
    } else {
      // Legacy CLASS/SCHOOL_EXAM_ROOM submissions retain the pre-C1.3 path:
      // no participant/DTO contract query and unchanged service semantics.
      submission = await LiveExamService.submitAnswers(context.db, validation.data);
    }
    if (session?.participantScopeType === 'SCHOOL_EXAM_ROOM' && session.resultVisibility === 'WITHHELD') {
      return jsonResponse({
        success: true,
        message: 'Answers submitted successfully',
      });
    }
    return jsonResponse({
      success: true,
      message: 'Answers submitted successfully',
      participant: submission,
    });
  } catch (error: unknown) {
    if (isLiveExamQuestionContractError(error)) {
      return errorResponse('Invalid live exam answer contract', 400);
    }
    return liveExamErrorResponse(error, context.request, 'Failed to submit answers');
  }
};

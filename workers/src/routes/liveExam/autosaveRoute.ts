import { LiveExamAutosaveRequestSchema } from '../../../../schemas/liveExam.schema';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamService from '../../services/liveExamService';
import {
  decodeLiveExamAnswers,
  encodeLiveExamAnswers,
  hasOpaqueStudentAnswerIds,
  isLiveExamQuestionContractError,
  LIVE_EXAM_DTO_SNAPSHOT_MARKER,
  loadLiveExamQuestionContract,
  readLiveExamDtoSnapshot,
  wrapLiveExamDtoSnapshot,
} from '../../services/liveExamQuestionContract';
import { requireParticipantWorkWindow } from '../../services/liveExam/deadlineService';
import { authenticateStudent, isAuthResponse, requireStudentParticipant } from './auth';
import type { LiveExamRouteHandler } from './routeContext';
import { liveExamErrorResponse } from './responses';

const AUTOSAVE_PATH = /^\/api\/live-exam\/[^/]+\/autosave$/;

export const handleAutosaveRoute: LiveExamRouteHandler = async (context) => {
  if (!AUTOSAVE_PATH.test(context.path) || !['GET', 'PUT'].includes(context.method)) return null;
  const auth = await authenticateStudent(context);
  if (isAuthResponse(auth)) return auth.response;
  const sessionId = context.path.split('/')[3];
  if (!sessionId) return errorResponse('Invalid session ID');
  const participant = await requireStudentParticipant(context.db, sessionId, auth.data.studentId);
  if (!participant) return errorResponse('Forbidden: Join session first', 403);

  try {
    if (context.method === 'GET') {
      let snapshot = await LiveExamService.getAnswerSnapshot(context.db, sessionId, auth.data.studentId);
      const markedSnapshot = readLiveExamDtoSnapshot(snapshot?.answers);
      if (snapshot && markedSnapshot) {
        const session = await LiveExamService.getLiveExamById(context.db, sessionId);
        if (!session || session.archivedAt) return errorResponse('Session not found', 404);
        const contract = await loadLiveExamQuestionContract(
          context.db,
          session,
          auth.data.studentId,
          context.env.JWT_SECRET,
        );
        if (markedSnapshot[LIVE_EXAM_DTO_SNAPSHOT_MARKER]?.quizId !== contract.context.quizId
          || markedSnapshot[LIVE_EXAM_DTO_SNAPSHOT_MARKER]?.revision !== contract.context.revision) {
          return errorResponse('Quiz revision changed; please reload', 409);
        }
        snapshot = {
          ...snapshot,
          answers: await encodeLiveExamAnswers(contract, markedSnapshot.answers),
        };
      }
      await LiveExamService.recordConnectionEvent(context.db, sessionId, auth.data.studentId, 'reconnected');
      return jsonResponse({ success: true, snapshot });
    }

    const body = await parseBody(context.request);
    if (!body) return errorResponse('Invalid JSON body');
    const validation = LiveExamAutosaveRequestSchema.safeParse({ ...body, liveExamId: sessionId });
    if (!validation.success) {
      return errorResponse(`Validation error: ${validation.error.issues.map((issue) => issue.message).join(', ')}`, 400);
    }
    if (!hasOpaqueStudentAnswerIds(validation.data.answers)) {
      const snapshot = await LiveExamService.saveAnswerSnapshot(context.db, {
        ...validation.data,
        studentId: auth.data.studentId,
        answers: validation.data.answers,
      });
      return jsonResponse({ success: true, snapshot });
    }

    const session = await LiveExamService.getLiveExamById(context.db, sessionId);
    if (!session || session.archivedAt) return errorResponse('Session not found', 404);
    await requireParticipantWorkWindow(context.db, session, auth.data.studentId);
    const contract = await loadLiveExamQuestionContract(
      context.db,
      session,
      auth.data.studentId,
      context.env.JWT_SECRET,
    );
    const canonicalAnswers = await decodeLiveExamAnswers(contract, validation.data.answers);
    const snapshot = await LiveExamService.saveAnswerSnapshot(context.db, {
      ...validation.data,
      studentId: auth.data.studentId,
      answers: wrapLiveExamDtoSnapshot(canonicalAnswers, contract) as any,
    });
    return jsonResponse({
      success: true,
      snapshot: {
        ...snapshot,
        answers: await encodeLiveExamAnswers(contract, canonicalAnswers),
      },
    });
  } catch (error: unknown) {
    if (isLiveExamQuestionContractError(error)) {
      return errorResponse('Invalid live exam answer contract', 400);
    }
    return liveExamErrorResponse(error, context.request, 'Failed to synchronize answers');
  }
};

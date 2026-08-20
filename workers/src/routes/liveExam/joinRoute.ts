import { JoinLiveExamRequestSchema } from '../../../../schemas/liveExam.schema';
import { parseBody } from '../../utils/helpers';
import { errorResponse, jsonResponse } from '../../utils/response';
import * as LiveExamService from '../../services/liveExamService';
import { authenticateStudent, isAuthResponse } from './auth';
import type { LiveExamRouteHandler } from './routeContext';
import { liveExamErrorResponse } from './responses';

// POST /api/live-exam/join
export const handleJoinRoute: LiveExamRouteHandler = async (context) => {
  if (context.path !== '/api/live-exam/join' || context.method !== 'POST') return null;
  const auth = await authenticateStudent(context);
  if (isAuthResponse(auth)) return auth.response;

  const body = await parseBody(context.request);
  if (!body) return errorResponse('Invalid JSON body');
  const validation = JoinLiveExamRequestSchema.safeParse({
    ...body,
    studentId: auth.data.studentId,
    username: auth.data.user.username,
  });
  if (!validation.success) {
    return errorResponse(
      `Validation error: ${validation.error.issues.map((issue) => issue.message).join(', ')}`,
      400,
    );
  }

  try {
    const participant = await LiveExamService.joinSession(context.db, validation.data);
    const session = await LiveExamService.getLiveExamById(context.db, participant.liveExamId);
    const participantPayload = session?.participantScopeType === 'SCHOOL_EXAM_ROOM'
      && session.resultVisibility === 'WITHHELD'
      ? {
          id: participant.id,
          liveExamId: participant.liveExamId,
          studentId: participant.studentId,
          username: participant.username,
          joinedAt: participant.joinedAt,
          startedAt: participant.startedAt,
          submittedAt: participant.submittedAt,
          individualEndsAt: participant.individualEndsAt,
          tabSwitches: participant.tabSwitches,
          warnings: participant.warnings,
          createdAt: participant.createdAt,
          updatedAt: participant.updatedAt,
        }
      : participant;
    return jsonResponse({
      success: true,
      participant: participantPayload,
      session: {
        id: session!.id,
        title: session!.title,
        quizId: session!.quizId,
        duration: session!.duration,
        status: session!.status,
        startedAt: session!.startedAt,
        endsAt: session!.endsAt,
      },
    });
  } catch (error: unknown) {
    return liveExamErrorResponse(error, context.request, 'Failed to join session', 400);
  }
};

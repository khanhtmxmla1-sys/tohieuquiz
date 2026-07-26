export { LiveExamServiceError } from './errors';
export { generateAccessCode } from './utils';
export { createLiveExam } from './createSessionService';
export { getLiveExamByAccessCode, getLiveExamById } from './sessionRepository';
export {
  createWaitingRoomChatMessage,
  getWaitingRoomChat,
  hideWaitingRoomChatMessage,
  updateWaitingRoomChatEnabled,
} from './chatService';
export { joinSession, getParticipants } from './participantService';
export { updateActivity, markInactiveParticipants } from './activityService';
export { calculateScoresAndClose, checkAndAutoCloseExpiredExams } from './scoringService';
export { submitAnswers } from './submissionService';
export { deleteLiveExam } from './sessionArchiveService';
export { endExamEarly, openSession, startExam } from './sessionControlService';

export type {
  CreateLiveExamParams,
  JoinSessionParams,
  SubmissionScoreSummary,
  SubmitAnswersParams,
  UpdateActivityParams,
  WaitingRoomChatMessageParams,
} from './types';

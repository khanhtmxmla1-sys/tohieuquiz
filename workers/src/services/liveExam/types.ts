import type { LiveExamSettings, StudentAnswers } from '../../../../src/types/liveExam.types';

export interface CreateLiveExamParams {
  title: string;
  quizId: string;
  teacherId: string;
  classId: string;
  actorRole: 'teacher' | 'admin';
  duration: number;
  scheduledAt?: string;
  settings: LiveExamSettings;
}

export interface JoinSessionParams {
  accessCode: string;
  studentId: string;
  username: string;
}

export interface SubmitAnswersParams {
  liveExamId: string;
  studentId: string;
  answers: StudentAnswers;
}

export interface SubmissionScoreSummary {
  score: number;
  correctCount: number;
  wrongCount: number;
  submittedAt: string;
}

export interface UpdateActivityParams {
  liveExamId: string;
  studentId: string;
  currentQuestion?: number;
  answeredCount: number;
}

export interface WaitingRoomChatMessageParams {
  sessionId: string;
  senderRole: 'student' | 'teacher' | 'system';
  senderId: string;
  senderName: string;
  content: string;
  kind?: 'message' | 'announcement';
}

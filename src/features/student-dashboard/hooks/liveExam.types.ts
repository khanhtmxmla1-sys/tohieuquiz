export interface JoinedLiveExam {
  sessionId: string;
  sessionTitle: string;
  quizId: string;
  duration: number;
  startedAt?: string;
  endsAt?: string;
}

export type LiveExamStage = 'waiting' | 'active' | 'submitted' | 'results';

export interface JoinedSessionPayload {
  id: string;
  title: string;
  quizId: string;
  duration: number;
  status: string;
  startedAt?: string;
  endsAt?: string;
}

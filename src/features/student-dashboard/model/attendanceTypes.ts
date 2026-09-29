import type { QuestionRichTextEnvelopeV1 } from '../../../../shared/question-rich-text.contract';

export interface AttendanceAttemptItem {
  id: string;
  questionId: string;
  position: number;
  question: string;
  questionRichText?: QuestionRichTextEnvelopeV1;
  options: string[];
  image?: string;
  imageAlt?: string;
  selectedAnswer?: string | null;
  isAnswered: boolean;
  isCorrect?: boolean;
}

export interface AttendanceAttemptData {
  attemptId: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  completed: boolean;
  correctCount: number;
  totalQuestions: number;
  answeredCount: number;
  items: AttendanceAttemptItem[];
  awardedCoins?: number;
  awardedExp?: number;
  newCoins?: number;
  newLevel?: number;
  newExp?: number;
  newExpToNext?: number;
}

export interface AttendanceAttemptSummary {
  attemptId: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  answeredCount: number;
  correctCount: number;
  totalQuestions: number;
}

export interface AttendanceStatusData {
  enabled: boolean;
  available: boolean;
  questionCount: number;
  claimedToday: boolean;
  claimDates: string[];
  streakDays: number;
  attendanceDayNumber: number;
  nextRewardExp: number;
  nextRewardCoins: number;
  todayDateKey: string;
  weekStartDateKey: string;
  attempt?: AttendanceAttemptSummary | null;
}

export type AttendanceRewardPreview = Pick<
  AttendanceStatusData,
  'attendanceDayNumber' | 'nextRewardExp' | 'nextRewardCoins'
>;

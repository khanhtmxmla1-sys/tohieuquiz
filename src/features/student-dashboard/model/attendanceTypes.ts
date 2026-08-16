export interface AttendanceQuestion {
  id: string;
  quizId: string;
  questionId: string;
  quizTitle: string;
  question: string;
  options: string[];
  correctLabel: string;
}

export interface AttendanceStatusData {
  claimedToday: boolean;
  claimDates: string[];
  streakDays: number;
  attendanceDayNumber: number;
  nextRewardExp: number;
  nextRewardCoins: number;
  todayDateKey: string;
  weekStartDateKey: string;
}

export type AttendanceRewardPreview = Pick<
  AttendanceStatusData,
  'attendanceDayNumber' | 'nextRewardExp' | 'nextRewardCoins'
>;

export interface AttendanceClaimData {
  claimed: boolean;
  alreadyClaimed: boolean;
  claimDates: string[];
  streakDays: number;
  attendanceDayNumber: number;
  multiplier: number;
  awardedExp: number;
  awardedCoins: number;
  message?: string;
}

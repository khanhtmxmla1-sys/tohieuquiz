export interface AttendanceQuestion {
  id: string;
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

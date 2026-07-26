import { ATTENDANCE_REWARD } from './dashboardConstants';
import type { AttendanceClaimData, AttendanceQuestion } from './attendanceTypes';
import { cleanOptionText } from './attendanceQuestions';

export const getLocalDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getAttendanceMultiplier = (day: number) => {
  if (day === 3) return 2;
  if (day === 5) return 3;
  if (day === 7) return 5;
  return 1;
};

export const getAttendanceBadgeText = (
  claimed: boolean, claimCount: number, hasQuestions: boolean,
) => {
  if (claimed) return 'Đã điểm danh hôm nay';
  if (!hasQuestions) return 'Đang tải câu hỏi điểm danh...';
  const day = claimCount + 1;
  const multiplier = getAttendanceMultiplier(day);
  return `Điểm danh ngày ${day}: +${ATTENDANCE_REWARD.coins * multiplier} Xu +${ATTENDANCE_REWARD.exp * multiplier} EXP`;
};

export const getWrongAnswerMessage = (question: AttendanceQuestion) => {
  const index = question.correctLabel.charCodeAt(0) - 65;
  const text = question.options[index] ? ` (${cleanOptionText(question.options[index])})` : '';
  return `Chưa chính xác. Đáp án đúng là ${question.correctLabel}${text}.`;
};

export const getAttendanceSuccessMessage = (data: AttendanceClaimData) => {
  const bonus = data.multiplier > 1 ? ` (x${data.multiplier} ngày ${data.attendanceDayNumber})` : '';
  return `Chính xác! Em nhận +${data.awardedCoins} Xu và +${data.awardedExp} EXP${bonus}. Bạn đã điểm danh liên tục ${data.streakDays} ngày.`;
};

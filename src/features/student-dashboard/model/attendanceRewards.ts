import { getSystemDateKey } from '../../../utils/dateTime';
import type {
  AttendanceClaimData, AttendanceQuestion, AttendanceRewardPreview,
} from './attendanceTypes';
import { cleanOptionText } from './attendanceQuestions';

export const getLocalDateKey = () => getSystemDateKey();

export const getAttendanceMultiplier = (day: number) => {
  if (day === 3) return 2;
  if (day === 5) return 3;
  if (day === 7) return 5;
  return 1;
};

export const getAttendanceBadgeText = (
  claimed: boolean,
  hasQuestions: boolean,
  preview: AttendanceRewardPreview | null,
) => {
  if (claimed) return 'Đã điểm danh hôm nay';
  if (!hasQuestions) return 'Đang tải câu hỏi điểm danh...';
  if (!preview) return 'Đang xác minh phần thưởng điểm danh...';
  return `Điểm danh ngày ${preview.attendanceDayNumber}: +${preview.nextRewardCoins} Xu +${preview.nextRewardExp} EXP`;
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

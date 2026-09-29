import { getSystemDateKey } from '../../../utils/dateTime';
import type { AttendanceRewardPreview } from './attendanceTypes';

export const getLocalDateKey = () => getSystemDateKey();

export const getAttendanceBadgeText = (
  claimed: boolean,
  available: boolean,
  preview: AttendanceRewardPreview | null,
) => {
  if (claimed) return 'Đã điểm danh hôm nay';
  if (!available) return 'Điểm danh đang tắt';
  if (!preview) return 'Đang tải điểm danh...';
  return `Điểm danh hôm nay · 2 câu · +${preview.nextRewardCoins} Xu +${preview.nextRewardExp} EXP`;
};

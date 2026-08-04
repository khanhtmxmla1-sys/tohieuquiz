export const SYSTEM_CRON = {
  WEEKLY_LEADERBOARD: '0 0 * * 1',
  LIVE_EXAM_SWEEP: '* * * * *',
  DAILY_SECURITY_AND_REMINDERS: '0 23 * * *',
  PARENT_DIGEST: '0 * * * *',
} as const;

export const SYSTEM_CRON_CONTRACT = [
  {
    name: 'weekly-leaderboard',
    expression: SYSTEM_CRON.WEEKLY_LEADERBOARD,
    utcSchedule: 'Monday 00:00 UTC',
    hanoiSchedule: 'Thứ Hai 07:00 giờ Hà Nội',
    purpose: 'Đóng kỳ thi hết hạn và trao thưởng bảng xếp hạng của tuần Hà Nội trước đó.',
  },
  {
    name: 'live-exam-sweep',
    expression: SYSTEM_CRON.LIVE_EXAM_SWEEP,
    utcSchedule: 'Every minute UTC',
    hanoiSchedule: 'Mỗi phút theo giờ Hà Nội',
    purpose: 'Tự động đóng các kỳ thi đã hết hạn.',
  },
  {
    name: 'daily-security-and-reminders',
    expression: SYSTEM_CRON.DAILY_SECURITY_AND_REMINDERS,
    utcSchedule: 'Daily 23:00 UTC',
    hanoiSchedule: 'Hằng ngày 06:00 giờ Hà Nội',
    purpose: 'Dọn dữ liệu bảo mật hết hạn và tạo nhắc hạn bài tập phụ huynh.',
  },
  {
    name: 'parent-digest',
    expression: SYSTEM_CRON.PARENT_DIGEST,
    utcSchedule: 'Hourly at minute 00 UTC',
    hanoiSchedule: 'Mỗi giờ đúng phút 00 giờ Hà Nội',
    purpose: 'Đánh giá và gửi digest phụ huynh theo tùy chọn giờ Hà Nội.',
  },
] as const;

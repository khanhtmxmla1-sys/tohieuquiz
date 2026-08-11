import type { AnnouncementChannel } from '../../../../shared/notifications.contract';
import type { AnnouncementAudience, AnnouncementStatus } from './AnnouncementComposer';

export type AnnouncementAdminTone = 'slate' | 'blue' | 'emerald' | 'amber' | 'red' | 'violet';

export const ANNOUNCEMENT_STATUS_META: Record<AnnouncementStatus, { label: string; tone: AnnouncementAdminTone }> = {
  DRAFT: { label: 'Bản nháp', tone: 'slate' },
  SCHEDULED: { label: 'Đã lên lịch', tone: 'blue' },
  PUBLISHED: { label: 'Đang hiển thị', tone: 'emerald' },
  EXPIRED: { label: 'Đã kết thúc', tone: 'slate' },
  ARCHIVED: { label: 'Đã lưu trữ', tone: 'slate' },
};

export const ANNOUNCEMENT_AUDIENCE_META: Record<AnnouncementAudience, { label: string; description: string }> = {
  ALL: { label: 'Toàn hệ thống', description: 'Giáo viên và học sinh' },
  TEACHERS: { label: 'Giáo viên', description: 'Chỉ tài khoản giáo viên' },
  STUDENTS: { label: 'Học sinh', description: 'Chỉ tài khoản học sinh' },
};

export const ANNOUNCEMENT_CHANNEL_META: Record<AnnouncementChannel, { label: string }> = {
  CRITICAL_STRIP: { label: 'Cảnh báo khẩn' },
  TICKER: { label: 'Tin chạy' },
  BANNER: { label: 'Thẻ thông báo' },
  INBOX: { label: 'Hộp thư (legacy)' },
};

export type AnnouncementAdminPreset = 'TICKER' | 'BANNER' | 'URGENT' | 'MULTI';

export const ANNOUNCEMENT_PRESET_META: Record<AnnouncementAdminPreset, { label: string; description: string }> = {
  TICKER: { label: 'Tin chạy', description: 'Thông tin ngắn gọn chạy trên giao diện' },
  BANNER: { label: 'Thông báo nổi bật', description: 'Thẻ nội dung có tiêu đề và lời kêu gọi hành động' },
  URGENT: { label: 'Cảnh báo khẩn', description: 'Thông tin cần được chú ý ngay' },
  MULTI: { label: 'Nhiều vị trí', description: 'Hiển thị trên nhiều bề mặt cùng lúc' },
};

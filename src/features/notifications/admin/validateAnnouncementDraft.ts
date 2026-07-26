import { isSafeNotificationActionUrl } from '../../../../shared/notifications.contract';
import type { AnnouncementDraft } from './AnnouncementComposer';

export type AnnouncementDraftErrors = Partial<Record<
  'channels' | 'bannerLink' | 'startsAt' | 'endsAt',
  string
>>;

export function validateAnnouncementDraft(
  draft: AnnouncementDraft,
  mode: 'draft' | 'publish',
): AnnouncementDraftErrors {
  if (mode === 'draft') return {};
  const errors: AnnouncementDraftErrors = {};

  if (draft.channels.length === 0) {
    errors.channels = 'Chọn ít nhất một kênh hiển thị.';
  } else if (draft.priority === 'URGENT' && !draft.channels.includes('CRITICAL_STRIP')) {
    errors.channels = 'Thông báo khẩn phải có kênh Cảnh báo khẩn.';
  }

  if (draft.ctaLabel && !draft.bannerLink) {
    errors.bannerLink = 'CTA cần có liên kết đích.';
  } else if (draft.bannerLink && !isSafeNotificationActionUrl(draft.bannerLink)) {
    errors.bannerLink = 'Liên kết phải là đường dẫn nội bộ hoặc HTTPS.';
  }

  if (draft.status === 'SCHEDULED' && !draft.startsAt) {
    errors.startsAt = 'Thông báo lên lịch cần thời gian bắt đầu.';
  }
  if (draft.startsAt && draft.endsAt
    && Date.parse(draft.endsAt) <= Date.parse(draft.startsAt)) {
    errors.endsAt = 'Thời gian kết thúc phải sau thời gian bắt đầu.';
  }
  return errors;
}

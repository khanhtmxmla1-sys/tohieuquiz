import type { AnnouncementDraft } from './AnnouncementComposer';

export type AnnouncementPresetId = 'TICKER' | 'BANNER' | 'URGENT';

export const ANNOUNCEMENT_PRESETS: Record<AnnouncementPresetId, {
  label: string;
  description: string;
  channels: AnnouncementDraft['channels'];
  priority: AnnouncementDraft['priority'];
  dismissible: boolean;
}> = {
  TICKER: {
    label: 'Tin chạy',
    description: 'Một dòng thông tin ngắn gọn, phù hợp nhắc lịch và thông báo chung.',
    channels: ['TICKER'],
    priority: 'INFO',
    dismissible: true,
  },
  BANNER: {
    label: 'Thông báo nổi bật',
    description: 'Thẻ thông báo có tiêu đề, mô tả và có thể thêm nút hành động.',
    channels: ['BANNER'],
    priority: 'INFO',
    dismissible: true,
  },
  URGENT: {
    label: 'Cảnh báo khẩn',
    description: 'Dành cho thông tin cần được chú ý ngay trên giao diện.',
    channels: ['CRITICAL_STRIP'],
    priority: 'URGENT',
    dismissible: false,
  },
};

export function inferAnnouncementPreset(draft: Pick<AnnouncementDraft, 'channels' | 'priority'>): AnnouncementPresetId | null {
  if (draft.priority === 'URGENT' && draft.channels.length === 1 && draft.channels[0] === 'CRITICAL_STRIP') return 'URGENT';
  if (draft.channels.length === 1 && draft.channels[0] === 'BANNER') return 'BANNER';
  if (draft.channels.length === 1 && draft.channels[0] === 'TICKER') return 'TICKER';
  return null;
}

export function applyAnnouncementPreset(draft: AnnouncementDraft, presetId: AnnouncementPresetId): AnnouncementDraft {
  const preset = ANNOUNCEMENT_PRESETS[presetId];
  return {
    ...draft,
    channels: [...preset.channels],
    priority: preset.priority,
    dismissible: preset.dismissible,
  };
}

export function presetChangesDelivery(draft: AnnouncementDraft, presetId: AnnouncementPresetId): boolean {
  const next = applyAnnouncementPreset(draft, presetId);
  return next.priority !== draft.priority
    || next.dismissible !== draft.dismissible
    || next.channels.join('|') !== draft.channels.join('|');
}

export function hasAnnouncementContent(draft: AnnouncementDraft): boolean {
  return Boolean(
    draft.content.trim()
      || draft.bannerTitle.trim()
      || draft.bannerSubtitle.trim()
      || draft.ctaLabel.trim()
      || draft.bannerLink.trim()
      || draft.bannerImage.trim(),
  );
}

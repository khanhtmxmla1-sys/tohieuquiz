import type { AnnouncementChannel, NotificationPriority } from '../../../../shared/notifications.contract';
import { formatSystemDateTime } from '../../../utils/dateTime';
import type { AnnouncementAudience, AnnouncementStatus } from './AnnouncementComposer';
import type { AnnouncementAdminPreset } from './announcementAdminMeta';

export interface AnnouncementAdminListItem {
  id: string;
  content: string;
  bannerTitle: string;
  bannerSubtitle: string;
  status: AnnouncementStatus;
  effectiveStatus?: AnnouncementStatus;
  audience: AnnouncementAudience;
  priority: NotificationPriority;
  channels: AnnouncementChannel[];
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string;
}

export type AnnouncementAdminStatusFilter = 'ALL' | AnnouncementStatus;
export type AnnouncementAdminAudienceFilter = 'ALL' | Exclude<AnnouncementAudience, 'ALL'>;
export type AnnouncementAdminPresetFilter = 'ALL' | AnnouncementAdminPreset;

export interface AnnouncementAdminFilter {
  status: AnnouncementAdminStatusFilter;
  audience: AnnouncementAdminAudienceFilter;
  preset: AnnouncementAdminPresetFilter;
  query: string;
}

export const getAnnouncementEffectiveStatus = (
  item: Pick<AnnouncementAdminListItem, 'status' | 'effectiveStatus'>,
): AnnouncementStatus => item.effectiveStatus || item.status;

export const getAnnouncementAdminPreset = (
  item: Pick<AnnouncementAdminListItem, 'priority' | 'channels'>,
): AnnouncementAdminPreset => {
  if (item.priority === 'URGENT' || item.channels.includes('CRITICAL_STRIP')) return 'URGENT';
  if (item.channels.length === 1 && item.channels[0] === 'BANNER') return 'BANNER';
  if (item.channels.length === 1 && item.channels[0] === 'TICKER') return 'TICKER';
  return 'MULTI';
};

const normalizeSearchText = (value: string): string => value
  .normalize('NFC')
  .toLocaleLowerCase('vi-VN')
  .trim();

export const filterAnnouncementAdminItems = <T extends AnnouncementAdminListItem>(
  items: T[],
  filter: AnnouncementAdminFilter,
): T[] => {
  const query = normalizeSearchText(filter.query);
  return items.filter((item) => {
    if (filter.status !== 'ALL' && getAnnouncementEffectiveStatus(item) !== filter.status) return false;
    if (filter.audience !== 'ALL' && item.audience !== filter.audience) return false;
    if (filter.preset !== 'ALL' && getAnnouncementAdminPreset(item) !== filter.preset) return false;
    if (!query) return true;
    const haystack = normalizeSearchText([
      item.bannerTitle,
      item.bannerSubtitle,
      item.content,
    ].join(' '));
    return haystack.includes(query);
  });
};

export const formatAnnouncementAdminSchedule = (
  item: Pick<AnnouncementAdminListItem, 'startsAt' | 'endsAt'>,
): string => {
  if (!item.startsAt && !item.endsAt) return 'Không giới hạn thời gian';
  if (item.startsAt && item.endsAt) {
    return `${formatSystemDateTime(item.startsAt)} → ${formatSystemDateTime(item.endsAt)} (giờ Hà Nội)`;
  }
  if (item.startsAt) return `Từ ${formatSystemDateTime(item.startsAt)} (giờ Hà Nội)`;
  return `Đến ${formatSystemDateTime(item.endsAt as string)} (giờ Hà Nội)`;
};

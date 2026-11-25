import type {
  AnnouncementChannel,
  NotificationPriority,
} from '../../../../shared/notifications.contract';

export type AnnouncementStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'EXPIRED' | 'ARCHIVED';
export type AnnouncementAudience = 'ALL' | 'TEACHERS' | 'STUDENTS';

export interface AnnouncementDraft {
  id: string;
  content: string;
  bannerTitle: string;
  bannerSubtitle: string;
  bannerLink: string;
  bannerImage: string;
  ctaLabel: string;
  status: AnnouncementStatus;
  audience: AnnouncementAudience;
  priority: NotificationPriority;
  channels: AnnouncementChannel[];
  dismissible: boolean;
  startsAt: string;
  endsAt: string;
  updatedAt: string;
  surfaceOverrides: Record<string, unknown>;
}

export const createEmptyAnnouncementDraft = (): AnnouncementDraft => ({
  id: '',
  content: '',
  bannerTitle: '',
  bannerSubtitle: '',
  bannerLink: '',
  bannerImage: '',
  ctaLabel: '',
  status: 'DRAFT',
  audience: 'ALL',
  priority: 'INFO',
  channels: [],
  dismissible: true,
  startsAt: '',
  endsAt: '',
  updatedAt: '',
  surfaceOverrides: {},
});

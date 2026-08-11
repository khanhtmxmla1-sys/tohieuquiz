import { systemDateTimeLocalToIso, toSystemDateTimeLocal } from '../../../utils/dateTime';
import type { AnnouncementChannel, NotificationPriority } from '../../../../shared/notifications.contract';
import type { AnnouncementAudience, AnnouncementDraft, AnnouncementStatus } from './AnnouncementComposer';

export interface AnnouncementDraftSource {
  id: string;
  content?: string | null;
  bannerTitle?: string | null;
  bannerSubtitle?: string | null;
  bannerLink?: string | null;
  bannerImage?: string | null;
  isActive?: boolean;
  isBannerActive?: boolean;
  status: AnnouncementStatus;
  effectiveStatus?: AnnouncementStatus;
  audience?: AnnouncementAudience;
  startsAt?: string | null;
  endsAt?: string | null;
  updatedAt?: string | null;
  priority?: NotificationPriority;
  channels?: AnnouncementChannel[];
  dismissible?: boolean;
  ctaLabel?: string | null;
  surfaceOverrides?: Record<string, unknown>;
}

const toLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return '';
  try {
    return toSystemDateTimeLocal(iso);
  } catch {
    return '';
  }
};

const normalizeDateTime = (value: string): string => {
  if (!value) return '';
  try {
    return systemDateTimeLocalToIso(value);
  } catch {
    return value.trim();
  }
};

const stableObject = (value: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(
  Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
);

export function announcementToDraft(item: AnnouncementDraftSource): AnnouncementDraft {
  return {
    id: item.id,
    content: item.content || '',
    bannerTitle: item.bannerTitle || '',
    bannerSubtitle: item.bannerSubtitle || '',
    bannerLink: item.bannerLink || '',
    bannerImage: item.bannerImage || '',
    ctaLabel: item.ctaLabel || '',
    status: item.status,
    audience: item.audience || 'ALL',
    priority: item.priority || 'INFO',
    channels: item.channels || [
      ...(item.isActive ? ['TICKER' as const] : []),
      ...(item.isBannerActive ? ['BANNER' as const] : []),
    ],
    dismissible: item.dismissible !== false,
    startsAt: toLocalInput(item.startsAt),
    endsAt: toLocalInput(item.endsAt),
    updatedAt: item.updatedAt || '',
    surfaceOverrides: item.surfaceOverrides || {},
  };
}

export function cloneAnnouncementDraft(draft: AnnouncementDraft): AnnouncementDraft {
  return {
    ...draft,
    id: '',
    status: 'DRAFT',
    startsAt: '',
    endsAt: '',
    updatedAt: '',
    channels: [...draft.channels],
    surfaceOverrides: { ...draft.surfaceOverrides },
  };
}

export function normalizeAnnouncementDraft(draft: AnnouncementDraft | null): unknown {
  if (!draft) return null;
  return {
    content: draft.content.trimEnd(),
    bannerTitle: draft.bannerTitle.trimEnd(),
    bannerSubtitle: draft.bannerSubtitle.trimEnd(),
    bannerLink: draft.bannerLink.trim(),
    bannerImage: draft.bannerImage.trim(),
    ctaLabel: draft.ctaLabel.trimEnd(),
    status: draft.status,
    audience: draft.audience,
    priority: draft.priority,
    channels: [...draft.channels].sort(),
    dismissible: draft.dismissible,
    startsAt: normalizeDateTime(draft.startsAt),
    endsAt: normalizeDateTime(draft.endsAt),
    surfaceOverrides: stableObject(draft.surfaceOverrides),
  };
}

export function announcementDraftsEqual(
  baseline: AnnouncementDraft | null,
  draft: AnnouncementDraft | null,
): boolean {
  return JSON.stringify(normalizeAnnouncementDraft(baseline)) === JSON.stringify(normalizeAnnouncementDraft(draft));
}

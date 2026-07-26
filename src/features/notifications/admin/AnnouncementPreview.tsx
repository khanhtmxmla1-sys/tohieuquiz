import React from 'react';
import type { Announcement } from '../../../services/announcementService';
import {
  AnnouncementTicker,
  CriticalAlertStrip,
  InFlowAnnouncementBanner,
} from '../components';
import type { NotificationSurface } from '../selectAnnouncements';
import type { AnnouncementDraft } from './AnnouncementComposer';

interface AnnouncementPreviewProps {
  draft: AnnouncementDraft;
  surface: NotificationSurface;
  device: 'desktop' | 'mobile';
}

export function AnnouncementPreview({
  draft,
  surface,
  device,
}: AnnouncementPreviewProps) {
  const announcement: Announcement = {
    id: draft.id || 'preview',
    content: draft.content || 'Nội dung thông báo sẽ hiển thị tại đây.',
    bannerTitle: draft.bannerTitle || 'Tiêu đề thông báo',
    bannerSubtitle: draft.bannerSubtitle,
    bannerLink: draft.bannerLink,
    bannerImage: draft.bannerImage,
    isActive: true,
    updatedAt: draft.updatedAt || 'preview',
    status: draft.status,
    audience: draft.audience,
    startsAt: draft.startsAt || null,
    endsAt: draft.endsAt || null,
    priority: draft.priority,
    channels: draft.channels,
    dismissible: false,
    ctaLabel: draft.ctaLabel,
    surfaceOverrides: draft.surfaceOverrides,
  };

  return (
    <div
      data-testid="announcement-preview"
      data-surface={surface}
      data-device={device}
      className={[
        'mx-auto overflow-hidden rounded-2xl border bg-white shadow-sm',
        device === 'mobile' ? 'max-w-[390px]' : 'max-w-3xl',
      ].join(' ')}
    >
      {draft.channels.includes('CRITICAL_STRIP') && (
        <CriticalAlertStrip announcement={announcement} surface={surface} />
      )}
      {draft.channels.includes('TICKER') && (
        <AnnouncementTicker announcement={announcement} />
      )}
      <div className="min-h-36 p-4">
        {draft.channels.includes('BANNER') && (
          <InFlowAnnouncementBanner announcement={announcement} surface={surface} />
        )}
      </div>
    </div>
  );
}

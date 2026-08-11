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
  const hasTextContent = Boolean(draft.content.trim());
  const hasBannerContent = Boolean(
    draft.bannerTitle.trim() || draft.bannerSubtitle.trim() || draft.content.trim(),
  );
  const hasRenderableContent = draft.channels.some((channel) => (
    channel === 'BANNER' ? hasBannerContent
      : channel === 'TICKER' || channel === 'CRITICAL_STRIP' ? hasTextContent
        : false
  ));

  const announcement: Announcement = {
    id: draft.id || 'preview',
    content: draft.content,
    bannerTitle: draft.bannerTitle,
    bannerSubtitle: draft.bannerSubtitle,
    bannerLink: draft.bannerLink,
    bannerImage: draft.bannerImage,
    isActive: draft.channels.includes('TICKER'),
    updatedAt: draft.updatedAt || 'preview',
    status: draft.status,
    audience: draft.audience,
    startsAt: draft.startsAt || null,
    endsAt: draft.endsAt || null,
    priority: draft.priority,
    channels: draft.channels,
    dismissible: draft.dismissible,
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
      {!hasRenderableContent ? (
        <div className="p-6 text-center text-sm text-slate-500">
          Chưa có nội dung để xem trước.
        </div>
      ) : (
        <>
          {draft.channels.includes('CRITICAL_STRIP') && hasTextContent && (
            <CriticalAlertStrip announcement={announcement} surface={surface} />
          )}
          {draft.channels.includes('TICKER') && hasTextContent && (
            <AnnouncementTicker announcement={announcement} />
          )}
          {draft.channels.includes('BANNER') && hasBannerContent && (
            <div className="p-4">
              <InFlowAnnouncementBanner announcement={announcement} surface={surface} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

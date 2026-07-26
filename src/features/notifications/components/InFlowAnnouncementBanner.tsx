import React, { useMemo, useState } from 'react';
import { ArrowRight, Info, X } from 'lucide-react';
import { isSafeNotificationActionUrl } from '../../../../shared/notifications.contract';
import type { Announcement } from '../../../services/announcementService';
import type { NotificationSurface } from '../selectAnnouncements';
import { announcementDismissKey } from './CriticalAlertStrip';

interface InFlowAnnouncementBannerProps {
  announcement: Announcement;
  surface: NotificationSurface;
}

export function InFlowAnnouncementBanner({
  announcement,
  surface,
}: InFlowAnnouncementBannerProps) {
  const key = useMemo(
    () => announcementDismissKey(surface, announcement),
    [announcement, surface],
  );
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(key) === '1',
  );
  if (dismissed) return null;

  const title = announcement.bannerTitle || 'Thông báo quan trọng';
  const safeLink = isSafeNotificationActionUrl(announcement.bannerLink)
    ? announcement.bannerLink
    : null;
  const dismiss = () => {
    localStorage.setItem(key, '1');
    setDismissed(true);
  };

  return (
    <section
      role="region"
      aria-label={title}
      className="my-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm"
    >
      <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-6">
          {announcement.bannerSubtitle || announcement.content}
        </p>
        {safeLink && (
          <a
            href={safeLink}
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white"
          >
            {announcement.ctaLabel || 'Xem chi tiết'}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </a>
        )}
      </div>
      {announcement.dismissible && (
        <button
          type="button"
          aria-label="Đóng thông báo"
          className="rounded-full p-1 hover:bg-amber-100"
          onClick={dismiss}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </section>
  );
}

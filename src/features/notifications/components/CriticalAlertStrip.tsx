import React, { useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { Announcement } from '../../../services/announcementService';
import type { NotificationSurface } from '../selectAnnouncements';

interface CriticalAlertStripProps {
  announcement: Announcement;
  surface: NotificationSurface;
}

export function announcementDismissKey(
  surface: NotificationSurface,
  announcement: Announcement,
): string {
  return [
    'tohieuquiz:announcement-dismissed',
    surface,
    announcement.id,
    announcement.updatedAt,
  ].join(':');
}

export function CriticalAlertStrip({
  announcement,
  surface,
}: CriticalAlertStripProps) {
  const key = useMemo(
    () => announcementDismissKey(surface, announcement),
    [announcement, surface],
  );
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(key) === '1',
  );
  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(key, '1');
    setDismissed(true);
  };

  return (
    <section
      aria-label="Cảnh báo hệ thống"
      className="flex items-start gap-3 border-y border-red-200 bg-red-50 px-4 py-3 text-red-950"
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
      <div className="min-w-0 flex-1">
        <strong className="text-sm uppercase tracking-wide">Khẩn cấp</strong>
        <p className="mt-0.5 text-sm leading-6">{announcement.content}</p>
      </div>
      {announcement.dismissible && (
        <button
          type="button"
          aria-label="Đóng cảnh báo"
          className="rounded-full p-1 hover:bg-red-100"
          onClick={dismiss}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </section>
  );
}

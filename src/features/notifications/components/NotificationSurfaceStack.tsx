import React, { useEffect, useState } from 'react';
import {
  getAnnouncements,
  type Announcement,
} from '../../../services/announcementService';
import {
  selectAnnouncementSurfaces,
  type NotificationSurface,
} from '../selectAnnouncements';
import { AnnouncementTicker } from './AnnouncementTicker';
import { CriticalAlertStrip } from './CriticalAlertStrip';
import { InFlowAnnouncementBanner } from './InFlowAnnouncementBanner';

interface NotificationSurfaceStackProps {
  surface: NotificationSurface;
  role?: 'teacher' | 'student' | 'admin';
}

export function NotificationSurfaceStack({
  surface,
  role,
}: NotificationSurfaceStackProps) {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    let active = true;
    const audienceRole = role === 'student'
      ? 'student'
      : role === 'teacher' || role === 'admin'
        ? 'teacher'
        : undefined;
    void getAnnouncements(audienceRole)
      .then((nextItems) => {
        if (active) setItems(nextItems);
      })
      .catch((error) => {
        console.warn('[Notifications] announcement collection unavailable', error);
        if (active) setItems([]);
      });
    return () => {
      active = false;
    };
  }, [role]);

  const selected = selectAnnouncementSurfaces(items, surface);
  if (!selected.critical && !selected.ticker && !selected.banner) return null;

  return (
    <div data-notification-surface={surface}>
      {selected.critical && (
        <CriticalAlertStrip announcement={selected.critical} surface={surface} />
      )}
      {selected.ticker && <AnnouncementTicker announcement={selected.ticker} />}
      {selected.banner && (
        <InFlowAnnouncementBanner announcement={selected.banner} surface={surface} />
      )}
    </div>
  );
}

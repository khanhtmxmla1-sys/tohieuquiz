import type { Announcement } from '../../services/announcementService';

export type NotificationSurface =
  | 'LOGIN'
  | 'TEACHER_DASHBOARD'
  | 'STUDENT_DASHBOARD';

const PRIORITY_WEIGHT: Record<Announcement['priority'], number> = {
  INFO: 0,
  REMINDER: 1,
  IMPORTANT: 2,
  URGENT: 3,
};

function isAllowedOnSurface(
  announcement: Announcement,
  surface: NotificationSurface,
): boolean {
  const overrides = announcement.surfaceOverrides;
  if (!overrides || Object.keys(overrides).length === 0) return true;

  const surfaces = overrides.surfaces;
  if (Array.isArray(surfaces)) {
    return surfaces.includes(surface);
  }

  const explicit = overrides[surface];
  return typeof explicit === 'boolean' ? explicit : true;
}

export function selectAnnouncementSurfaces(
  items: Announcement[],
  surface: NotificationSurface,
): {
  critical: Announcement | null;
  ticker: Announcement | null;
  banner: Announcement | null;
} {
  const candidates = items
    .filter((item) => isAllowedOnSurface(item, surface))
    .map((item, index) => ({ item, index }))
    .sort((left, right) => (
      PRIORITY_WEIGHT[right.item.priority] - PRIORITY_WEIGHT[left.item.priority]
      || Date.parse(right.item.updatedAt) - Date.parse(left.item.updatedAt)
      || left.index - right.index
    ));
  const usedIds = new Set<string>();

  const take = (channel: Announcement['channels'][number]): Announcement | null => {
    const match = candidates.find(({ item }) => (
      item.channels.includes(channel) && !usedIds.has(item.id)
    ));
    if (!match) return null;
    usedIds.add(match.item.id);
    return match.item;
  };

  return {
    critical: take('CRITICAL_STRIP'),
    ticker: take('TICKER'),
    banner: take('BANNER'),
  };
}

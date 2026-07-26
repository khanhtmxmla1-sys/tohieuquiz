import { describe, expect, it } from 'vitest';
import type { Announcement } from '../src/services/announcementService';
import { selectAnnouncementSurfaces } from '../src/features/notifications/selectAnnouncements';

const announcement = (
  id: string,
  priority: Announcement['priority'],
  channels: Announcement['channels'],
  surfaceOverrides: Announcement['surfaceOverrides'] = {},
): Announcement => ({
  id,
  content: id,
  isActive: true,
  updatedAt: `2026-07-24T00:00:0${id.length}.000Z`,
  priority,
  channels,
  dismissible: true,
  surfaceOverrides,
});

describe('selectAnnouncementSurfaces', () => {
  it('selects the highest-priority distinct item for each channel', () => {
    const result = selectAnnouncementSurfaces([
      announcement('ticker-info', 'INFO', ['TICKER']),
      announcement('banner-important', 'IMPORTANT', ['BANNER']),
      announcement('strip-important', 'IMPORTANT', ['CRITICAL_STRIP']),
      announcement('strip-urgent', 'URGENT', ['CRITICAL_STRIP']),
    ], 'LOGIN');

    expect(result.critical?.id).toBe('strip-urgent');
    expect(result.ticker?.id).toBe('ticker-info');
    expect(result.banner?.id).toBe('banner-important');
  });

  it('excludes announcements outside the requested surface', () => {
    const result = selectAnnouncementSurfaces([
      announcement('teacher-only', 'URGENT', ['CRITICAL_STRIP'], {
        surfaces: ['TEACHER_DASHBOARD'],
      }),
      announcement('login', 'IMPORTANT', ['CRITICAL_STRIP'], {
        surfaces: ['LOGIN'],
      }),
    ], 'LOGIN');

    expect(result.critical?.id).toBe('login');
  });

  it('does not reuse one announcement for strip and banner', () => {
    const result = selectAnnouncementSurfaces([
      announcement('multi', 'URGENT', ['CRITICAL_STRIP', 'BANNER']),
      announcement('banner-fallback', 'IMPORTANT', ['BANNER']),
    ], 'STUDENT_DASHBOARD');

    expect(result.critical?.id).toBe('multi');
    expect(result.banner?.id).toBe('banner-fallback');
  });

  it('does not mutate the input order or channel arrays', () => {
    const items = [
      announcement('low', 'INFO', ['TICKER']),
      announcement('high', 'URGENT', ['TICKER', 'BANNER']),
    ];
    const snapshot = structuredClone(items);

    selectAnnouncementSurfaces(items, 'TEACHER_DASHBOARD');

    expect(items).toEqual(snapshot);
  });
});

import { describe, expect, it } from 'vitest';
import {
  ANNOUNCEMENT_AUDIENCE_META,
  ANNOUNCEMENT_CHANNEL_META,
  ANNOUNCEMENT_PRESET_META,
  ANNOUNCEMENT_STATUS_META,
} from '../src/features/notifications/admin/announcementAdminMeta';
import {
  filterAnnouncementAdminItems,
  formatAnnouncementAdminSchedule,
  getAnnouncementAdminPreset,
  getAnnouncementEffectiveStatus,
  type AnnouncementAdminFilter,
  type AnnouncementAdminListItem,
} from '../src/features/notifications/admin/announcementAdminSelectors';

const item = (
  id: string,
  overrides: Partial<AnnouncementAdminListItem> = {},
): AnnouncementAdminListItem => ({
  id,
  content: `Nội dung ${id}`,
  bannerTitle: `Tiêu đề ${id}`,
  bannerSubtitle: '',
  status: 'DRAFT',
  effectiveStatus: 'DRAFT',
  audience: 'ALL',
  priority: 'INFO',
  channels: ['TICKER'],
  startsAt: null,
  endsAt: null,
  updatedAt: '2026-08-11T01:00:00.000Z',
  ...overrides,
});

const filters = (overrides: Partial<AnnouncementAdminFilter> = {}): AnnouncementAdminFilter => ({
  status: 'ALL',
  audience: 'ALL',
  preset: 'ALL',
  query: '',
  ...overrides,
});

describe('announcement admin metadata', () => {
  it('provides Vietnamese labels for every persisted status and audience', () => {
    expect(ANNOUNCEMENT_STATUS_META).toMatchObject({
      DRAFT: { label: 'Bản nháp' },
      SCHEDULED: { label: 'Đã lên lịch' },
      PUBLISHED: { label: 'Đang hiển thị' },
      EXPIRED: { label: 'Đã kết thúc' },
      ARCHIVED: { label: 'Đã lưu trữ' },
    });
    expect(ANNOUNCEMENT_AUDIENCE_META).toMatchObject({
      ALL: { label: 'Toàn hệ thống' },
      TEACHERS: { label: 'Giáo viên' },
      STUDENTS: { label: 'Học sinh' },
    });
    expect(ANNOUNCEMENT_CHANNEL_META.TICKER.label).toBe('Tin chạy');
    expect(ANNOUNCEMENT_PRESET_META.URGENT.label).toBe('Cảnh báo khẩn');
  });
});

describe('announcement admin selectors', () => {
  it('uses effectiveStatus and falls back to stored status for legacy rows', () => {
    expect(getAnnouncementEffectiveStatus(item('scheduled', {
      status: 'DRAFT',
      effectiveStatus: 'SCHEDULED',
    }))).toBe('SCHEDULED');
    expect(getAnnouncementEffectiveStatus(item('legacy', {
      status: 'PUBLISHED',
      effectiveStatus: undefined,
    }))).toBe('PUBLISHED');
  });

  it.each([
    ['status', filters({ status: 'SCHEDULED' }), ['scheduled']],
    ['audience', filters({ audience: 'TEACHERS' }), ['teacher']],
    ['preset', filters({ preset: 'BANNER' }), ['banner']],
    ['query title case-insensitively', filters({ query: 'THÔNG BÁO ĐẶC BIỆT' }), ['special']],
  ] as const)('filters by %s', (_label, filter, expectedIds) => {
    const rows = [
      item('draft'),
      item('scheduled', { effectiveStatus: 'SCHEDULED', startsAt: '2026-08-11T08:00:00.000Z' }),
      item('teacher', { audience: 'TEACHERS' }),
      item('banner', { channels: ['BANNER'] }),
      item('special', { bannerTitle: 'Thông báo đặc biệt' }),
    ];

    expect(filterAnnouncementAdminItems(rows, filter).map((row) => row.id)).toEqual(expectedIds);
  });

  it('combines status, audience, preset and query filters', () => {
    const rows = [
      item('match', {
        effectiveStatus: 'PUBLISHED',
        audience: 'STUDENTS',
        channels: ['BANNER'],
        bannerTitle: 'Khai giảng',
      }),
      item('wrong-audience', {
        effectiveStatus: 'PUBLISHED',
        audience: 'TEACHERS',
        channels: ['BANNER'],
        bannerTitle: 'Khai giảng',
      }),
    ];

    expect(filterAnnouncementAdminItems(rows, filters({
      status: 'PUBLISHED',
      audience: 'STUDENTS',
      preset: 'BANNER',
      query: 'khai GIẢNG',
    })).map((row) => row.id)).toEqual(['match']);
  });

  it('derives friendly presets without exposing raw channel arrays', () => {
    expect(getAnnouncementAdminPreset(item('urgent', { priority: 'URGENT', channels: ['CRITICAL_STRIP'] }))).toBe('URGENT');
    expect(getAnnouncementAdminPreset(item('banner', { channels: ['BANNER'] }))).toBe('BANNER');
    expect(getAnnouncementAdminPreset(item('ticker', { channels: ['TICKER'] }))).toBe('TICKER');
    expect(getAnnouncementAdminPreset(item('mixed', { channels: ['TICKER', 'BANNER'] }))).toBe('MULTI');
  });

  it('formats schedule timestamps in the system Hanoi timezone', () => {
    expect(formatAnnouncementAdminSchedule(item('scheduled', {
      startsAt: '2026-08-11T01:30:00.000Z',
      endsAt: '2026-08-11T03:30:00.000Z',
    }))).toContain('08:30');
    expect(formatAnnouncementAdminSchedule(item('open'))).toBe('Không giới hạn thời gian');
  });
});

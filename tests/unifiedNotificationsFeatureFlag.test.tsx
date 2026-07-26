import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NotificationSurfaceStack } from '../src/features/notifications/components';
import { useUnifiedNotificationsFeatureFlag } from '../src/features/notifications/useUnifiedNotificationsFeatureFlag';

const getSystemSettingsMock = vi.hoisted(() => vi.fn());
const getAnnouncementsMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/systemSettingsService', () => ({
  getSystemSettings: getSystemSettingsMock,
}));

vi.mock('../src/services/announcementService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/announcementService')>();
  return { ...actual, getAnnouncements: getAnnouncementsMock };
});

function FlaggedLayout() {
  const flag = useUnifiedNotificationsFeatureFlag();
  return (
    <div data-testid="layout-shell">
      <span>Trang vẫn hoạt động</span>
      {!flag.ready ? (
        <span>Đang tải cấu hình</span>
      ) : flag.enabled ? (
        <NotificationSurfaceStack surface="LOGIN" />
      ) : (
        <div data-testid="legacy-notifications">Thông báo cũ</div>
      )}
    </div>
  );
}

describe('unified notification rollout flag', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders only the legacy experience when the flag is off', async () => {
    getSystemSettingsMock.mockResolvedValue({
      aiAssistantEnabled: true,
      unifiedNotificationsEnabled: false,
    });

    render(<FlaggedLayout />);

    expect(await screen.findByTestId('legacy-notifications')).toBeInTheDocument();
    expect(getAnnouncementsMock).not.toHaveBeenCalled();
  });

  it('renders only the unified stack when the flag is on', async () => {
    getSystemSettingsMock.mockResolvedValue({
      aiAssistantEnabled: true,
      unifiedNotificationsEnabled: true,
    });
    getAnnouncementsMock.mockResolvedValue([{
      id: 'announcement-1',
      content: 'Nhắc lịch kiểm tra sáng mai',
      bannerTitle: '',
      bannerSubtitle: '',
      bannerLink: '',
      bannerImage: '',
      isActive: true,
      isBannerActive: false,
      status: 'PUBLISHED',
      effectiveStatus: 'PUBLISHED',
      audience: 'ALL',
      startsAt: null,
      endsAt: null,
      updatedAt: '2026-07-24T00:00:00.000Z',
      priority: 'REMINDER',
      channels: ['TICKER'],
      dismissible: true,
      ctaLabel: '',
      surfaceOverrides: {},
    }]);

    render(<FlaggedLayout />);

    expect(await screen.findByText('Nhắc lịch kiểm tra sáng mai')).toBeInTheDocument();
    expect(screen.queryByTestId('legacy-notifications')).not.toBeInTheDocument();
  });

  it('keeps the layout usable when the unified collection API fails', async () => {
    getSystemSettingsMock.mockResolvedValue({
      aiAssistantEnabled: true,
      unifiedNotificationsEnabled: true,
    });
    getAnnouncementsMock.mockRejectedValue(new Error('temporarily unavailable'));

    render(<FlaggedLayout />);

    await act(async () => undefined);
    await waitFor(() => expect(getAnnouncementsMock).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('layout-shell')).toHaveTextContent('Trang vẫn hoạt động');
  });
});

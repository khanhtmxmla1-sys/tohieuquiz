import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAnnouncements = vi.hoisted(() => vi.fn());

vi.mock('../src/services/announcementService', async () => {
  const actual = await vi.importActual('../src/services/announcementService');
  return { ...actual, getAnnouncements };
});
vi.mock('../src/services/systemSettingsService', () => ({
  getSystemSettings: vi.fn(async () => ({
    aiAssistantEnabled: true,
    unifiedNotificationsEnabled: true,
  })),
}));
vi.mock('../stores/authStore', () => ({
  useAuthStore: () => ({
    isLoggingIn: false,
    loginStart: vi.fn(),
    loginPendingPasswordChange: vi.fn(),
    loginSuccess: vi.fn(),
    loginFailure: vi.fn(),
  }),
}));
vi.mock('../src/stores/useClassroomStore', () => ({
  useClassroomStore: () => ({
    isLoading: false,
    loginStudent: vi.fn(),
  }),
}));
vi.mock('../stores/quizStore', () => ({
  useQuizStore: () => ({ setView: vi.fn() }),
}));
vi.mock('../src/components/HomePage/components/LandingHeader', () => ({
  default: () => <header>TôHiệuQuiz</header>,
}));
vi.mock('../src/components/HomePage/components/HeroSection', () => ({
  default: () => <div>Học vui mỗi ngày</div>,
}));
vi.mock('../src/components/HomePage/components/LoginForm', () => ({
  default: () => (
    <form aria-label="Đăng nhập">
      <button type="submit">Đăng nhập</button>
    </form>
  ),
}));
vi.mock('../src/components/HomePage/components/LandingFooter', () => ({
  default: () => <footer>TôHiệuQuiz</footer>,
}));
vi.mock('../src/components/common/PasswordChangeDialog', () => ({
  default: () => null,
}));

import LoginLandingPage from '../src/components/HomePage/LoginLandingPage';

describe('login notification integration', () => {
  beforeEach(() => {
    localStorage.clear();
    getAnnouncements.mockReset();
    getAnnouncements.mockResolvedValue([
      {
        id: 'ticker-login',
        content: 'Thông báo chung cho phụ huynh và học sinh',
        isActive: true,
        updatedAt: '2026-07-24T00:00:00.000Z',
        priority: 'INFO',
        channels: ['TICKER'],
        dismissible: true,
      },
      {
        id: 'banner-login',
        content: 'Vui lòng cập nhật thông tin trước năm học mới',
        bannerTitle: 'Chuẩn bị năm học mới',
        isActive: true,
        updatedAt: '2026-07-24T00:00:01.000Z',
        priority: 'IMPORTANT',
        channels: ['BANNER'],
        dismissible: true,
      },
    ]);
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
      unobserve() {}
    });
  });

  it('renders public ticker and in-flow banner before the login form', async () => {
    render(<LoginLandingPage />);

    expect(await screen.findByRole('region', { name: 'Thông báo chung' }))
      .toBeInTheDocument();
    const banner = screen.getByRole('region', { name: 'Chuẩn bị năm học mới' });
    expect(banner).not.toHaveClass('fixed');
    expect(getAnnouncements).toHaveBeenCalledWith(undefined);

    const form = screen.getByRole('form', { name: 'Đăng nhập' });
    await waitFor(() => {
      expect(
        banner.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });
});

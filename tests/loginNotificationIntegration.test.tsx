import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getLoginAnnouncements = vi.hoisted(() => vi.fn());

vi.mock('../src/services/announcementService', async () => {
  const actual = await vi.importActual('../src/services/announcementService');
  return { ...actual, getLoginAnnouncements };
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
  default: ({
    activeTab,
    setActiveTab,
    loginNotification,
  }: {
    activeTab: 'student' | 'teacher';
    setActiveTab: (role: 'student' | 'teacher') => void;
    loginNotification?: { id: string; content: string } | null;
  }) => (
    <section data-testid="login-form-shell">
      <div data-purpose="role-switcher">
        <button type="button" onClick={() => setActiveTab('student')}>Học sinh</button>
        <button type="button" onClick={() => setActiveTab('teacher')}>Giáo viên</button>
      </div>
      {loginNotification && (
        <div data-testid="login-notification">{loginNotification.content}</div>
      )}
      <form aria-label="Đăng nhập">
        <span data-testid="login-role">{activeTab}</span>
        <button type="submit">Đăng nhập</button>
      </form>
    </section>
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
    getLoginAnnouncements.mockReset();
    getLoginAnnouncements.mockImplementation(async (role?: 'student' | 'teacher') => [
      {
        id: `${role || 'all'}-critical-login`,
        content: role === 'teacher'
          ? 'Giáo viên: hệ thống đang được bảo trì.'
          : 'Học sinh: hệ thống đang được bảo trì.',
        isActive: true,
        updatedAt: '2026-07-24T00:00:00.000Z',
        priority: 'URGENT',
        channels: ['CRITICAL_STRIP'],
        dismissible: false,
      },
      {
        id: `${role || 'all'}-banner-login`,
        content: role === 'teacher'
          ? 'Giáo viên: xem hướng dẫn cập nhật dữ liệu.'
          : 'Học sinh: xem hướng dẫn cập nhật thông tin.',
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

  it('renders critical alert below the header and a static role-specific notice inside the login form', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <LoginLandingPage />
      </MemoryRouter>,
    );

    const critical = await screen.findByRole('region', { name: 'Cảnh báo hệ thống' });
    expect(critical).toBeInTheDocument();
    expect(screen.queryByTestId('notification-ticker-track')).not.toBeInTheDocument();
    expect(screen.getByTestId('login-notification')).toHaveTextContent(
      'Học sinh: xem hướng dẫn cập nhật thông tin.',
    );
    expect(getLoginAnnouncements).toHaveBeenCalledWith('student');

    const form = screen.getByRole('form', { name: 'Đăng nhập' });
    const roleSwitcher = screen.getByTestId('login-form-shell').querySelector('[data-purpose="role-switcher"]');
    const notice = screen.getByTestId('login-notification');
    expect(roleSwitcher?.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notice.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Giáo viên' }));
    await waitFor(() => {
      expect(getLoginAnnouncements).toHaveBeenLastCalledWith('teacher');
      expect(screen.getByTestId('login-notification')).toHaveTextContent(
        'Giáo viên: xem hướng dẫn cập nhật dữ liệu.',
      );
      expect(screen.getByRole('region', { name: 'Cảnh báo hệ thống' })).toHaveTextContent(
        'Giáo viên: hệ thống đang được bảo trì.',
      );
    });
  });

  it('opens the requested login role from the guarded deep-link query', async () => {
    localStorage.setItem('tohieuquiz_saved_login_v1', JSON.stringify({
      username: 'student.one',
      role: 'student',
      savedAt: '2026-07-28T00:00:00.000Z',
    }));

    render(
      <MemoryRouter initialEntries={['/?login=teacher&returnTo=%2Fteacher%2Fresults']}>
        <LoginLandingPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('login-role')).toHaveTextContent('teacher'));
  });
});

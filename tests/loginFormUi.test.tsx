import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginForm from '../src/components/HomePage/components/LoginForm';
import type { Announcement } from '../src/services/announcementService';

const loginAnnouncement: Announcement = {
  id: 'login-notice',
  content: 'Hệ thống có thể phản hồi chậm trong giờ cao điểm.',
  bannerTitle: 'Lưu ý khi đăng nhập',
  isActive: true,
  updatedAt: '2026-07-24T00:00:00.000Z',
  priority: 'IMPORTANT',
  channels: ['TICKER'],
  dismissible: true,
};

const renderLoginForm = (overrides: Partial<React.ComponentProps<typeof LoginForm>> = {}) => {
  const props: React.ComponentProps<typeof LoginForm> = {
    activeTab: 'teacher',
    setActiveTab: vi.fn(),
    username: '',
    setUsername: vi.fn(),
    password: 'mat-khau-bi-mat',
    setPassword: vi.fn(),
    isLoading: false,
    onSubmit: vi.fn(),
    rememberLogin: false,
    setRememberLogin: vi.fn(),
    ...overrides,
  };

  const view = render(<LoginForm {...props} />);
  return { props, ...view };
};

describe('landing login form UI', () => {
  it('lets users show and hide the password accessibly', () => {
    renderLoginForm();

    const passwordInput = screen.getByLabelText('Mật khẩu');
    expect(passwordInput).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('keeps the parent portal entry outside the student and teacher login form', () => {
    renderLoginForm();

    expect(screen.queryByRole('link', { name: /Cổng phụ huynh/i })).not.toBeInTheDocument();
  });

  it('exposes selected role and remember-login controls', () => {
    const setActiveTab = vi.fn();
    const setRememberLogin = vi.fn();
    renderLoginForm({ setActiveTab, setRememberLogin });

    expect(screen.getByRole('button', { name: 'Giáo viên' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Học sinh' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Học sinh' }));
    expect(setActiveTab).toHaveBeenCalledWith('student');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Ghi nhớ đăng nhập' }));
    expect(setRememberLogin).toHaveBeenCalledWith(true);
  });

  it('renders one login notice after the role switcher without a ticker animation', () => {
    renderLoginForm({ loginNotification: loginAnnouncement });

    const roleSwitcher = screen.getByRole('group', { name: 'Chọn vai trò đăng nhập' });
    const notices = screen.getByLabelText('Thông báo đăng nhập');
    const form = screen.getByRole('form', { name: 'Đăng nhập' });

    expect(roleSwitcher.compareDocumentPosition(notices) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notices.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Lưu ý khi đăng nhập' })).toBeInTheDocument();
    expect(screen.queryByTestId('notification-ticker-track')).not.toBeInTheDocument();
  });

  it('gives ticker fallback notices a clear login title', () => {
    renderLoginForm({
      loginNotification: { ...loginAnnouncement, bannerTitle: undefined },
    });

    expect(screen.getByRole('region', { name: 'Thông báo đăng nhập' })).toBeInTheDocument();
  });

  it('exposes inline field and form errors to assistive technology', () => {
    renderLoginForm({
      usernameError: 'Vui lòng nhập tên đăng nhập.',
      passwordError: 'Vui lòng nhập mật khẩu.',
      formError: 'Tên đăng nhập hoặc mật khẩu không đúng!',
    } as any);

    const usernameInput = screen.getByLabelText('Tên đăng nhập');
    const passwordInput = screen.getByLabelText('Mật khẩu');

    expect(usernameInput).toHaveAttribute('aria-invalid', 'true');
    expect(usernameInput).toHaveAttribute('aria-describedby', 'landing-login-username-error');
    expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
    expect(passwordInput).toHaveAttribute('aria-describedby', 'landing-login-password-error');
    expect(screen.getByText('Vui lòng nhập tên đăng nhập.')).toHaveAttribute('id', 'landing-login-username-error');
    expect(screen.getByText('Vui lòng nhập mật khẩu.')).toHaveAttribute('id', 'landing-login-password-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Tên đăng nhập hoặc mật khẩu không đúng!');
  });

  it('uses readable placeholder contrast and one role-specific support action', () => {
    const { rerender } = renderLoginForm({ activeTab: 'student' });
    expect(screen.getByLabelText('Tên đăng nhập')).toHaveClass('placeholder:text-[#64748b]');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link')).toHaveTextContent('Học sinh hãy liên hệ giáo viên hoặc Quản trị viên để được hỗ trợ');

    rerender(<LoginForm
      activeTab="teacher"
      setActiveTab={vi.fn()}
      username=""
      setUsername={vi.fn()}
      password=""
      setPassword={vi.fn()}
      isLoading={false}
      onSubmit={vi.fn()}
    />);

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link')).toHaveTextContent('Giáo viên hãy liên hệ Quản trị viên để được hỗ trợ');
  });
});

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginForm from '../src/components/HomePage/components/LoginForm';

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

  render(<LoginForm {...props} />);
  return props;
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
});

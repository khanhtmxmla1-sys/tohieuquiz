import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginForm from '../src/components/HomePage/components/LoginForm';
import LoginModal from '../src/components/common/LoginModal';
import { ChangePasswordModal } from '../src/features/student-dashboard/components/ChangePasswordModal';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    form: ({ children, ...props }: React.FormHTMLAttributes<HTMLFormElement>) => (
      <form {...props}>{children}</form>
    ),
  },
}));

describe('password autocomplete metadata', () => {
  it('marks landing login username and password for password managers', () => {
    render(
      <LoginForm
        activeTab="teacher"
        setActiveTab={vi.fn()}
        username=""
        setUsername={vi.fn()}
        password=""
        setPassword={vi.fn()}
        isLoading={false}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('Tài khoản giáo viên'))
      .toHaveAttribute('autocomplete', 'username');
    expect(screen.getByPlaceholderText('••••••••'))
      .toHaveAttribute('autocomplete', 'current-password');
  });

  it('marks modal login username and password for password managers', () => {
    render(<LoginModal isOpen onClose={vi.fn()} initialTab="teacher" />);

    expect(screen.getByPlaceholderText('Tài Khoản'))
      .toHaveAttribute('autocomplete', 'username');
    expect(screen.getByPlaceholderText('••••••••'))
      .toHaveAttribute('autocomplete', 'current-password');
  });

  it('distinguishes current and new passwords in the student dialog', () => {
    render(<ChangePasswordModal account={{
      isOpen: true,
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
      isSubmitting: false,
      errorMessage: '',
      close: vi.fn(),
      submit: vi.fn(),
      setCurrentPassword: vi.fn(),
      setNewPassword: vi.fn(),
      setConfirmNewPassword: vi.fn(),
    } as any} />);

    const passwordInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="password"]'),
    );
    expect(passwordInputs).toHaveLength(3);
    expect(passwordInputs[0]).toHaveAttribute('autocomplete', 'current-password');
    expect(passwordInputs[1]).toHaveAttribute('autocomplete', 'new-password');
    expect(passwordInputs[2]).toHaveAttribute('autocomplete', 'new-password');
  });
});

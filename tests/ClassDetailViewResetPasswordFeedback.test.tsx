// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resetPassword: vi.fn(async () => true),
  showSuccess: vi.fn(),
}));

vi.mock('../src/stores/useRosterStore', () => ({
  useRosterStore: () => ({
    students: { c1: [{ id: 's1', fullName: 'Học Sinh Mẫu', username: 'student-a', classId: 'c1' }] },
    isLoading: false,
    error: null,
    fetchStudents: vi.fn(),
    addStudent: vi.fn(),
    addStudentsBulk: vi.fn(),
    resetPassword: mocks.resetPassword,
    removeStudent: vi.fn(),
  }),
}));

vi.mock('../src/features/class-management/components/StudentTable', () => ({
  StudentTable: ({ onResetPassword }: any) => (
    <button type="button" onClick={() => onResetPassword('s1')}>
      open-reset
    </button>
  ),
}));

vi.mock('../src/features/class-management/components/ParentCommunicationPanel', () => ({ default: () => null }));
vi.mock('../src/features/class-management/components/ParentAccessModal', () => ({ default: () => null }));
vi.mock('../src/features/class-management/components/Modals', () => ({
  AddStudentModal: () => null,
  ResetPasswordModal: ({ onSubmit }: { onSubmit: (password: string) => Promise<void> }) => (
    <button type="button" onClick={() => void onSubmit('Secret123')}>submit-reset</button>
  ),
}));
vi.mock('../src/components/common', () => ({
  Button: ({ children, onClick, disabled }: any) => <button onClick={onClick} disabled={disabled}>{children}</button>,
  ModuleIcon: () => <span />,
}));
vi.mock('../src/utils/toast', () => ({ showSuccess: mocks.showSuccess, showError: vi.fn() }));

import { ClassDetailView } from '../src/features/class-management/views/ClassDetailView';

describe('ClassDetailView reset-password clipboard feedback', () => {
  beforeEach(() => {
    mocks.resetPassword.mockClear();
    mocks.showSuccess.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => { throw new Error('clipboard denied'); }) },
    });
  });

  it('does not claim the password was copied when clipboard access fails', async () => {
    render(
      <ClassDetailView
        classroom={{ id: 'c1', name: '4A', teacherUsername: 'teacher-a', createdAt: '2026-08-01' }}
        onBack={vi.fn()}
        isOnline
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'open-reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'submit-reset' }));

    await waitFor(() => expect(mocks.resetPassword).toHaveBeenCalledWith('s1', 'Secret123', ''));
    expect(mocks.showSuccess).toHaveBeenCalledWith('Đã đặt lại mật khẩu. Không thể tự động sao chép; vui lòng sao chép thủ công.');
    expect(mocks.showSuccess).not.toHaveBeenCalledWith('Đã đặt lại mật khẩu và sao chép vào bộ nhớ tạm.');
  });
});

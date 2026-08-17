import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchStudents: vi.fn(),
  addStudent: vi.fn(),
  addStudentsBulk: vi.fn(),
  resetPassword: vi.fn(),
  removeStudent: vi.fn(),
}));

vi.mock('../src/stores/useRosterStore', () => ({
  useRosterStore: () => ({
    students: { c1: [{ id: 's1', fullName: 'Hoc Sinh Mau', username: 'student-a', classId: 'c1' }] },
    isLoading: false,
    error: null,
    fetchStudents: mocks.fetchStudents,
    addStudent: mocks.addStudent,
    addStudentsBulk: mocks.addStudentsBulk,
    resetPassword: mocks.resetPassword,
    removeStudent: mocks.removeStudent,
  }),
}));
vi.mock('../src/features/class-management/components/StudentTable', () => ({
  StudentTable: ({ serverActionsDisabled }: { serverActionsDisabled?: boolean }) => (
    <div>student-actions-disabled:{String(serverActionsDisabled)}</div>
  ),
}));
vi.mock('../src/features/class-management/components/ParentCommunicationPanel', () => ({
  default: ({ isOnline }: { isOnline?: boolean }) => <div>parent-online:{String(isOnline)}</div>,
}));
vi.mock('../src/features/class-management/components/ParentAccessModal', () => ({ default: () => null }));
vi.mock('../src/features/class-management/components/Modals', () => ({ AddStudentModal: () => null, ResetPasswordModal: () => null }));
vi.mock('../src/components/common', () => ({
  Button: ({ children, onClick, disabled, title }: any) => <button onClick={onClick} disabled={disabled} title={title}>{children}</button>,
  ModuleIcon: () => <span />,
}));
vi.mock('../src/utils/toast', () => ({ showSuccess: vi.fn(), showError: vi.fn() }));

import { ClassDetailView } from '../src/features/class-management/views/ClassDetailView';

describe('ClassDetailView offline behavior', () => {
  it('keeps cached roster visible while disabling server actions and refetch', () => {
    render(
      <ClassDetailView
        classroom={{ id: 'c1', name: '4A', teacherUsername: 'teacher-a', createdAt: '2026-08-01' }}
        onBack={vi.fn()}
        isOnline={false}
      /> as any,
    );

    expect(screen.getByRole('button', { name: 'Thêm học sinh' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tải lại' })).toBeDisabled();
    expect(screen.getByText('student-actions-disabled:true')).toBeInTheDocument();
    expect(screen.getByText('parent-online:false')).toBeInTheDocument();
    expect(screen.getByText(/Đang ngoại tuyến/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    expect(mocks.fetchStudents).not.toHaveBeenCalled();
  });
});

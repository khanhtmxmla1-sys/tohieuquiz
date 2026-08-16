import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  removeStudent: vi.fn(async () => true),
  showSuccess: vi.fn(),
}));

vi.mock('../src/stores/useRosterStore', () => ({
  useRosterStore: () => ({
    students: { c1: [{ id: 's1', fullName: 'Hoc Sinh Mau', username: 'student-a', classId: 'c1' }] },
    isLoading: false,
    error: null,
    fetchStudents: vi.fn(),
    addStudent: vi.fn(),
    addStudentsBulk: vi.fn(),
    resetPassword: vi.fn(),
    removeStudent: mocks.removeStudent,
  }),
}));
vi.mock('../src/features/class-management/components/StudentTable', () => ({
  StudentTable: ({ onRemoveStudent }: { onRemoveStudent: (studentId: string, classId: string) => Promise<void> }) => (
    <button type="button" onClick={() => void onRemoveStudent('s1', 'c1')}>archive-student</button>
  ),
}));
vi.mock('../src/features/class-management/components/ParentCommunicationPanel', () => ({ default: () => null }));
vi.mock('../src/features/class-management/components/ParentAccessModal', () => ({ default: () => null }));
vi.mock('../src/features/class-management/components/Modals', () => ({ AddStudentModal: () => null, ResetPasswordModal: () => null }));
vi.mock('../src/components/common', () => ({
  Button: ({ children, onClick, disabled }: any) => <button onClick={onClick} disabled={disabled}>{children}</button>,
  ModuleIcon: () => <span />,
}));
vi.mock('../src/utils/toast', () => ({ showSuccess: mocks.showSuccess, showError: vi.fn() }));

import { ClassDetailView } from '../src/features/class-management/views/ClassDetailView';

describe('ClassDetailView archive feedback', () => {
  it('confirms a successful soft archive to the teacher', async () => {
    render(
      <ClassDetailView
        classroom={{ id: 'c1', name: '4A', teacherUsername: 'teacher-a', createdAt: '2026-08-01' }}
        onBack={vi.fn()}
        isOnline
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'archive-student' }));

    await waitFor(() => expect(mocks.removeStudent).toHaveBeenCalledWith('s1', 'c1'));
    expect(mocks.showSuccess).toHaveBeenCalledWith('Đã lưu trữ học sinh.');
  });
});

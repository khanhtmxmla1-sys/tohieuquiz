import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const fixtures = vi.hoisted(() => ({
  student: { id: 'student-1', fullName: 'Nguyễn Văn An', username: 'an01', classId: 'class-1' },
}));
vi.mock('../src/stores/useRosterStore', () => ({
  useRosterStore: () => ({ students: { 'class-1': [fixtures.student] }, isLoading: false, error: null, fetchStudents: vi.fn(), addStudent: vi.fn(), addStudentsBulk: vi.fn(), resetPassword: vi.fn(), removeStudent: vi.fn() }),
}));
vi.mock('../src/features/class-management/components/StudentTable', () => ({
  StudentTable: ({ onParentAccess }: { onParentAccess: (student: typeof fixtures.student) => void }) => <button onClick={() => onParentAccess(fixtures.student)}>open-parent-access</button>,
}));
vi.mock('../src/features/class-management/components/ParentAccessModal', () => ({
  default: ({ studentName }: { studentName: string }) => <div role="dialog">parent-modal-{studentName}</div>,
}));
vi.mock('../src/features/class-management/components/ParentCommunicationPanel', () => ({
  default: ({ classId }: { classId: string }) => <div>parent-communication-{classId}</div>,
}));
vi.mock('../src/features/class-management/components/Modals', () => ({ AddStudentModal: () => null, ResetPasswordModal: () => null }));
vi.mock('../src/components/common', () => ({ Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button> }));
vi.mock('../src/utils/toast', () => ({ showSuccess: vi.fn(), showError: vi.fn() }));

import { ClassDetailView } from '../src/features/class-management/views/ClassDetailView';

describe('ClassDetailView Parent Portal integration', () => {
  it('owns the modal state and renders class communication separately', () => {
    render(<ClassDetailView classroom={{ id: 'class-1', name: '4A9', teacherUsername: 'teacher-a', createdAt: '2026-07-22' }} onBack={vi.fn()} />);
    expect(screen.getByText('parent-communication-class-1')).toBeInTheDocument();
    fireEvent.click(screen.getByText('open-parent-access'));
    expect(screen.getByRole('dialog')).toHaveTextContent('parent-modal-Nguyễn Văn An');
  });
});

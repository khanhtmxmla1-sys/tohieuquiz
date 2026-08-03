import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssignmentTab from '../src/components/TeacherDashboard/AssignmentTab';
import AssignmentTabModule from '../src/components/TeacherDashboard/assignment-tab';
import { useAuthStore } from '../stores/authStore';
import { useQuizStore } from '../stores/quizStore';
import { useAssignmentStore } from '../src/stores/useAssignmentStore';
import { useClassStore } from '../src/stores/useClassStore';
import { useRosterStore } from '../src/stores/useRosterStore';
import { useTeacherDashboardUIStore } from '../src/stores/useTeacherDashboardUIStore';

const mocks = vi.hoisted(() => ({
  showConfirm: vi.fn(),
}));

vi.mock('../src/utils/toast', () => ({
  showConfirm: mocks.showConfirm,
}));

vi.mock('../src/components/common', () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

vi.mock('../src/components/TeacherDashboard/SmartAssignmentInsightCard', () => ({
  default: ({ model, actions }: any) => (
    <div data-testid="smart-insight">{model?.statusLabel}{actions}</div>
  ),
}));

vi.mock('../src/components/TeacherDashboard/AssignmentTrackingSection', () => ({
  default: ({ onRevoke, onUpdateDeadline, onUpdateStatus, assignments }: any) => (
    <section data-testid="tracking-section">
      <span>{assignments.length} assignments</span>
      <button onClick={() => onRevoke('assignment-1', 'Đáp án chưa chính xác')}>Thu hồi tracking</button>
      <button onClick={() => onUpdateDeadline('assignment-1', '2026-08-01T00:00:00.000Z')}>Đổi hạn</button>
      <button onClick={() => onUpdateStatus('assignment-1', 'CLOSED')}>Đóng bài</button>
    </section>
  ),
}));

const classes = [{
  id: 'class-1',
  name: '3A',
  teacherUsername: 'teacher-a',
  createdAt: '2026-07-19T00:00:00.000Z',
}] as any;

const quizzes = [{
  id: 'quiz-1',
  title: 'Phân số',
  timeLimit: 20,
  questions: [],
}] as any;

const resetStores = (options: { isAdmin?: boolean; classError?: string | null; assignmentError?: string | null } = {}) => {
  useAuthStore.setState({
    isLoggedIn: true,
    username: 'teacher-a',
    teacherName: 'Cô An',
    teacherClass: '3A',
    isAdmin: options.isAdmin ?? false,
  } as any);
  useQuizStore.setState({ quizzes, results: [] } as any);
  useTeacherDashboardUIStore.setState({ activeTab: 'assignments', assignmentComposerDraft: null });

  useClassStore.setState({
    classes,
    isLoading: false,
    error: options.classError ?? null,
    fetchClasses: vi.fn().mockResolvedValue(undefined),
    clearError: vi.fn(() => useClassStore.setState({ error: null })),
  } as any);
  useRosterStore.setState({
    students: { 'class-1': [] },
    isLoading: false,
    error: null,
    fetchStudents: vi.fn().mockResolvedValue(undefined),
  } as any);
  useAssignmentStore.setState({
    assignments: [{ id: 'assignment-1' }],
    isLoading: false,
    error: options.assignmentError ?? null,
    fetchTeacherAssignments: vi.fn().mockResolvedValue(undefined),
    fetchAllAssignments: vi.fn().mockResolvedValue(undefined),
    addAssignment: vi.fn(async payload => ({ id: 'assignment-new', ...payload })),
    removeAssignment: vi.fn().mockResolvedValue(true),
    revokeAssignment: vi.fn().mockResolvedValue({
      assignmentId: 'assignment-1',
      status: 'REVOKED',
      previousStatus: 'OPEN',
      revokedAt: '2026-08-03T16:00:00.000Z',
      revokedBy: 'teacher-a',
      revokedReason: 'Đáp án chưa chính xác',
      submissionCountAtRevoke: 0,
      replayed: false,
    }),
    updateAssignmentDeadline: vi.fn().mockResolvedValue(true),
    updateAssignmentStatus: vi.fn().mockResolvedValue(true),
    clearError: vi.fn(() => useAssignmentStore.setState({ error: null })),
  } as any);
};

describe('AssignmentTab shell contracts', () => {
  it('keeps the dashboard compatibility export stable', () => {
    expect(AssignmentTab).toBe(AssignmentTabModule);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
    mocks.showConfirm.mockImplementation(({ onConfirm }: any) => {
      void onConfirm();
    });
  });

  it('loads teacher-scoped classes and assignments on mount', async () => {
    render(<AssignmentTab />);

    await waitFor(() => expect(useClassStore.getState().fetchClasses).toHaveBeenCalledWith('teacher-a'));
    expect(useAssignmentStore.getState().fetchTeacherAssignments).toHaveBeenCalledWith('teacher-a');
    expect(useAssignmentStore.getState().fetchAllAssignments).not.toHaveBeenCalled();
  });

  it('loads all classes and assignments for an admin', async () => {
    resetStores({ isAdmin: true });
    render(<AssignmentTab />);

    await waitFor(() => expect(useClassStore.getState().fetchClasses).toHaveBeenCalledWith());
    expect(useAssignmentStore.getState().fetchAllAssignments).toHaveBeenCalledTimes(1);
    expect(useAssignmentStore.getState().fetchTeacherAssignments).not.toHaveBeenCalled();
  });

  it('clears class and assignment errors together', () => {
    resetStores({ classError: 'Lỗi lớp', assignmentError: 'Lỗi bài giao' });
    render(<AssignmentTab />);

    expect(screen.getByText('Lỗi lớp')).toBeTruthy();
    const errorBanner = screen.getByText('Lỗi lớp').closest('div') as HTMLElement;
    fireEvent.click(errorBanner.querySelector('button') as HTMLButtonElement);

    expect(useClassStore.getState().clearError).toHaveBeenCalledTimes(1);
    expect(useAssignmentStore.getState().clearError).toHaveBeenCalledTimes(1);
  });

  it('refreshes teacher assignments after a successful create', async () => {
    render(<AssignmentTab />);
    await waitFor(() => expect(useAssignmentStore.getState().fetchTeacherAssignments).toHaveBeenCalledTimes(1));

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'quiz-1' } });
    fireEvent.change(selects[1], { target: { value: 'class-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Giao bài' }));

    await waitFor(() => expect(useAssignmentStore.getState().addAssignment).toHaveBeenCalledWith(expect.objectContaining({
      quizId: 'quiz-1',
      classId: 'class-1',
      maxAttempts: 1,
    })));
    await waitFor(() => expect(useAssignmentStore.getState().fetchTeacherAssignments).toHaveBeenCalledTimes(2));
  });

  it('revokes safely and refreshes after every successful tracking mutation', async () => {
    render(<AssignmentTab />);
    await waitFor(() => expect(useAssignmentStore.getState().fetchTeacherAssignments).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi tracking' }));
    await waitFor(() => expect(useAssignmentStore.getState().revokeAssignment).toHaveBeenCalledWith(
      'assignment-1',
      'Đáp án chưa chính xác',
    ));
    await waitFor(() => expect(useAssignmentStore.getState().fetchTeacherAssignments).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'Đổi hạn' }));
    await waitFor(() => expect(useAssignmentStore.getState().updateAssignmentDeadline).toHaveBeenCalledWith(
      'assignment-1',
      '2026-08-01T00:00:00.000Z',
    ));
    await waitFor(() => expect(useAssignmentStore.getState().fetchTeacherAssignments).toHaveBeenCalledTimes(3));

    fireEvent.click(screen.getByRole('button', { name: 'Đóng bài' }));
    await waitFor(() => expect(useAssignmentStore.getState().updateAssignmentStatus).toHaveBeenCalledWith(
      'assignment-1',
      'CLOSED',
    ));
    await waitFor(() => expect(useAssignmentStore.getState().fetchTeacherAssignments).toHaveBeenCalledTimes(4));
  });
});

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ManageTab from '../src/components/TeacherDashboard/ManageTab';
import { useAssignmentStore } from '../src/stores/useAssignmentStore';
import { useClassStore } from '../src/stores/useClassStore';
import { useRosterStore } from '../src/stores/useRosterStore';
import { useAuthStore } from '../stores/authStore';
import { useQuizStore } from '../stores/quizStore';

vi.mock('../src/components/TeacherDashboard/WorksheetExportModal', () => ({ default: () => null }));
vi.mock('../src/utils/toast', () => ({
  showConfirm: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

const quiz = {
  id: 'quiz-4',
  title: 'Phép cộng phân số',
  classLevel: '4',
  category: 'math',
  tags: ['phân số'],
  questions: [],
  timeLimit: 20,
  createdAt: '2026-07-23T00:00:00.000Z',
  createdBy: 'teacher-a',
} as any;

const resetStores = () => {
  useAuthStore.setState({
    isLoggedIn: true,
    username: 'teacher-a',
    teacherName: 'Cô An',
    teacherClass: '4A',
    isAdmin: false,
  } as any);
  useQuizStore.setState({
    quizzes: [quiz],
    loadQuizzes: vi.fn().mockResolvedValue(undefined),
    duplicateQuiz: vi.fn().mockResolvedValue(true),
  } as any);
  useClassStore.setState({
    classes: [{ id: 'class-4a', name: '4A', teacherUsername: 'teacher-a' }],
    isLoading: false,
    error: null,
    fetchClasses: vi.fn().mockResolvedValue(undefined),
    clearError: vi.fn(),
  } as any);
  useRosterStore.setState({
    students: { 'class-4a': [] },
    isLoading: false,
    error: null,
    fetchStudents: vi.fn().mockResolvedValue(undefined),
  } as any);
  useAssignmentStore.setState({
    assignments: [],
    isLoading: false,
    error: null,
    addAssignment: vi.fn().mockResolvedValue({ id: 'assignment-1' }),
    fetchTeacherAssignments: vi.fn().mockResolvedValue(undefined),
    fetchAllAssignments: vi.fn().mockResolvedValue(undefined),
    clearError: vi.fn(),
  } as any);
};

describe('ManageTab assignment drawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it('allows a 4A teacher to assign a grade 4 quiz through an accessible drawer', () => {
    render(<ManageTab quizzes={[quiz]} onEdit={vi.fn()} onManageCode={vi.fn()} />);

    const assignButton = screen.getByRole('button', { name: 'Giao bài' });
    expect(assignButton).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nhân bản' })).toBeNull();

    fireEvent.click(assignButton);
    const drawer = screen.getByRole('dialog', { name: 'Giao bài' });
    expect(drawer).toBeTruthy();
    expect(within(drawer).getAllByText('Phép cộng phân số').length).toBeGreaterThan(0);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Giao bài' })).toBeNull();
  });

  it('does not crash the quiz list when legacy tags contain malformed JSON', () => {
    const legacyQuiz = { ...quiz, id: 'quiz-legacy', title: 'Đề dữ liệu cũ', tags: '{bad-json' };
    render(<ManageTab quizzes={[legacyQuiz]} onEdit={vi.fn()} onManageCode={vi.fn()} />);

    expect(screen.getByText('Đề dữ liệu cũ')).toBeTruthy();
  });
});

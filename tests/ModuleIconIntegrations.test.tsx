import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchTeacherAssignments: vi.fn(),
  fetchClasses: vi.fn(),
}));

vi.mock('../src/features/certificates/useCertificates', () => ({
  useCertificates: () => ({
    certificates: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('../src/features/homework/stores/useHomeworkStore', () => ({
  useHomeworkStore: () => ({
    assignments: [],
    deleteAssignment: vi.fn(),
    updateAssignment: vi.fn(),
    addAssignment: vi.fn(),
    fetchTeacherAssignments: mocks.fetchTeacherAssignments,
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../src/stores/useClassStore', () => ({
  useClassStore: (selector: (state: { fetchClasses: typeof mocks.fetchClasses }) => unknown) => selector({
    fetchClasses: mocks.fetchClasses,
  }),
}));

vi.mock('../stores/authStore', () => ({
  useAuthStore: () => ({ username: null }),
}));

vi.mock('../src/features/homework/components/AssignmentCreator', () => ({ AssignmentCreator: () => null }));
vi.mock('../src/features/homework/components/AssignmentSubmissionsView', () => ({ AssignmentSubmissionsView: () => null }));

import TestBankBrowser from '../src/features/quiz-editor/components/TestBankBrowser';
import { SubjectPracticeGrid } from '../src/components/HomePage/student-dashboard/SubjectPracticeGrid';
import { GiftShopHeader } from '../src/components/TeacherDashboard/gift-shop-tab/GiftShopHeader';
import StudentAchievementsPage from '../src/features/certificates/StudentAchievementsPage';
import { HomeworkTab } from '../src/features/homework/components/HomeworkTab';
import { ResultsEmptyState } from '../src/components/TeacherDashboard/results-tab/ResultsEmptyState';

const expectModuleIcon = (name: string) => {
  expect(document.querySelector(`[data-module-icon="${name}"]`)).toBeInTheDocument();
};

describe('module icon production integrations', () => {
  beforeEach(() => {
    mocks.fetchTeacherAssignments.mockReset();
    mocks.fetchClasses.mockReset();
  });

  it('uses the question-bank icon only for the empty browser state', () => {
    render(
      <TestBankBrowser
        items={[]}
        selectedIds={new Set()}
        onToggle={vi.fn()}
      />,
    );
    expectModuleIcon('question-bank');
    expect(screen.getByText('Không có câu hỏi phù hợp.')).toBeInTheDocument();
  });

  it('identifies the learning library without changing subject actions', () => {
    render(
      <SubjectPracticeGrid
        availableSubjects={[]}
        comingSoonSubjects={[]}
        isLoading={false}
        errorMessage={null}
        onRetry={vi.fn()}
        onSelectSubject={vi.fn()}
      />,
    );
    expectModuleIcon('learning-resources');
    expect(screen.getByRole('heading', { name: 'Thư viện luyện tập' })).toBeInTheDocument();
  });

  it('uses the store identity while preserving refresh and add actions', () => {
    render(
      <GiftShopHeader
        isAdmin
        isLoading={false}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        onAddGift={vi.fn()}
      />,
    );
    expectModuleIcon('store');
    expect(screen.getByRole('button', { name: 'Làm mới dữ liệu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm quà mới' })).toBeInTheDocument();
  });

  it('uses the achievements identity in both header and empty state without emoji copy', () => {
    render(<StudentAchievementsPage />);
    expect(document.querySelectorAll('[data-module-icon="achievements"]')).toHaveLength(2);
    expect(screen.getByText('Chưa có chứng nhận nào')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('🌟');
  });

  it('uses the task identity without replacing action icons inside assignments', () => {
    render(<HomeworkTab />);
    expectModuleIcon('tasks');
    expect(screen.getByRole('heading', { name: 'Trung tâm Bài tập Tự luận' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Giao bài tập mới' })).toBeInTheDocument();
  });

  it('keeps the reusable results empty state free of emoji', () => {
    render(<ResultsEmptyState />);
    expectModuleIcon('analytics-report');
    expect(document.body.textContent).not.toContain('📊');
  });
});

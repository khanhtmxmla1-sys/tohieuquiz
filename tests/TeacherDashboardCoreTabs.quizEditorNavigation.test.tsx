import React, { Suspense } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/components/TeacherDashboard/teacher-dashboard-shell/dashboardLazyTabs', () => ({
  OverviewTab: () => null,
  ResultsTab: () => null,
  CreateTab: () => null,
  ManageTab: ({ onEdit }: { onEdit: (quiz: any) => void }) => (
    <button type="button" onClick={() => onEdit({ id: 'quiz-123', title: 'Đề Toán' })}>
      Sửa đề thử nghiệm
    </button>
  ),
}));

import { TeacherDashboardCoreTabs } from '../src/components/TeacherDashboard/teacher-dashboard-shell/TeacherDashboardCoreTabs';

const LocationProbe = () => {
  const location = useLocation();
  return <span data-testid="pathname">{location.pathname}</span>;
};

describe('TeacherDashboardCoreTabs quiz editor navigation', () => {
  it('opens every edit action in the canonical unified quiz editor', () => {
    render(
      <MemoryRouter initialEntries={['/teacher/quizzes']}>
        <Suspense fallback={null}>
          <TeacherDashboardCoreTabs
            activeTab="manage"
            resultsLoadState="idle"
            resultsLoadError={null}
            loadTeacherResults={vi.fn(async () => undefined)}
            resultSummary={null}
            summaryLoadState="idle"
            summaryLoadError={null}
            filteredResults={[]}
            quizzes={[]}
            editingQuiz={null}
            setEditingQuiz={vi.fn()}
            setActiveTab={vi.fn()}
            selectTab={vi.fn()}
            openAccessCodeEditor={vi.fn()}
            removeQuiz={vi.fn()}
            createQuiz={vi.fn()}
            modifyQuiz={vi.fn()}
          />
        </Suspense>
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sửa đề thử nghiệm' }));

    expect(screen.getByTestId('pathname')).toHaveTextContent('/teacher/quizzes/quiz-123/edit');
  });
});

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ResultSummaryStatistics } from '../shared/result-summary.contract';
import PerformancePanel from '../src/components/TeacherDashboard/overview/PerformancePanel';
import RecentSubmissionsPanel from '../src/components/TeacherDashboard/overview/RecentSubmissionsPanel';

const statistics: ResultSummaryStatistics = {
  totalResults: 20,
  mean: 7.2,
  median: 7.5,
  stdDev: 1.4,
  min: 2,
  max: 10,
  passRate: 80,
  passCount: 16,
  failCount: 4,
  scoreDistribution: [
    { range: '0-2', count: 1, percentage: 5 },
    { range: '3-4', count: 3, percentage: 15 },
    { range: '5-6', count: 4, percentage: 20 },
    { range: '7-8', count: 7, percentage: 35 },
    { range: '9-10', count: 5, percentage: 25 },
  ],
};

describe('teacher overview lower panels', () => {
  it('renders five data-derived colored bars in the score distribution', () => {
    render(<PerformancePanel statistics={statistics} isLoading={false} />);

    const panel = screen.getByRole('heading', { name: 'Tình hình điểm số' }).closest('section');
    expect(panel?.className).toContain('rounded-2xl');
    expect(panel?.className).toContain('shadow-[var(--dashboard-card-shadow)]');

    const chart = screen.getByRole('img', { name: /Biểu đồ phân bố điểm/i });
    const bars = within(chart).getAllByTestId('score-distribution-bar');
    expect(bars).toHaveLength(5);
    expect(new Set(bars.map((bar) => bar.className)).size).toBe(5);
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('keeps a compact, matching activity panel for recent submissions', () => {
    render(
      <RecentSubmissionsPanel
        submissions={[]}
        isLoading={false}
        hasError={false}
        onViewAll={vi.fn()}
      />,
    );

    const panel = screen.getByRole('heading', { name: 'Bài vừa nộp' }).closest('section');
    expect(panel?.className).toContain('rounded-2xl');
    expect(panel?.className).toContain('shadow-[var(--dashboard-card-shadow)]');
    expect(screen.getByText('Chưa có bài nộp hôm nay')).toBeInTheDocument();
  });
});

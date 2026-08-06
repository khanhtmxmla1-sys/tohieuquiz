import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DashboardKpiGrid, { type DashboardKpi } from '../src/components/TeacherDashboard/overview/DashboardKpiGrid';

const metrics: DashboardKpi[] = [
  { label: 'Đề kiểm tra', value: 12, helper: 'Trong phạm vi lớp', visual: 'test', tone: 'blue' },
  { label: 'Điểm trung bình', value: '7.8', helper: '67% bài đạt', visual: 'results', tone: 'green', resultDependent: true },
  { label: 'Tổng lượt nộp', value: 285, helper: '0 lượt hôm nay', visual: 'assignment', tone: 'violet', resultDependent: true },
  { label: 'Học sinh tham gia', value: 18, helper: 'Theo mã học sinh', visual: 'students', tone: 'orange', resultDependent: true },
  { label: 'Tỷ lệ đạt', value: '67%', helper: 'Từ 5 điểm trở lên', visual: 'results', tone: 'rose', resultDependent: true },
];

describe('DashboardKpiGrid', () => {
  it('renders five compact data cards with custom visuals', () => {
    render(<DashboardKpiGrid metrics={metrics} isLoadingResults={false} />);

    const region = screen.getByRole('region', { name: 'Chỉ số tổng quan' });
    expect(within(region).getAllByRole('article')).toHaveLength(5);
    expect(within(region).getByText('12')).toBeInTheDocument();
    expect(within(region).getByText('67%')).toBeInTheDocument();
    expect(within(region).getAllByRole('presentation', { hidden: true })).toHaveLength(5);
  });

  it('shows shape-matched loading states only for result-dependent metrics', () => {
    render(<DashboardKpiGrid metrics={metrics} isLoadingResults />);

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^Đang tải /)).toHaveLength(4);
  });
});

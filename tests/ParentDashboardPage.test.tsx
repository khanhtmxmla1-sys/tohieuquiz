import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import ParentDashboardPage from '../src/features/parent-portal/pages/ParentDashboardPage';
import { ParentPortalLayout } from '../src/features/parent-portal/layout/ParentPortalLayout';
import { useParentPortalStore } from '../src/features/parent-portal/useParentPortalStore';

const student = { id: 'student-1', fullName: 'Nguyễn Văn An', className: '4A9', avatar: '' };
const dashboard = {
  student,
  period: { weekStart: '2026-07-20', weekEnd: '2026-07-26', previousWeekStart: '2026-07-13' },
  metrics: {
    completedQuizzes: 4, averageScore: 8.2, learningSeconds: 2700,
    correctRate: 82, pendingAssignments: 2, unreadNotifications: 3,
  },
  comparison: { averageScoreDelta: 0.8, completedQuizzesDelta: 1 },
  subjects: [
    { subject: 'Toán', averageScore: 9, correctRate: 90, questionCount: 30, confidence: 'high' as const },
    { subject: 'Tiếng Việt', averageScore: 6.5, correctRate: 62, questionCount: 8, confidence: 'low' as const },
  ],
  recentActivity: [{ id: 'r-1', type: 'quiz' as const, title: 'Phép nhân', subject: 'Toán', score: 8, occurredAt: '2026-07-22T00:00:00.000Z' }],
  recommendations: ['Dành 15 phút ôn thêm môn Tiếng Việt.'],
  importantNotifications: [],
};

const reset = (overrides: Record<string, unknown> = {}) => useParentPortalStore.setState({
  session: student,
  dashboard,
  notifications: [],
  unreadCount: 3,
  isRestoring: false,
  isLoading: false,
  error: null,
  loadDashboard: vi.fn(async () => undefined),
  ...overrides,
});

describe('ParentDashboardPage', () => {
  beforeEach(() => reset());

  it('shows six metrics, progress, weak subject, recommendations and activity', () => {
    render(<MemoryRouter><ParentDashboardPage /></MemoryRouter>);

    expect(screen.getByText('Tổng quan tuần')).toBeInTheDocument();
    expect(screen.getAllByText('Điểm trung bình').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Bài đã hoàn thành')).toBeInTheDocument();
    expect(screen.getByText('Bài tập đang chờ')).toBeInTheDocument();
    expect(screen.getByText('Môn cần cải thiện')).toBeInTheDocument();
    expect(screen.getByText('Cần ôn thêm')).toBeInTheDocument();
    expect(screen.getByText('Dành 15 phút ôn thêm môn Tiếng Việt.')).toBeInTheDocument();
    expect(screen.getByText('Phép nhân')).toBeInTheDocument();
  });

  it('shows a loading skeleton and an error retry state', () => {
    reset({ dashboard: null, isLoading: true });
    const view = render(<MemoryRouter><ParentDashboardPage /></MemoryRouter>);
    expect(screen.getByRole('status', { name: 'Đang tải tổng quan' })).toBeInTheDocument();
    view.unmount();

    const loadDashboard = vi.fn(async () => undefined);
    reset({ dashboard: null, error: 'Không tải được dữ liệu', loadDashboard });
    render(<MemoryRouter><ParentDashboardPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(loadDashboard).toHaveBeenCalled();
  });

  it('caps the notification badge at 99+', () => {
    reset({ unreadCount: 120 });
    render(<MemoryRouter><ParentPortalLayout><div>content</div></ParentPortalLayout></MemoryRouter>);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AsyncState } from '../src/components/common/AsyncState';
import { OfflineBanner } from '../src/components/common/OfflineBanner';
import { ResultsActions } from '../src/components/TeacherDashboard/results-tab/ResultsActions';
import { ClassListView } from '../src/features/class-management/views/ClassListView';
import ParentDashboardPage from '../src/features/parent-portal/pages/ParentDashboardPage';
import { useParentPortalStore } from '../src/features/parent-portal/useParentPortalStore';
import * as parentPortalService from '../src/features/parent-portal/parentPortalService';
import { useClassStore } from '../src/stores/useClassStore';
import * as classroomService from '../src/services/classroomService';
import { AssignedWorkSection } from '../src/components/HomePage/student-dashboard/AssignedWorkSection';
import { useOnlineStatus } from '../src/hooks/useOnlineStatus';
import { useResults } from '../src/hooks/useResults';
import { ApiError } from '../src/services/api/errors';

const setOnline = (value: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
};

const parentDashboard = {
  student: { id: 'student-1', fullName: 'Nguyễn Văn An', className: '4A9', avatar: '' },
  period: { weekStart: '2026-07-20', weekEnd: '2026-07-26', previousWeekStart: '2026-07-13' },
  metrics: {
    completedQuizzes: 2,
    averageScore: 8,
    learningSeconds: 1200,
    correctRate: 80,
    pendingAssignments: 1,
    unreadNotifications: 0,
  },
  comparison: { averageScoreDelta: 0, completedQuizzesDelta: 0 },
  subjects: [],
  recentActivity: [],
  recommendations: ['Duy trì 15 phút ôn tập mỗi ngày.'],
  importantNotifications: [],
};

describe('standardized async and offline states', () => {
  beforeEach(() => {
    setOnline(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tracks browser online and offline events', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(true);

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOnline).toBe(false);

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOnline).toBe(true);
  });

  it('announces offline mode without rendering while online', () => {
    const view = render(<OfflineBanner isOnline />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    view.rerender(<OfflineBanner isOnline={false} />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveAttribute('aria-live', 'polite');
    expect(banner).toHaveTextContent('Bạn đang ngoại tuyến');
  });

  it('keeps cached content visible with a stale timestamp after a retryable failure', () => {
    const retry = vi.fn();
    render(
      <AsyncState
        error="Không thể kết nối mạng."
        hasData
        isOffline
        staleAt={new Date('2026-07-28T08:30:00.000Z')}
        onRetry={retry}
        retryDisabled
      >
        <div>Dữ liệu đã tải</div>
      </AsyncState>,
    );

    expect(screen.getByText('Dữ liệu đã tải')).toBeInTheDocument();
    expect(screen.getByText(/Dữ liệu gần nhất/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeDisabled();
  });

  it('clears cached classes and parent data after authorization failures', async () => {
    vi.spyOn(classroomService, 'getClasses').mockRejectedValueOnce(
      new ApiError('Bạn không có quyền.', 403),
    );
    useClassStore.setState({
      classes: [{ id: 'class-1', name: '4A9' } as never],
      lastUpdatedAt: Date.now(),
      error: null,
      isLoading: false,
    });
    await useClassStore.getState().fetchClasses();
    expect(useClassStore.getState().classes).toEqual([]);
    expect(useClassStore.getState().lastUpdatedAt).toBeNull();

    vi.spyOn(classroomService, 'deleteClass').mockRejectedValueOnce(
      new ApiError('Phiên đăng nhập đã hết hạn.', 401),
    );
    useClassStore.setState({
      classes: [{ id: 'class-2', name: '5A1' } as never],
      lastUpdatedAt: Date.now(),
      error: null,
      isLoading: false,
    });
    await useClassStore.getState().removeClass('class-2');
    expect(useClassStore.getState().classes).toEqual([]);
    expect(useClassStore.getState().lastUpdatedAt).toBeNull();

    vi.spyOn(parentPortalService, 'getDashboard').mockRejectedValueOnce(
      new ApiError('Phiên đăng nhập đã hết hạn.', 401),
    );
    useParentPortalStore.setState({
      session: parentDashboard.student,
      dashboard: parentDashboard,
      dashboardUpdatedAt: Date.now(),
      error: null,
      isLoading: false,
    });
    await useParentPortalStore.getState().loadDashboard();
    expect(useParentPortalStore.getState().dashboard).toBeNull();
    expect(useParentPortalStore.getState().dashboardUpdatedAt).toBeNull();
  });

  it('discards stale result data after an authorization failure', async () => {
    const onRefresh = vi.fn(async () => {
      throw new ApiError('Phiên đăng nhập đã hết hạn.', 401);
    });
    const resultRow = {
      id: 1,
      studentId: 'student-1',
      studentName: 'Nguyễn Văn An',
      studentClass: '4A9',
      quizId: 'quiz-1',
      quizTitle: 'Phép nhân',
      score: 8,
      correctCount: 8,
      totalQuestions: 10,
      timeTaken: 120,
      submittedAt: '2026-07-28T08:00:00.000Z',
      answers: {},
    } as never;
    const { result } = renderHook(
      () => useResults({ results: [resultRow], onRefresh }),
      { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> },
    );

    expect(result.current.filteredResults).toHaveLength(1);
    await act(async () => {
      await result.current.handleRefresh();
    });

    expect(result.current.discardStaleData).toBe(true);
    expect(result.current.filteredResults).toHaveLength(0);
    expect(result.current.lastUpdatedAt).toBeNull();
  });

  it('blocks result refresh and report delivery offline but keeps local export available', () => {
    render(
      <ResultsActions
        isMobile={false}
        isRefreshing={false}
        onRefresh={vi.fn(async () => undefined)}
        onOpenPhieuPanel={vi.fn()}
        phieuDisabled={false}
        onExportCsv={vi.fn()}
        onExportSummary={vi.fn()}
        serverActionsDisabled
      />,
    );

    expect(screen.getByRole('button', { name: 'Làm mới' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tạo và gửi phiếu' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Xuất/ })).not.toBeDisabled();
  });

  it('keeps cached classes browsable but blocks server mutations offline', () => {
    const selectClass = vi.fn();
    render(
      <ClassListView
        classes={[{
          id: 'class-1',
          name: '4A9',
          teacherUsername: 'teacher-1',
          teacherFullName: 'Cô Lan',
          createdAt: '2026-07-20T00:00:00.000Z',
          studentCount: 30,
          assignmentCount: 2,
        } as never]}
        isAdmin
        onSelectClass={selectClass}
        onCreateClick={vi.fn()}
        onTransferClick={vi.fn()}
        onDeleteClick={vi.fn()}
        isLoading={false}
        error={null}
        onRetry={vi.fn()}
        isOnline={false}
        lastUpdatedAt={Date.parse('2026-07-28T08:30:00.000Z')}
      />,
    );

    fireEvent.click(screen.getByText('4A9'));
    expect(selectClass).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Tạo lớp mới' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Chuyển giáo viên phụ trách' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lưu trữ lớp 4A9' })).toBeDisabled();
  });

  it('blocks starting an assigned quiz while offline', () => {
    render(
      <AssignedWorkSection
        quizzes={[{
          id: 'quiz-1',
          title: 'Phép nhân',
          timeLimit: 15,
          _assignmentData: {
            id: 'assignment-1',
            attemptCount: 0,
            maxAttempts: 1,
            deadline: '2099-12-31T23:59:59.000Z',
          },
        } as never]}
        isLoading={false}
        errorMessage={null}
        page={1}
        totalPages={1}
        reviewingAssignmentId={null}
        onRetry={vi.fn()}
        onPageChange={vi.fn()}
        onStartQuiz={vi.fn()}
        onReviewQuiz={vi.fn()}
        isOffline
      />,
    );

    expect(screen.getByRole('button', { name: 'Làm bài ngay' })).toBeDisabled();
    expect(screen.getByText(/cần kết nối mạng/i)).toBeInTheDocument();
  });

  it('shows cached parent data and disables week navigation offline', () => {
    setOnline(false);
    useParentPortalStore.setState({
      session: parentDashboard.student,
      dashboard: parentDashboard,
      dashboardUpdatedAt: Date.parse('2026-07-28T08:30:00.000Z'),
      notifications: [],
      unreadCount: 0,
      isRestoring: false,
      isLoading: false,
      error: null,
      loadDashboard: vi.fn(async () => undefined),
    });

    render(<MemoryRouter><ParentDashboardPage /></MemoryRouter>);

    expect(screen.getByText('Tổng quan tuần')).toBeInTheDocument();
    expect(screen.getByText(/Dữ liệu gần nhất/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tuần trước' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tuần sau' })).toBeDisabled();
  });
});

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TeacherDashboard from '../src/components/TeacherDashboard';
import TeacherDashboardModule from '../src/components/TeacherDashboard/teacher-dashboard-shell';
import { ApiError } from '../src/services/api/errors';
import { useAuthStore } from '../stores/authStore';
import { useQuizStore } from '../stores/quizStore';
import { useClassroomStore } from '../src/stores/useClassroomStore';
import { useTeacherDashboardUIStore } from '../src/stores/useTeacherDashboardUIStore';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  callApi: vi.fn(),
  invalidatePrefix: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock('../src/services/apiAdapter', () => ({ callApi: mocks.callApi }));
vi.mock('../src/services/systemSettingsService', () => ({
  getSystemSettings: vi.fn(async () => ({
    aiAssistantEnabled: true,
    unifiedNotificationsEnabled: true,
  })),
}));
vi.mock('../src/services/CacheService', () => ({
  cacheService: { invalidatePrefix: mocks.invalidatePrefix },
}));
vi.mock('../src/utils/toast', () => ({
  showSuccess: mocks.showSuccess,
  showError: mocks.showError,
}));

vi.mock('../src/components/common', () => ({
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  ErrorBoundary: ({ children }: any) => <>{children}</>,
  Footer: () => <footer>Footer</footer>,
}));
vi.mock('../src/components/common/CurrentAnnouncementBanner', () => ({
  default: () => <div>Announcement banner</div>,
}));
vi.mock('../src/components/common/PasswordChangeDialog', () => ({
  default: ({ onComplete }: any) => (
    <div data-testid="password-gate"><button onClick={() => onComplete()}>Đổi mật khẩu</button></div>
  ),
}));

vi.mock('../src/components/TeacherDashboard/Sidebar', () => ({
  default: ({ activeTab, setActiveTab, onLogout, isMobileOpen }: any) => (
    <aside>
      <span data-testid="sidebar-active">{activeTab}</span>
      <span data-testid="sidebar-mobile-state">{isMobileOpen ? 'open' : 'closed'}</span>
      <button onClick={() => setActiveTab('results')}>Sidebar kết quả</button>
      <button onClick={onLogout}>Sidebar đăng xuất</button>
    </aside>
  ),
}));
vi.mock('../src/components/TeacherDashboard/BottomNavigation', () => ({
  default: ({ setActiveTab, onToggleMenu }: any) => (
    <nav>
      <button onClick={() => setActiveTab('create')}>Bottom tạo đề</button>
      <button onClick={onToggleMenu}>Bottom menu</button>
    </nav>
  ),
}));

vi.mock('../src/components/TeacherDashboard/OverviewTab', () => ({
  default: ({
    resultsLoadState,
    resultsError,
    resultSummary,
    summaryLoadState,
    summaryError,
    onRetryResults,
  }: any) => (
    <div data-testid="overview-tab">
      <span data-testid="overview-results-state">{resultsLoadState}:{resultsError || ''}</span>
      <span data-testid="overview-summary-state">
        {summaryLoadState}:{summaryError || ''}:{resultSummary?.totalSubmissions ?? ''}
      </span>
      <button onClick={onRetryResults}>Thử lại kết quả</button>
    </div>
  ),
}));
vi.mock('../src/components/TeacherDashboard/ResultsTab', () => ({
  default: ({ results }: any) => <div data-testid="results-tab">{results.map((item: any) => item.studentName).join('|')}</div>,
}));
vi.mock('../src/components/TeacherDashboard/ManageTab', () => ({
  default: ({ onEdit, onManageCode, quizzes }: any) => (
    <div data-testid="manage-tab">
      <button onClick={() => onEdit(quizzes[0])}>Sửa đề</button>
      <button onClick={() => onManageCode(quizzes[0].id, quizzes[0].accessCode || '')}>Quản lý mã</button>
    </div>
  ),
}));
vi.mock('../src/components/TeacherDashboard/CreateTab', () => ({
  default: ({ editingQuiz, onSuccess }: any) => (
    <div data-testid="create-tab">
      {editingQuiz?.title || 'Tạo mới'}
      <button onClick={onSuccess}>Lưu đề thành công</button>
    </div>
  ),
}));

const simpleTab = (testId: string) => ({ default: () => <div data-testid={testId}>{testId}</div> });
vi.mock('../src/components/TeacherDashboard/AnnouncementSettings', () => simpleTab('announcements-tab'));
vi.mock('../src/components/TeacherDashboard/ClassManagementTab', () => simpleTab('classes-tab'));
vi.mock('../src/components/TeacherDashboard/AssignmentTab', () => simpleTab('assignments-tab'));
vi.mock('../src/components/TeacherDashboard/TeacherManagementTab', () => simpleTab('teachers-tab'));
vi.mock('../src/components/TeacherDashboard/GiftShopTab', () => simpleTab('gift-shop-tab'));
vi.mock('../src/features/homework/components/HomeworkTab', () => ({ HomeworkTab: () => <div data-testid="homework-tab" /> }));
vi.mock('../src/components/LiveExam/TeacherLiveExamDashboardContainer', () => simpleTab('live-exam-tab'));
vi.mock('../src/features/certificates/TeacherCertificatesPage', () => simpleTab('certificates-tab'));
vi.mock('../src/features/certificates/AdminTemplatesPage', () => simpleTab('admin-templates-tab'));
vi.mock('../src/features/math-audit/MathAuditPage', () => simpleTab('math-audit-tab'));
vi.mock('../src/components/TeacherDashboard/PersonalSettingsTab', () => simpleTab('personal-settings-tab'));

const result = (id: string, studentName: string, studentClass: string) => ({
  id,
  quizId: 'quiz-1',
  quizTitle: 'Phân số',
  studentName,
  studentClass,
  score: 8,
  correctCount: 8,
  totalQuestions: 10,
  timeTaken: 10,
  submittedAt: '2026-07-19T00:00:00.000Z',
  answers: {},
});

const summaryFixture = {
  totalSubmissions: 285,
  uniqueCompletedWorks: 188,
  todaySubmissions: 0,
  uniqueStudents: 18,
  attemptPolicy: 'latest',
  timezone: 'Asia/Ho_Chi_Minh',
  statistics: {
    totalResults: 188,
    mean: 5.76,
    median: 6,
    stdDev: 2.1,
    min: 0,
    max: 10,
    passRate: 67,
    passCount: 125,
    failCount: 63,
    scoreDistribution: [
      { range: '0-2', count: 20, percentage: 10.64 },
      { range: '3-4', count: 43, percentage: 22.87 },
      { range: '5-6', count: 50, percentage: 26.6 },
      { range: '7-8', count: 45, percentage: 23.94 },
      { range: '9-10', count: 30, percentage: 15.96 },
    ],
  },
} as const;

const resetStores = () => {
  const logout = vi.fn();
  const loginSuccess = vi.fn();
  useAuthStore.setState({
    isLoggedIn: true,
    username: 'teacher-a',
    teacherName: 'Cô An',
    teacherClass: '3A',
    isAdmin: false,
    logout,
    loginSuccess,
  } as any);

  useQuizStore.setState({
    quizzes: [{ id: 'quiz-1', title: 'Phân số', accessCode: 'OLD', questions: [] }],
    results: [
      result('1', 'An', '3A'),
      result('2', 'Bình', 'lớp 3-a'),
      result('3', 'Chi', '13A'),
    ],
    error: null,
    quizzesLoadedAt: null,
    loadQuizzes: vi.fn().mockResolvedValue(undefined),
    loadResults: vi.fn().mockResolvedValue(undefined),
    setError: vi.fn((error: string | null) => useQuizStore.setState({ error })),
    setView: vi.fn(),
    removeQuiz: vi.fn(),
    createQuiz: vi.fn(),
    modifyQuiz: vi.fn().mockResolvedValue(undefined),
  } as any);

  useClassroomStore.setState({ logoutStudent: vi.fn() } as any);
  useTeacherDashboardUIStore.setState({ activeTab: 'overview', assignmentComposerDraft: null });
};

describe('TeacherDashboard shell contracts', () => {
  it('keeps the dashboard compatibility export stable', () => {
    expect(TeacherDashboard).toBe(TeacherDashboardModule);
  });

  beforeEach(() => {
    resetStores();
    mocks.navigate.mockReset();
    mocks.callApi.mockReset().mockImplementation(async (action: string) => {
      if (action === 'get_results_summary') return { data: summaryFixture };
      return { data: { mustChangePassword: false } };
    });
    mocks.invalidatePrefix.mockReset();
    mocks.showSuccess.mockReset();
    mocks.showError.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bootstraps teacher data without forcing a duplicate quiz refresh', async () => {
    const view = render(<TeacherDashboard />);

    await waitFor(() => expect(useQuizStore.getState().loadQuizzes).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(useQuizStore.getState().loadResults).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.callApi).toHaveBeenCalledWith('get_results_summary'));
    expect(screen.getByTestId('overview-summary-state')).toHaveTextContent('success::285');

    expect(mocks.invalidatePrefix).not.toHaveBeenCalled();

    view.unmount();

  });

  it('keeps result-list success separate from a summary error and retries both sources', async () => {
    mocks.callApi.mockImplementation(async (action: string) => {
      if (action === 'get_results_summary') throw new Error('Không thể tải số liệu tổng quan.');
      return { data: { mustChangePassword: false } };
    });

    render(<TeacherDashboard />);

    await waitFor(() => expect(screen.getByTestId('overview-results-state')).toHaveTextContent('success:'));
    await waitFor(() => expect(screen.getByTestId('overview-summary-state')).toHaveTextContent(
      'error:Không thể tải số liệu tổng quan.:',
    ));
    expect(useQuizStore.getState().loadResults).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại kết quả' }));
    await waitFor(() => expect(useQuizStore.getState().loadResults).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(
      mocks.callApi.mock.calls.filter(([action]) => action === 'get_results_summary'),
    ).toHaveLength(2));
  });

  it('opens the mobile drawer from the header and removes the fixed bottom navigation', async () => {
    render(<TeacherDashboard />);

    expect(screen.getByTestId('sidebar-mobile-state')).toHaveTextContent('closed');
    fireEvent.click(screen.getByRole('button', { name: 'Mở menu điều hướng' }));
    expect(screen.getByTestId('sidebar-mobile-state')).toHaveTextContent('open');
    expect(screen.queryByRole('button', { name: 'Bottom tạo đề' })).toBeNull();
  });

  it('gives every teacher an inbox while reserving notification management for admins', async () => {
    const view = render(<TeacherDashboard />);
    const inboxButton = await screen.findByRole('button', { name: /^Thông báo/ });
    expect(inboxButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quản lý thông báo' })).toBeNull();

    fireEvent.click(inboxButton);
    expect(screen.getByRole('dialog', { name: 'Thông báo' })).toBeInTheDocument();
    view.unmount();

    useAuthStore.setState({ isAdmin: true } as any);
    render(<TeacherDashboard />);
    expect(await screen.findByRole('button', { name: /^Thông báo/ })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Quản lý thông báo' }));
    await waitFor(() => expect(useTeacherDashboardUIStore.getState().activeTab).toBe('announcements'));
    expect(await screen.findByTestId('announcements-tab')).toBeInTheDocument();
  });

  it('searches dashboard destinations and reports an unknown function', async () => {
    render(<TeacherDashboard />);
    const search = screen.getByPlaceholderText('Tìm chức năng...');

    fireEvent.change(search, { target: { value: 'điểm' } });
    fireEvent.submit(search.closest('form') as HTMLFormElement);
    expect(await screen.findByTestId('results-tab')).toBeTruthy();
    expect(useTeacherDashboardUIStore.getState().activeTab).toBe('results');

    fireEvent.change(search, { target: { value: 'không tồn tại' } });
    fireEvent.submit(search.closest('form') as HTMLFormElement);
    expect(mocks.showError).toHaveBeenCalledWith('Không tìm thấy chức năng phù hợp.');
  });

  it('passes only the teacher exact normalized class results to the results tab', async () => {
    useTeacherDashboardUIStore.setState({ activeTab: 'results' });
    render(<TeacherDashboard />);

    const content = await screen.findByTestId('results-tab');
    expect(content).toHaveTextContent('An');
    expect(content).toHaveTextContent('Bình');
    expect(content).not.toHaveTextContent('Chi');
  });

  it('guards admin-only and disabled gift-shop tabs by returning to overview', async () => {
    useTeacherDashboardUIStore.setState({ activeTab: 'announcements' });
    render(<TeacherDashboard />);
    await waitFor(() => expect(useTeacherDashboardUIStore.getState().activeTab).toBe('overview'));
    expect(await screen.findByTestId('overview-tab')).toBeTruthy();

    useTeacherDashboardUIStore.getState().setActiveTab('gift-shop');
    await waitFor(() => expect(useTeacherDashboardUIStore.getState().activeTab).toBe('overview'));
  });

  it('clears dashboard state and related sessions on logout', async () => {
    useTeacherDashboardUIStore.setState({
      activeTab: 'results',
      assignmentComposerDraft: { classId: 'class-1' } as any,
    });
    render(<TeacherDashboard />);

    fireEvent.click(screen.getByRole('button', { name: 'Sidebar đăng xuất' }));

    expect(useTeacherDashboardUIStore.getState().activeTab).toBe('overview');
    expect(useTeacherDashboardUIStore.getState().assignmentComposerDraft).toBeNull();
    expect(useAuthStore.getState().logout).toHaveBeenCalledTimes(1);
    expect(useClassroomStore.getState().logoutStudent).toHaveBeenCalledTimes(1);
    expect(useQuizStore.getState().setView).toHaveBeenCalledWith('home');
  });

  it('logs out and redirects when the account profile returns 401', async () => {
    mocks.callApi.mockRejectedValue(new ApiError('Unauthorized', 401));
    render(<TeacherDashboard />);

    await waitFor(() => expect(useAuthStore.getState().logout).toHaveBeenCalledTimes(1));
    expect(mocks.showError).toHaveBeenCalledWith('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    expect(mocks.navigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('updates a quiz access code in uppercase and keeps the current quiz identity', async () => {
    useTeacherDashboardUIStore.setState({ activeTab: 'manage' });
    render(<TeacherDashboard />);

    fireEvent.click(await screen.findByRole('button', { name: 'Quản lý mã' }));
    fireEvent.change(screen.getByPlaceholderText('Nhập mã mới (VD: TOAN3A)'), { target: { value: 'new1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mã' }));

    await waitFor(() => expect(useQuizStore.getState().modifyQuiz).toHaveBeenCalledWith(expect.objectContaining({
      id: 'quiz-1',
      accessCode: 'NEW1',
      requireCode: true,
    })));
    expect(mocks.showSuccess).toHaveBeenCalledWith('Cap nhat ma lam bai thanh cong!');
  });
});

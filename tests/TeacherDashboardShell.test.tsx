import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TeacherDashboard from '../src/components/TeacherDashboard';
import TeacherDashboardModule from '../src/components/TeacherDashboard/teacher-dashboard-shell';
import { ApiError } from '../src/services/api/errors';
import { useAuthStore } from '../stores/authStore';
import { useQuizStore } from '../stores/quizStore';
import { useClassroomStore } from '../src/stores/useClassroomStore';
import { useTeacherDashboardUIStore } from '../src/stores/useTeacherDashboardUIStore';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  callApi: vi.fn(),
  invalidatePrefix: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  location: { pathname: '/teacher/overview', search: '', key: 'test' },
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => mocks.location,
  };
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
  default: ({
    activeTab,
    setActiveTab,
    onLogout,
    isMobileOpen,
    manualQuizWorkspaceEnabled,
    onCreateQuizWithAi,
    onCreateQuizManually,
  }: any) => (
    <aside>
      <span data-testid="sidebar-active">{activeTab}</span>
      <span data-testid="sidebar-mobile-state">{isMobileOpen ? 'open' : 'closed'}</span>
      <button onClick={() => setActiveTab('results')}>Sidebar kết quả</button>
      {manualQuizWorkspaceEnabled ? (
        <>
          <button onClick={onCreateQuizWithAi}>Tạo đề bằng AI</button>
          <button onClick={onCreateQuizManually}>Soạn đề thủ công</button>
        </>
      ) : (
        <button onClick={() => setActiveTab('create')}>Tạo đề mới</button>
      )}
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
    onSelectTab,
    onCreateQuizWithAi,
    onCreateQuizManually,
  }: any) => (
    <div data-testid="overview-tab">
      <span data-testid="overview-results-state">{resultsLoadState}:{resultsError || ''}</span>
      <span data-testid="overview-summary-state">
        {summaryLoadState}:{summaryError || ''}:{resultSummary?.totalSubmissions ?? ''}
      </span>
      <button onClick={onRetryResults}>Thử lại kết quả</button>
      <button onClick={onCreateQuizWithAi}>Tổng quan tạo đề bằng AI</button>
      <button onClick={onCreateQuizManually}>Tổng quan soạn đề thủ công</button>
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

const click = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.click(element);
  });
};
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
vi.mock('../src/features/feature-rollout/FeatureRolloutPage', () => simpleTab('feature-rollout-tab'));
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
    vi.unstubAllEnvs();
    useManualQuizWorkspaceStore.getState().reset();
    resetStores();
    mocks.navigate.mockReset();
    mocks.callApi.mockReset().mockImplementation(async (action: string) => {
      if (action === 'get_results_summary') return { data: summaryFixture };
      return { data: { mustChangePassword: false } };
    });
    mocks.invalidatePrefix.mockReset();
    mocks.showSuccess.mockReset();
    mocks.showError.mockReset();
    mocks.location.pathname = '/teacher/overview';
    mocks.location.search = '';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    useManualQuizWorkspaceStore.getState().reset();
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

  it('derives the active tab from the URL and navigates sidebar actions through history', async () => {
    mocks.location.pathname = '/teacher/classes';
    useTeacherDashboardUIStore.setState({ activeTab: 'overview' });

    render(<TeacherDashboard />);

    expect(await screen.findByTestId('classes-tab')).toBeInTheDocument();
    await waitFor(() => expect(useTeacherDashboardUIStore.getState().activeTab).toBe('classes'));

    await click(screen.getByRole('button', { name: 'Sidebar kết quả' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/teacher/results');
  });

  it('navigates AI creation actions through the canonical URL', async () => {
    render(<TeacherDashboard />);

    await click(await screen.findByRole('button', { name: 'Tổng quan tạo đề bằng AI' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/teacher/quizzes?mode=create');
    expect(mocks.navigate).not.toHaveBeenCalledWith('/teacher/quizzes/ai/new');
  });

  it('resets stale workspace state and carries the teacher class into a new manual quiz', async () => {
    useAuthStore.setState({ teacherClass: '4A' } as any);
    useManualQuizWorkspaceStore.getState().initializeFromSeed({
      title: 'Đề cũ',
      classLevel: '3A',
      category: 'toan',
      timeLimit: 15,
      tags: [],
      requireCode: false,
      showOnHome: true,
    }, 'teacher-a');

    render(<TeacherDashboard />);
    await click(await screen.findByRole('button', { name: 'Tổng quan soạn đề thủ công' }));

    expect(useManualQuizWorkspaceStore.getState().envelope).toBeNull();
    expect(mocks.navigate).toHaveBeenCalledWith('/teacher/quizzes/new', {
      state: expect.objectContaining({
        workspaceStartedAt: expect.any(String),
        manualQuizSeed: expect.objectContaining({
          title: 'Đề kiểm tra mới',
          classLevel: '4A',
          category: 'toan',
          timeLimit: 15,
        }),
      }),
    });
  });

  it('uses the safe class fallback for accounts without an assigned class', async () => {
    useAuthStore.setState({ isAdmin: true, teacherClass: null } as any);
    render(<TeacherDashboard />);

    await click(await screen.findByRole('button', { name: 'Tổng quan soạn đề thủ công' }));

    expect(mocks.navigate).toHaveBeenCalledWith('/teacher/quizzes/new', {
      state: expect.objectContaining({
        manualQuizSeed: expect.objectContaining({ classLevel: '3' }),
      }),
    });
  });

  it('opens the selected quiz in the canonical unified editor route', async () => {
    mocks.location.pathname = '/teacher/quizzes';
    mocks.location.search = '';
    render(<TeacherDashboard />);

    await click(await screen.findByRole('button', { name: 'Sửa đề' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/teacher/quizzes/quiz-1/edit');
  });

  it('uses the create query mode and returns to quiz management after saving', async () => {
    mocks.location.pathname = '/teacher/quizzes';
    mocks.location.search = '?mode=create';

    render(<TeacherDashboard />);

    expect(await screen.findByTestId('create-tab')).toBeInTheDocument();
    await click(screen.getByRole('button', { name: 'Lưu đề thành công' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/teacher/quizzes');
  });

  it('opens the mobile drawer from the header and keeps the fixed bottom navigation', async () => {
    render(<TeacherDashboard />);

    expect(screen.getByTestId('sidebar-mobile-state')).toHaveTextContent('closed');
    expect(screen.getByRole('navigation', { name: 'Điều hướng nhanh' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tổng quan' })).toHaveAttribute('aria-current', 'page');

    await click(screen.getByRole('button', { name: 'Mở menu điều hướng' }));
    expect(screen.getByTestId('sidebar-mobile-state')).toHaveTextContent('open');

    await click(screen.getByRole('button', { name: 'Đề thi' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/teacher/quizzes');
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
    expect(mocks.navigate).toHaveBeenCalledWith('/teacher/announcements');
  });

  it('renders feature rollout only for admins and navigates through its canonical URL', async () => {
    useAuthStore.setState({ isAdmin: true } as any);
    mocks.location.pathname = '/teacher/feature-rollout';

    render(<TeacherDashboard />);

    expect(await screen.findByTestId('feature-rollout-tab')).toBeInTheDocument();
    await click(screen.getByRole('button', { name: /Mở menu tài khoản của Cô An/i }));
    const administration = screen.getByRole('menuitem', { name: 'Quản trị hệ thống' });
    if (administration.getAttribute('aria-expanded') !== 'true') await click(administration);
    await click(screen.getByRole('menuitem', { name: 'Tính năng thử nghiệm' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/teacher/feature-rollout');
  });

  it('navigates teachers to personal settings from the account menu', async () => {
    render(<TeacherDashboard />);

    await click(screen.getByRole('button', { name: /Mở menu tài khoản của Cô An/i }));

    expect(screen.queryByRole('menuitem', { name: 'Quản trị hệ thống' })).toBeNull();
    await click(screen.getByRole('menuitem', { name: 'Cài đặt cá nhân' }));

    expect(mocks.navigate).toHaveBeenCalledWith('/teacher/settings');
  });

  it('navigates admins to system pages from the account menu', async () => {
    useAuthStore.setState({ isAdmin: true } as any);
    render(<TeacherDashboard />);

    await click(screen.getByRole('button', { name: /Mở menu tài khoản của Cô An/i }));
    const administration = screen.getByRole('menuitem', { name: 'Quản trị hệ thống' });
    expect(administration).toHaveAttribute('aria-expanded', 'false');

    await click(administration);
    await click(screen.getByRole('menuitem', { name: 'Trạng thái hệ thống' }));

    expect(mocks.navigate).toHaveBeenCalledWith('/teacher/operations');
  });
  it('searches dashboard destinations and reports an unknown function', async () => {
    render(<TeacherDashboard />);
    const search = screen.getByPlaceholderText('Tìm chức năng...');

    await act(async () => {
      fireEvent.change(search, { target: { value: 'điểm' } });
      fireEvent.submit(search.closest('form') as HTMLFormElement);
    });
    expect(mocks.navigate).toHaveBeenCalledWith('/teacher/results');

    await act(async () => {
      fireEvent.change(search, { target: { value: 'không tồn tại' } });
      fireEvent.submit(search.closest('form') as HTMLFormElement);
    });
    expect(mocks.showError).toHaveBeenCalledWith('Không tìm thấy chức năng phù hợp.');
  });

  it('passes only the teacher exact normalized class results to the results tab', async () => {
    mocks.location.pathname = '/teacher/results';
    render(<TeacherDashboard />);

    const content = await screen.findByTestId('results-tab');
    expect(content).toHaveTextContent('An');
    expect(content).toHaveTextContent('Bình');
    expect(content).not.toHaveTextContent('Chi');
  });

  it('guards admin-only and disabled gift-shop tabs by returning to overview', async () => {
    mocks.location.pathname = '/teacher/announcements';
    render(<TeacherDashboard />);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/teacher/overview', { replace: true }));

    mocks.navigate.mockReset();
    mocks.location.pathname = '/teacher/gift-shop';
    render(<TeacherDashboard />);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/teacher/overview', { replace: true }));
  });

  it('clears dashboard state and related sessions on logout', async () => {
    useTeacherDashboardUIStore.setState({
      activeTab: 'results',
      assignmentComposerDraft: { classId: 'class-1' } as any,
    });
    render(<TeacherDashboard />);

    await click(screen.getByRole('button', { name: 'Sidebar đăng xuất' }));

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
    mocks.location.pathname = '/teacher/quizzes';
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

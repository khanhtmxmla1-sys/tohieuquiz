import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AssignedWorkSection,
  AssignedWorkSkeleton,
  DashboardEmptyState,
  DashboardSectionError,
  LearningProgressPanel,
  RewardSidebar,
  StudentDashboardHeader,
  StudentDashboardHero,
  SubjectPracticeGrid,
  WeeklyQuestsPanel,
} from '../src/components/HomePage/student-dashboard';
import { BadgeGallery } from '../src/components/gamification/BadgeGallery';
import AvatarSelectorModal from '../src/components/common/AvatarSelectorModal';
import { StudentHomeworkCard } from '../src/features/homework/components/StudentHomeworkCard';
import { StudentHomeworkSection } from '../src/features/homework/components/StudentHomeworkSection';

const classroomModalStoreMock = vi.hoisted(() => ({
  studentSession: {
    studentId: 'student-1',
    username: 'student-one',
  },
  updateAvatar: vi.fn(async () => true),
}));

vi.mock('../src/stores/useClassroomStore', () => ({
  useClassroomStore: (selector?: (state: typeof classroomModalStoreMock) => unknown) =>
    selector ? selector(classroomModalStoreMock) : classroomModalStoreMock,
}));

const homeworkStoreMock = vi.hoisted(() => ({
  assignments: [] as any[],
  submissions: [] as any[],
  isLoading: false,
  error: null as string | null,
  fetchClassAssignments: vi.fn(async () => undefined),
  fetchStudentSubmissions: vi.fn(async () => undefined),
}));

vi.mock('../src/features/homework/stores/useHomeworkStore', () => ({
  useHomeworkStore: () => homeworkStoreMock,
}));

beforeEach(() => {
  homeworkStoreMock.assignments = [];
  homeworkStoreMock.submissions = [];
  homeworkStoreMock.isLoading = false;
  homeworkStoreMock.error = null;
  homeworkStoreMock.fetchClassAssignments.mockClear();
  homeworkStoreMock.fetchStudentSubmissions.mockClear();
});

const renderHeader = () =>
  render(
    <StudentDashboardHeader
      studentName="Nguyễn Minh An"
      className="5A"
      avatarUrl="/avatar1.png"
      level={4}
      coins={250}
      activeSection="dashboard"
      giftShopEnabled
      studentId="student-1"
      onSelectSection={vi.fn()}
      onOpenAssignment={vi.fn()}
      onOpenResultReport={vi.fn()}
      onOpenGiftShop={vi.fn()}
      onOpenLiveExam={vi.fn()}
      onOpenAvatar={vi.fn()}
      onOpenChangePassword={vi.fn()}
      onLogout={vi.fn()}
    />,
  );

const assignmentQuiz = ({
  id,
  attemptCount = 0,
  maxAttempts = 1,
  status = 'OPEN',
}: {
  id: string;
  attemptCount?: number;
  maxAttempts?: number;
  status?: 'OPEN' | 'CLOSED';
}) =>
  ({
    id,
    title: `Bài ${id}`,
    questions: [],
    timeLimit: 20,
    _assignmentData: {
      id: `assignment-${id}`,
      quizId: id,
      classId: 'class-1',
      deadline: '2099-01-01T00:00:00.000Z',
      maxAttempts,
      attemptCount,
      status,
      createdAt: '2026-07-18T00:00:00.000Z',
    },
  }) as any;

const renderHero = (hasReadyAssignment: boolean, onPrimaryAction = vi.fn()) =>
  render(
    <StudentDashboardHero
      firstName="An"
      hasReadyAssignment={hasReadyAssignment}
      attendanceClaimed={false}
      attendanceLabel="Điểm danh nhận thưởng"
      attendanceAvailable
      onPrimaryAction={onPrimaryAction}
      onAttendance={vi.fn()}
    />,
  );

const assignedWorkProps = {
  isLoading: false,
  errorMessage: null,
  page: 1,
  totalPages: 1,
  onRetry: vi.fn(),
  onPageChange: vi.fn(),
  onStartQuiz: vi.fn(),
  onReviewQuiz: vi.fn(),
};

describe('dashboard state primitives', () => {
  it('renders three assignment-shaped skeleton cards by default', () => {
    render(<AssignedWorkSkeleton />);

    expect(screen.getAllByTestId('assigned-work-skeleton')).toHaveLength(3);
    expect(screen.getByLabelText('Đang tải bài cần làm')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders a compact empty state', () => {
    render(
      <DashboardEmptyState
        title="Em đã hoàn thành tất cả nhiệm vụ hiện tại."
        description="Em có thể luyện thêm một môn học."
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Em đã hoàn thành tất cả nhiệm vụ hiện tại.',
    );
  });

  it('calls retry from a local section error', () => {
    const retry = vi.fn();
    render(<DashboardSectionError message="Chưa tải được dữ liệu." onRetry={retry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe('student dashboard header', () => {
  it('opens and closes the account menu by click and Escape', () => {
    renderHeader();
    const trigger = screen.getByRole('button', { name: /Mở menu tài khoản/i });

    fireEvent.click(trigger);
    expect(screen.getByRole('menu', { name: 'Tài khoản học sinh' })).toBeVisible();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: 'Tài khoản học sinh' })).not.toBeInTheDocument();
  });

  it('exposes all header actions as native buttons with 44px targets', () => {
    renderHeader();

    expect(screen.getByRole('button', { name: /Thi trực tiếp/i }).className).toContain(
      'min-h-11',
    );
    expect(screen.getByRole('button', { name: /Mở menu tài khoản/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});

describe('student dashboard hero and assigned work', () => {
  it('renders the hero h1 and switches the primary CTA by assignment availability', () => {
    const primaryAction = vi.fn();
    const { rerender } = renderHero(true, primaryAction);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Chào An.');
    fireEvent.click(screen.getByRole('button', { name: 'Làm bài được giao' }));
    expect(primaryAction).toHaveBeenCalledTimes(1);

    rerender(
      <StudentDashboardHero
        firstName="An"
        hasReadyAssignment={false}
        attendanceClaimed={false}
        attendanceLabel="Điểm danh nhận thưởng"
        attendanceAvailable
        onPrimaryAction={primaryAction}
        onAttendance={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Luyện tập ngay' })).toBeVisible();
  });

  it('uses a native secondary attendance button without pulse animation', () => {
    renderHero(true);

    const attendance = screen.getByRole('button', { name: 'Điểm danh nhận thưởng' });
    expect(attendance.className).not.toContain('animate-pulse');
    expect(attendance.className).toContain('min-h-11');
  });

  it('renders assignment loading and the approved empty copy', () => {
    const { rerender } = render(<AssignedWorkSection {...assignedWorkProps} quizzes={[]} isLoading />);
    expect(screen.getAllByTestId('assigned-work-skeleton')).toHaveLength(3);

    rerender(<AssignedWorkSection {...assignedWorkProps} quizzes={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Em đã hoàn thành tất cả nhiệm vụ hiện tại.',
    );
  });

  it('starts ready work and opens completed work for review', () => {
    const onStartQuiz = vi.fn();
    const onReviewQuiz = vi.fn();
    const ready = assignmentQuiz({ id: 'ready' });
    const completed = assignmentQuiz({ id: 'completed', attemptCount: 1 });
    const closed = assignmentQuiz({ id: 'closed', status: 'CLOSED' });

    render(
      <AssignedWorkSection
        {...assignedWorkProps}
        quizzes={[ready, completed, closed]}
        onStartQuiz={onStartQuiz}
        onReviewQuiz={onReviewQuiz}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Làm bài ngay' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xem kết quả' }));
    expect(screen.getByRole('button', { name: 'Đã đóng' })).toBeDisabled();
    expect(onStartQuiz).toHaveBeenCalledTimes(1);
    expect(onStartQuiz).toHaveBeenCalledWith(ready);
    expect(onReviewQuiz).toHaveBeenCalledTimes(1);
    expect(onReviewQuiz).toHaveBeenCalledWith(completed);
  });
});

const gameLoopDashboard = {
  todayDateKey: '2026-07-18',
  wallet: { coins: 100 },
  missions: [
    {
      id: 'daily_questions',
      title: 'Làm 10 câu hỏi',
      description: 'Hoàn thành câu hỏi hôm nay.',
      target: 10,
      progress: 4,
      completed: false,
      claimed: false,
      rewardCoins: 20,
      unit: 'câu',
    },
  ],
  bonusChest: { available: false, claimed: false },
  weekly: { completedDays: 2, targetDays: 5 },
  profile: { dailyStreak: 3, hintTokens: 0, streakShields: 0, collection: [] },
  achievements: [],
  recentRewards: [],
} as any;

const quest = (
  id: string,
  overrides: Partial<{
    progress: number;
    target: number;
    completed: boolean;
    claimed: boolean;
  }> = {},
) => ({
  id,
  title: `Quest ${id}`,
  description: 'Hoàn thành thử thách tuần.',
  icon: '📘',
  progress: 2,
  target: 4,
  completed: false,
  claimed: false,
  reward: { coins: 20, exp: 10, items: [], itemCount: 0 },
  ...overrides,
});

describe('learning progress and weekly quest panels', () => {
  it('exposes expansion state and accessible mission progress values', () => {
    render(
      <LearningProgressPanel
        dashboard={gameLoopDashboard}
        isLoading={false}
        expanded
        onToggle={vi.fn()}
        onRetry={vi.fn()}
        onClaimMission={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Tiến độ học tập/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('progressbar', { name: 'Tiến độ Làm 10 câu hỏi' })).toHaveAttribute(
      'aria-valuenow',
      '4',
    );
    expect(screen.getByRole('progressbar', { name: 'Tiến độ Làm 10 câu hỏi' })).toHaveAttribute(
      'aria-valuemin',
      '0',
    );
    expect(screen.getByRole('progressbar', { name: 'Tiến độ Làm 10 câu hỏi' })).toHaveAttribute(
      'aria-valuemax',
      '10',
    );
  });

  it('keeps loading and retry feedback local to the progress panel', () => {
    const retry = vi.fn();
    const { rerender } = render(
      <LearningProgressPanel
        dashboard={null}
        isLoading
        expanded
        onToggle={vi.fn()}
        onRetry={retry}
        onClaimMission={vi.fn()}
      />,
    );

    expect(screen.getByTestId('learning-progress-panel')).toContainElement(
      screen.getByLabelText('Đang tải tiến độ học tập'),
    );

    rerender(
      <LearningProgressPanel
        dashboard={null}
        isLoading={false}
        errorMessage="Không thể tải hành trình"
        expanded
        onToggle={vi.fn()}
        onRetry={retry}
        onClaimMission={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('uses the approved empty weekly copy', () => {
    render(
      <WeeklyQuestsPanel
        quests={[]}
        isLoading={false}
        onRetry={vi.fn()}
        onClaim={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Nhiệm vụ mới sẽ sớm xuất hiện.');
  });

  it('renders all weekly claim states as text', () => {
    render(
      <WeeklyQuestsPanel
        quests={[
          quest('claiming', { completed: true }),
          quest('claimed', { completed: true, claimed: true }),
          quest('ready', { completed: true }),
          quest('pending'),
        ]}
        isLoading={false}
        claimingQuestId="claiming"
        onRetry={vi.fn()}
        onClaim={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Đang nhận...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Đã nhận' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Nhận ngay' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Chưa xong' })).toBeDisabled();
  });

  it('animates weekly progress with scaleX instead of width', () => {
    render(
      <WeeklyQuestsPanel
        quests={[quest('ready')]}
        isLoading={false}
        onRetry={vi.fn()}
        onClaim={vi.fn()}
      />,
    );

    const fill = screen.getByTestId('weekly-quest-progress-fill-ready');
    expect(fill).toHaveStyle({ transform: 'scaleX(0.5)' });
    expect(fill).not.toHaveStyle({ width: '50%' });
    expect(fill.className).not.toContain('transition-all');
  });
});
const rewardSidebarProps = {
  giftShopEnabled: false,
  isProcessing: false,
  onOpenChest: vi.fn(),
  onOpenGiftShop: vi.fn(),
  onOpenBadges: vi.fn(),
};

const dashboardWithChest = (available: boolean, claimed: boolean) => ({
  ...gameLoopDashboard,
  bonusChest: { available, claimed },
});

describe('reward sidebar and badge gallery', () => {
  it('communicates every chest state with text', () => {
    const { rerender } = render(
      <RewardSidebar {...rewardSidebarProps} dashboard={dashboardWithChest(false, false)} />,
    );
    expect(screen.getByRole('button', { name: 'Chưa mở khóa' })).toBeDisabled();

    rerender(
      <RewardSidebar {...rewardSidebarProps} dashboard={dashboardWithChest(true, false)} />,
    );
    expect(screen.getByRole('button', { name: 'Mở rương thưởng' })).toBeEnabled();

    rerender(
      <RewardSidebar
        {...rewardSidebarProps}
        dashboard={dashboardWithChest(true, false)}
        isProcessing
      />,
    );
    expect(screen.getByRole('button', { name: 'Đang mở...' })).toBeDisabled();

    rerender(
      <RewardSidebar {...rewardSidebarProps} dashboard={dashboardWithChest(false, true)} />,
    );
    expect(screen.getByRole('button', { name: 'Đã mở rương' })).toBeDisabled();
  });

  it('labels weekly rhythm and hides the gift shop when disabled', () => {
    render(<RewardSidebar {...rewardSidebarProps} dashboard={gameLoopDashboard} />);

    expect(screen.getByRole('progressbar', { name: 'Nhịp học tuần này' })).toHaveAttribute(
      'aria-valuenow',
      '2',
    );
    expect(screen.queryByRole('button', { name: 'Xem mục tiêu quà thật' })).not.toBeInTheDocument();
    expect(screen.getByText('Hoàn thành bài đầu tiên để mở huy hiệu đầu tiên nhé.')).toBeVisible();
  });

  it('adds accessible gallery controls and transform progress', () => {
    render(<BadgeGallery isOpen onClose={vi.fn()} achievements={[]} />);

    expect(screen.getByRole('dialog', { name: 'Bộ sưu tập huy hiệu' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Đóng bộ sưu tập huy hiệu' })).toBeVisible();
    const fill = screen.getByTestId('badge-gallery-progress-fill');
    expect(fill).toHaveStyle({ transform: 'scaleX(0)' });
    expect(fill).not.toHaveStyle({ width: '0%' });
    expect(screen.getByRole('dialog')).toHaveAttribute('data-motion-duration-ms', '200');
  });
});
const homeworkAssignment = {
  id: 'homework-1',
  title: 'Viết đoạn văn về gia đình',
  description: 'Viết từ 5 đến 7 câu.',
  subject: 'Tiếng Việt',
  deadline: '2099-07-20T00:00:00.000Z',
  class_id: 'class-1',
  teacher_id: 'teacher-1',
  file_url: '',
  ai_content: '',
  created_at: '2026-07-18T00:00:00.000Z',
  status: 'OPEN',
  effectiveStatus: 'OPEN',
} as any;

const practiceSubjects = [
  {
    id: 'toan',
    title: 'Toán học',
    description: 'Rèn luyện tư duy và tính toán',
    icon: 'calculator',
    topicCount: 8,
    questionCount: 126,
    status: 'available',
    accentClass: 'text-blue-700',
    iconSurfaceClass: 'bg-blue-100',
  },
  {
    id: 'tieng-viet',
    title: 'Tiếng Việt',
    description: 'Vun đắp ngôn ngữ tiếng mẹ đẻ',
    icon: 'book-open',
    topicCount: 4,
    questionCount: 62,
    status: 'available',
    accentClass: 'text-amber-700',
    iconSurfaceClass: 'bg-amber-100',
  },
] as const;

const comingSoonSubjects = [
  {
    id: 'tieng-anh',
    title: 'Tiếng Anh',
    description: 'Mở rộng giao tiếp quốc tế',
    icon: 'languages',
    topicCount: 0,
    questionCount: 0,
    status: 'coming-soon',
    accentClass: 'text-indigo-700',
    iconSurfaceClass: 'bg-indigo-100',
  },
] as const;

const practiceGridProps = {
  availableSubjects: [...practiceSubjects],
  comingSoonSubjects: [...comingSoonSubjects],
  isLoading: false,
  errorMessage: null,
  onRetry: vi.fn(),
  onSelectSubject: vi.fn(),
};

describe('semantic practice and homework cards', () => {
  it('renders available subjects as responsive native buttons', () => {
    const onSelectSubject = vi.fn();
    render(<SubjectPracticeGrid {...practiceGridProps} onSelectSubject={onSelectSubject} />);

    const grid = screen.getByTestId('subject-practice-grid');
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('sm:grid-cols-2');
    expect(grid.className).toContain('lg:grid-cols-3');
    expect(grid.className).not.toContain('2xl:grid-cols-4');
    expect(screen.getByText('8 chuyên đề · 126 câu hỏi')).toBeVisible();
    expect(screen.queryByText('calculate')).not.toBeInTheDocument();

    const mathButton = screen.getByRole('button', { name: /Toán học/i });
    expect(mathButton).toHaveAttribute('type', 'button');
    fireEvent.click(mathButton);
    expect(onSelectSubject).toHaveBeenCalledWith('toan');
  });

  it('renders coming-soon subjects as non-actionable items', () => {
    render(<SubjectPracticeGrid {...practiceGridProps} />);

    expect(screen.getByText('Đang chuẩn bị')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Tiếng Anh/i })).not.toBeInTheDocument();
  });

  it('keeps loading, retry, and empty feedback local to the practice section', () => {
    const retry = vi.fn();
    const { rerender } = render(
      <SubjectPracticeGrid {...practiceGridProps} isLoading onRetry={retry} />,
    );
    expect(screen.getAllByTestId('practice-card-skeleton')).toHaveLength(3);
    expect(screen.getByLabelText('Đang tải thư viện luyện tập')).toHaveAttribute('aria-busy', 'true');

    rerender(
      <SubjectPracticeGrid
        {...practiceGridProps}
        isLoading={false}
        errorMessage="Chưa tải được thư viện luyện tập."
        onRetry={retry}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(retry).toHaveBeenCalledTimes(1);

    rerender(
      <SubjectPracticeGrid
        {...practiceGridProps}
        availableSubjects={[]}
        comingSoonSubjects={[]}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Hiện chưa có môn luyện tập nào dành cho em.',
    );
  });

  it('uses an article with one native homework action', () => {
    const onClick = vi.fn();
    const { container } = render(
      <StudentHomeworkCard assignment={homeworkAssignment} onClick={onClick} />,
    );

    expect(container.querySelector('article')).toBeTruthy();
    expect(container.querySelectorAll('button')).toHaveLength(1);
    const action = screen.getByRole('button', { name: 'Làm bài ngay' });
    expect(action).toHaveAttribute('type', 'button');
    fireEvent.click(action);
    expect(onClick).toHaveBeenCalledWith(homeworkAssignment);
  });

  it('uses shared skeletons instead of a loading spinner', () => {
    homeworkStoreMock.isLoading = true;
    render(
      <StudentHomeworkSection
        studentId="student-1"
        classId="class-1"
        onSelectAssignment={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId('assigned-work-skeleton')).toHaveLength(3);
    expect(screen.queryByText('Đang chuẩn bị bài tập AI cho em...')).not.toBeInTheDocument();
  });

  it('keeps the local homework retry action', async () => {
    homeworkStoreMock.error = 'Không thể tải bài tự luận';
    render(
      <StudentHomeworkSection
        studentId="student-1"
        classId="class-1"
        onSelectAssignment={vi.fn()}
      />,
    );

    await waitFor(() => expect(homeworkStoreMock.fetchClassAssignments).toHaveBeenCalled());
    homeworkStoreMock.fetchClassAssignments.mockClear();
    homeworkStoreMock.fetchStudentSubmissions.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    await waitFor(() => {
      expect(homeworkStoreMock.fetchClassAssignments).toHaveBeenCalledWith('class-1');
      expect(homeworkStoreMock.fetchStudentSubmissions).toHaveBeenCalledWith('student-1');
    });
  });
});
describe('avatar selector modal accessibility', () => {
  it('uses dialog semantics, an accessible close button, and closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <AvatarSelectorModal
        isOpen
        onClose={onClose}
        currentAvatar="girl_01"
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Chọn Avatar của em!' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Đóng hộp chọn avatar' })).toBeVisible();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

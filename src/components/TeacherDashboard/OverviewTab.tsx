import { formatSystemDateWithOptions, formatSystemTime, getSystemDateKey } from '../../utils/dateTime';
import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ResultDashboardSummary, ResultSummaryStatistics } from '../../../shared/result-summary.contract';
import { useQuizStore } from '../../../stores/quizStore';
import { Alert, Button } from '../common';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useAuthStore } from '../../../stores/authStore';
import { areClassNamesEqual } from '../../utils/classMatching';
import { filterTeacherResults, getTeacherClassNames } from './teacher-dashboard-shell/dashboardSelectors';
import type { TeacherDashboardTab } from '../../stores/useTeacherDashboardUIStore';
import {
  ActionCenterPanel,
  DashboardHero,
  DashboardKpiGrid,
  PerformancePanel,
  QuickActionGrid,
  QuizCreationChoicePanel,
  RecentQuizzesPanel,
  RecentSubmissionsPanel,
  type DashboardKpi,
  type DashboardQuickAction,
} from './overview';

type ResultsLoadState = 'loading' | 'success' | 'error';

interface OverviewTabProps {
  resultsLoadState: ResultsLoadState;
  resultsError?: string | null;
  onRetryResults: () => void | Promise<void>;
  resultSummary: ResultDashboardSummary | null;
  summaryLoadState: ResultsLoadState;
  summaryError?: string | null;
  onSelectTab: (tab: TeacherDashboardTab) => void;
  onOpenQuiz: (quizId: string) => void;
  manualQuizWorkspaceEnabled: boolean;
  onCreateQuizWithAi: () => void;
  onCreateQuizManually: () => void;
}

const EMPTY_SUMMARY_STATISTICS: ResultSummaryStatistics = {
  totalResults: 0,
  mean: 0,
  median: 0,
  stdDev: 0,
  min: 0,
  max: 0,
  passRate: 0,
  passCount: 0,
  failCount: 0,
  scoreDistribution: [
    { range: '0-2', count: 0, percentage: 0 },
    { range: '3-4', count: 0, percentage: 0 },
    { range: '5-6', count: 0, percentage: 0 },
    { range: '7-8', count: 0, percentage: 0 },
    { range: '9-10', count: 0, percentage: 0 },
  ],
};

const isSameLocalDay = (first: Date, second: Date): boolean =>
  getSystemDateKey(first) === getSystemDateKey(second);

const getGreeting = (date: Date): string => {
  const hour = Number(formatSystemTime(date).slice(0, 2));
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
};

const formatDateLabel = (date: Date): string => {
  const value = formatSystemDateWithOptions(date, {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatScopeLabel = (classNames: string[]): string => {
  if (classNames.length === 0) return 'Chưa có lớp';
  if (classNames.length > 1) return `${classNames.length} lớp`;
  const value = classNames[0];
  return /^lớp\s+/i.test(value) ? value : `Lớp ${value}`;
};

const OverviewTab: React.FC<OverviewTabProps> = ({
  resultsLoadState,
  resultsError,
  onRetryResults,
  resultSummary,
  summaryLoadState,
  summaryError,
  onSelectTab,
  onOpenQuiz,
  manualQuizWorkspaceEnabled,
  onCreateQuizWithAi,
  onCreateQuizManually,
}) => {
  const { isOnline } = useOnlineStatus();
  const authStore = useAuthStore();
  const quizStore = useQuizStore();

  const teacherClassNames = useMemo(
    () => getTeacherClassNames(authStore.teacherClasses, authStore.teacherClass),
    [authStore.teacherClasses, authStore.teacherClass],
  );

  const filteredResults = useMemo(
    () => filterTeacherResults(quizStore.results, authStore.isAdmin, authStore.teacherClasses, authStore.teacherClass),
    [quizStore.results, authStore.isAdmin, authStore.teacherClasses, authStore.teacherClass],
  );

  const visibleQuizzes = useMemo(() => {
    if (authStore.isAdmin) return quizStore.quizzes;
    if (teacherClassNames.length === 0) return [];
    return quizStore.quizzes.filter((quiz) => (
      teacherClassNames.some((className) => areClassNamesEqual(quiz.classLevel, className))
    ));
  }, [quizStore.quizzes, authStore.isAdmin, teacherClassNames]);

  const todayResults = useMemo(() => {
    const today = new Date();
    return filteredResults.filter((result) => {
      const submittedAt = new Date(result.submittedAt);
      return !Number.isNaN(submittedAt.getTime()) && isSameLocalDay(submittedAt, today);
    });
  }, [filteredResults]);

  const recentActivities = useMemo(() => (
    todayResults
      .slice()
      .sort((first, second) => new Date(second.submittedAt).getTime() - new Date(first.submittedAt).getTime())
      .slice(0, 5)
  ), [todayResults]);

  const recentQuizzes = useMemo(() => (
    visibleQuizzes
      .slice()
      .sort((first, second) => {
        const firstTime = new Date(first.createdAt).getTime();
        const secondTime = new Date(second.createdAt).getTime();
        return (Number.isNaN(secondTime) ? 0 : secondTime) - (Number.isNaN(firstTime) ? 0 : firstTime);
      })
      .slice(0, 5)
  ), [visibleQuizzes]);

  const scopeLabel = authStore.isAdmin ? 'Toàn trường' : formatScopeLabel(teacherClassNames);
  const now = new Date();
  const statistics = resultSummary?.statistics ?? EMPTY_SUMMARY_STATISTICS;
  const isInitialResultsLoading = resultsLoadState === 'loading' && filteredResults.length === 0;
  const isSummaryLoading = summaryLoadState === 'loading' && !resultSummary;
  const isSummaryUnavailable = summaryLoadState === 'error' && !resultSummary;
  const summaryFallbackText = summaryLoadState === 'loading'
    ? 'Đang tải số liệu tổng quan'
    : 'Không thể tải số liệu tổng quan';
  const alertTitle = resultsLoadState === 'error'
    ? 'Không thể tải kết quả học tập'
    : 'Không thể tải số liệu tổng quan';
  const alertMessage = resultsLoadState === 'error'
    ? (resultsError || 'Vui lòng kiểm tra kết nối rồi thử lại.')
    : (summaryError || 'Vui lòng kiểm tra kết nối rồi thử lại.');
  const showAlert = resultsLoadState === 'error' || summaryLoadState === 'error';

  const metrics: DashboardKpi[] = [
    {
      label: 'Đề kiểm tra',
      value: visibleQuizzes.length,
      helper: `${scopeLabel} · ${recentQuizzes.length} đề gần đây`,
      visual: 'test',
      tone: 'blue',
    },
    {
      label: 'Điểm trung bình',
      value: resultSummary ? statistics.mean.toFixed(1) : '—',
      helper: resultSummary ? `${statistics.passRate}% bài đạt từ 5 điểm` : summaryFallbackText,
      visual: 'results',
      tone: 'green',
      resultDependent: true,
    },
    {
      label: 'Tổng lượt nộp',
      value: resultSummary?.totalSubmissions ?? '—',
      helper: resultSummary
        ? `${resultSummary.uniqueCompletedWorks} bài hoàn thành · ${resultSummary.todaySubmissions} lượt hôm nay`
        : summaryFallbackText,
      visual: 'assignment',
      tone: 'violet',
      resultDependent: true,
    },
    {
      label: 'Học sinh tham gia',
      value: resultSummary?.uniqueStudents ?? '—',
      helper: resultSummary ? 'Tính theo dữ liệu học sinh đã tham gia' : summaryFallbackText,
      visual: 'students',
      tone: 'orange',
      resultDependent: true,
    },
    {
      label: 'Tỷ lệ đạt',
      value: resultSummary ? `${statistics.passRate}%` : '—',
      helper: resultSummary ? `${statistics.passCount} bài đạt từ 5 điểm` : summaryFallbackText,
      visual: 'results',
      tone: 'rose',
      resultDependent: true,
    },
  ];

  const quickActions: DashboardQuickAction[] = [
    { tab: 'assignments', title: 'Giao bài', description: 'Chọn lớp và đặt hạn nộp.', visual: 'assignment', tone: 'blue' },
    { tab: 'live-exam', title: 'Thi trực tiếp', description: 'Mở phòng thi và theo dõi.', visual: 'live-exam', tone: 'green' },
    { tab: 'results', title: 'Xem kết quả', description: 'Xem điểm và bài nộp.', visual: 'results', tone: 'rose' },
    { tab: 'classes', title: 'Quản lý lớp', description: 'Cập nhật lớp và học sinh.', visual: 'classroom', tone: 'cyan' },
    { tab: 'certificates', title: 'Cấp chứng nhận', description: 'Tạo chứng nhận theo mẫu.', visual: 'certificate', tone: 'orange' },
    { tab: 'manage', title: 'Quản lý đề', description: 'Mở danh sách đề kiểm tra.', visual: 'quiz-management', tone: 'violet' },
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 sm:space-y-5 lg:space-y-6">
      <nav aria-label="Đường dẫn trang" className="flex min-h-8 items-center gap-1.5 text-xs font-medium text-slate-500 sm:text-sm">
        <a
          href="/"
          className="rounded-md transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Trang chủ
        </a>
        <ChevronRight aria-hidden="true" className="size-4 text-slate-400" />
        <span aria-current="page" className="text-slate-800">Dashboard giáo viên</span>
      </nav>

      <div
        data-testid="teacher-dashboard-top-composition"
        className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] xl:gap-5"
      >
        <DashboardHero
          greeting={getGreeting(now)}
          teacherName={authStore.teacherName || authStore.username || 'Cô/Thầy'}
          dateLabel={formatDateLabel(now)}
          scopeLabel={scopeLabel}
          isAdmin={Boolean(authStore.isAdmin)}
        />
        <ActionCenterPanel />
      </div>

      {showAlert && (
        <Alert tone="danger" title={alertTitle} className="flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-orange-700">{alertMessage}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void onRetryResults()}
              disabled={!isOnline}
              title={!isOnline ? 'Cần kết nối mạng để thử lại.' : undefined}
            >
              Thử lại
            </Button>
          </div>
        </Alert>
      )}

      <QuizCreationChoicePanel
        manualQuizWorkspaceEnabled={manualQuizWorkspaceEnabled}
        onCreateWithAi={onCreateQuizWithAi}
        onCreateManually={onCreateQuizManually}
      />

      <QuickActionGrid actions={quickActions} onSelect={onSelectTab} />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] xl:gap-5">
        <PerformancePanel statistics={statistics} isLoading={isSummaryLoading} hasError={isSummaryUnavailable} />
        <RecentSubmissionsPanel
          submissions={recentActivities}
          isLoading={isInitialResultsLoading}
          hasError={resultsLoadState === 'error'}
          onViewAll={() => onSelectTab('results')}
        />
      </div>

      <DashboardKpiGrid metrics={metrics} isLoadingResults={isSummaryLoading} />

      <RecentQuizzesPanel
        quizzes={recentQuizzes}
        onManageQuizzes={() => onSelectTab('manage')}
        onOpenQuiz={onOpenQuiz}
      />
    </div>
  );
};

export default OverviewTab;

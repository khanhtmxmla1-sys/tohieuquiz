import React, { useEffect, useMemo, useState } from 'react';
import type { ResultDashboardSummary, ResultSummaryStatistics } from '../../../shared/result-summary.contract';
import {
    Award,
    CheckCircle2,
    ClipboardList,
    FileText,
    GraduationCap,
    PlusCircle,
    Radio,
    TrendingUp,
    UsersRound,
} from 'lucide-react';
import { useQuizStore } from '../../../stores/quizStore';
import { Alert, Button, DataFreshnessNotice } from '../common';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useAuthStore } from '../../../stores/authStore';
import { areClassNamesEqual } from '../../utils/classMatching';
import { useTeacherDashboardUIStore } from '../../stores/useTeacherDashboardUIStore';
import {
    ActionCenterPanel,
    DashboardHero,
    MetricGrid,
    PerformancePanel,
    QuickActionGrid,
    RecentQuizzesPanel,
    RecentSubmissionsPanel,
    type DashboardMetric,
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

const isSameLocalDay = (first: Date, second: Date): boolean => (
    first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate()
);

const getGreeting = (date: Date): string => {
    const hour = date.getHours();
    if (hour < 11) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
};

const formatDateLabel = (date: Date): string => {
    const value = date.toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
    return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatScopeLabel = (teacherClass?: string | null): string => {
    const value = String(teacherClass || '').trim();
    if (!value) return 'Tất cả lớp';
    return /^lớp\s+/i.test(value) ? value : `Lớp ${value}`;
};

const OverviewTab: React.FC<OverviewTabProps> = ({
    resultsLoadState,
    resultsError,
    onRetryResults,
    resultSummary,
    summaryLoadState,
    summaryError,
}) => {
    const { isOnline } = useOnlineStatus();
    const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
    const authStore = useAuthStore();
    const quizStore = useQuizStore();
    const setActiveTab = useTeacherDashboardUIStore((state) => state.setActiveTab);

    useEffect(() => {
        if (resultsLoadState === 'success' || summaryLoadState === 'success') {
            setLastUpdatedAt(Date.now());
        }
    }, [resultsLoadState, summaryLoadState, resultSummary]);

    const filteredResults = useMemo(() => (
        authStore.isAdmin || !authStore.teacherClass
            ? quizStore.results
            : quizStore.results.filter((result) => (
                areClassNamesEqual(result.studentClass, authStore.teacherClass)
            ))
    ), [quizStore.results, authStore.isAdmin, authStore.teacherClass]);

    const visibleQuizzes = useMemo(() => (
        authStore.isAdmin || !authStore.teacherClass
            ? quizStore.quizzes
            : quizStore.quizzes.filter((quiz) => (
                areClassNamesEqual(quiz.classLevel, authStore.teacherClass)
            ))
    ), [quizStore.quizzes, authStore.isAdmin, authStore.teacherClass]);

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
            .sort((first, second) => (
                new Date(second.submittedAt).getTime() - new Date(first.submittedAt).getTime()
            ))
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

    const scopeLabel = authStore.isAdmin ? 'Toàn trường' : formatScopeLabel(authStore.teacherClass);
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

    const quickActions: DashboardQuickAction[] = [
        {
            tab: 'create',
            title: 'Tạo đề mới',
            description: 'Soạn đề từ nội dung có sẵn, PDF hoặc công cụ AI.',
            icon: <PlusCircle />,
            iconClassName: 'text-sky-600',
            surfaceClassName: 'bg-sky-50',
        },
        {
            tab: 'assignments',
            title: 'Giao bài',
            description: 'Chọn lớp, đặt hạn nộp và gửi bài cho học sinh.',
            icon: <ClipboardList />,
            iconClassName: 'text-violet-600',
            surfaceClassName: 'bg-violet-50',
        },
        {
            tab: 'live-exam',
            title: 'Thi trực tiếp',
            description: 'Mở phòng thi và theo dõi tiến độ theo thời gian thực.',
            icon: <Radio />,
            iconClassName: 'text-orange-600',
            surfaceClassName: 'bg-orange-50',
        },
        {
            tab: 'results',
            title: 'Xem kết quả',
            description: 'Xem điểm, bài nộp và phân tích mức độ hoàn thành.',
            icon: <FileText />,
            iconClassName: 'text-emerald-700',
            surfaceClassName: 'bg-emerald-50',
        },
        {
            tab: 'classes',
            title: 'Quản lý lớp',
            description: 'Cập nhật danh sách lớp và thông tin học sinh.',
            icon: <GraduationCap />,
            iconClassName: 'text-cyan-600',
            surfaceClassName: 'bg-cyan-50',
        },
        {
            tab: 'certificates',
            title: 'Cấp chứng nhận',
            description: 'Tạo giấy chứng nhận từ các mẫu đã thiết lập.',
            icon: <Award />,
            iconClassName: 'text-amber-700',
            surfaceClassName: 'bg-amber-50',
        },
    ];

    const metrics: DashboardMetric[] = [
        {
            label: 'Đề kiểm tra',
            value: visibleQuizzes.length,
            helper: `${scopeLabel} · ${recentQuizzes.length} đề mới nhất được hiển thị bên dưới`,
            icon: <FileText />,
            iconClassName: 'text-sky-600',
            surfaceClassName: 'bg-sky-50',
        },
        {
            label: 'Điểm trung bình',
            value: resultSummary ? statistics.mean.toFixed(1) : '—',
            helper: resultSummary
                ? `${statistics.passRate}% bài đạt từ 5 điểm trở lên`
                : summaryFallbackText,
            icon: <TrendingUp />,
            iconClassName: 'text-emerald-700',
            surfaceClassName: 'bg-emerald-50',
        },
        {
            label: 'Tổng lượt nộp',
            value: resultSummary?.totalSubmissions ?? '—',
            helper: resultSummary
                ? `${resultSummary.uniqueCompletedWorks} bài hoàn thành · ${resultSummary.todaySubmissions} lượt hôm nay`
                : summaryFallbackText,
            icon: <CheckCircle2 />,
            iconClassName: 'text-violet-600',
            surfaceClassName: 'bg-violet-50',
        },
        {
            label: 'Học sinh tham gia',
            value: resultSummary?.uniqueStudents ?? '—',
            helper: resultSummary
                ? 'Tính theo mã học sinh; dữ liệu cũ đối chiếu theo tên và lớp'
                : summaryFallbackText,
            icon: <UsersRound />,
            iconClassName: 'text-amber-700',
            surfaceClassName: 'bg-amber-50',
        },
    ];

    return (
        <div className="mx-auto w-full max-w-[1280px] space-y-4 sm:space-y-5 lg:space-y-6">
            <DashboardHero
                greeting={getGreeting(now)}
                teacherName={authStore.teacherName || authStore.username || 'Cô/Thầy'}
                dateLabel={formatDateLabel(now)}
                scopeLabel={scopeLabel}
                isAdmin={Boolean(authStore.isAdmin)}
                todaySubmissionCount={resultSummary?.todaySubmissions ?? '—'}
                passRate={resultSummary ? statistics.passRate : '—'}
                uniqueStudents={resultSummary?.uniqueStudents ?? '—'}
                onCreateQuiz={() => setActiveTab('create')}
                onViewResults={() => setActiveTab('results')}
            />

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

            <DataFreshnessNotice
                staleAt={lastUpdatedAt}
                isOffline={!isOnline}
                isRefreshing={resultsLoadState === 'loading' || summaryLoadState === 'loading'}
            />

            <ActionCenterPanel />
            <QuickActionGrid actions={quickActions} onSelect={setActiveTab} />
            <MetricGrid metrics={metrics} isLoadingResults={isSummaryLoading} />

            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] xl:gap-5">
                <PerformancePanel statistics={statistics} isLoading={isSummaryLoading} hasError={isSummaryUnavailable} />
                <RecentSubmissionsPanel
                    submissions={recentActivities}
                    isLoading={isInitialResultsLoading}
                    hasError={resultsLoadState === 'error'}
                    onViewAll={() => setActiveTab('results')}
                />
            </div>

            <RecentQuizzesPanel
                quizzes={recentQuizzes}
                onCreateQuiz={() => setActiveTab('create')}
                onManageQuizzes={() => setActiveTab('manage')}
            />
        </div>
    );
};

export default OverviewTab;

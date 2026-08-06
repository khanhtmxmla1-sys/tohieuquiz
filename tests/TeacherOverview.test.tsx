import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResultDashboardSummary } from '../shared/result-summary.contract';
import OverviewTab from '../src/components/TeacherDashboard/OverviewTab';
import { useAuthStore } from '../stores/authStore';
import { useQuizStore } from '../stores/quizStore';

const makeResult = (
    id: string,
    studentName: string,
    studentClass: string,
    score: number,
    submittedAt: string,
) => ({
    id,
    quizId: 'quiz-1',
    quizTitle: 'Bài kiểm tra',
    studentName,
    studentClass,
    score,
    correctCount: 8,
    totalQuestions: 10,
    timeTaken: 10,
    submittedAt,
    answers: {},
});

const summaryFixture: ResultDashboardSummary = {
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
};

const renderOverview = (
    overrides: Partial<React.ComponentProps<typeof OverviewTab>> = {},
) => render(
    <OverviewTab
        resultsLoadState="success"
        onRetryResults={vi.fn()}
        resultSummary={summaryFixture}
        summaryLoadState="success"
        summaryError={null}
        onSelectTab={vi.fn()}
        manualQuizWorkspaceEnabled
        onCreateQuizWithAi={vi.fn()}
        onCreateQuizManually={vi.fn()}
        {...overrides}
    />,
);

describe('TeacherDashboard OverviewTab', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-17T03:00:00.000Z'));
        useAuthStore.setState({
            isLoggedIn: true,
            username: 'teacher',
            teacherName: 'Cô An',
            isAdmin: false,
            teacherClass: '3A',
        });
        useQuizStore.setState({
            quizzes: [
                {
                    id: 'quiz-3a',
                    title: 'Đề lớp 3A',
                    classLevel: 'Lớp 3-A',
                    questions: [],
                    timeLimit: 30,
                    createdAt: '2026-07-17T00:00:00.000Z',
                },
                {
                    id: 'quiz-13a',
                    title: 'Đề lớp 13A',
                    classLevel: '13A',
                    questions: [],
                    timeLimit: 30,
                    createdAt: '2026-07-16T00:00:00.000Z',
                },
            ] as any,
            results: [
                makeResult('today-3a', 'An', '3A', 8, '2026-07-17T02:00:00.000Z'),
                makeResult('yesterday-3a', 'Bình', 'lớp 3-a', 6, '2026-07-16T02:00:00.000Z'),
                makeResult('today-13a', 'Chi', '13A', 10, '2026-07-17T01:00:00.000Z'),
            ] as any,
            error: null,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('uses exact normalized class matching and real summary data in five KPI cards', () => {
        renderOverview();

        const kpiRegion = screen.getByRole('region', { name: 'Chỉ số tổng quan' });
        const cards = within(kpiRegion).getAllByRole('article');
        expect(cards).toHaveLength(5);
        expect(within(cards[0]).getByText('3A')).toBeInTheDocument();
        expect(within(kpiRegion).getByText('1')).toBeInTheDocument();
        expect(within(kpiRegion).getByText('188')).toBeInTheDocument();
        expect(within(kpiRegion).getByText('18')).toBeInTheDocument();
        expect(within(kpiRegion).getByText('67%')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Tình hình điểm số' })).toBeInTheDocument();
        expect(screen.getByText('Tổng hợp từ 188 bài hoàn thành; mỗi bài lấy lần nộp cuối cùng.')).toBeInTheDocument();
        const recentSubmission = screen.getByText('vừa nộp').parentElement?.textContent || '';
        expect(recentSubmission).toContain('Bài kiểm tra');
        expect(document.body.textContent).toContain('Bình');
        expect(document.body.textContent).not.toContain('Chi');
    });

    it('uses the blue educational hero and the custom teacher illustration', () => {
        renderOverview();

        const heroHeading = screen.getByRole('heading', { name: 'Chào buổi sáng, Cô An!' });
        const heroSection = heroHeading.closest('section');
        expect(heroSection?.className).toContain('from-white');
        expect(heroSection?.className).toContain('rounded-[28px]');
        const illustrations = within(heroSection as HTMLElement).getAllByRole('presentation', { hidden: true });
        expect(illustrations).toHaveLength(2);
        for (const illustration of illustrations) {
            expect(illustration).toHaveAttribute('src', '/illustrations/tohieuquiz/teacher-dashboard-v2/teacher-welcome.webp');
        }
        expect(screen.getByText(/Chuẩn bị bài giảng, theo dõi tiến độ lớp học/i)).toBeInTheDocument();
    });

    it('places hero beside Action Center and keeps six separate quick actions', () => {
        renderOverview();

        const creationHeading = screen.getByRole('heading', { name: 'Tạo đề kiểm tra' });
        const attentionHeading = screen.getByRole('heading', { name: 'Việc cần chú ý hôm nay' });
        const quickHeading = screen.getByRole('heading', { name: 'Thao tác nhanh' });
        const topGrid = screen.getByTestId('dashboard-top-grid');
        expect(topGrid).toContainElement(attentionHeading.closest('section'));
        expect(topGrid).toContainElement(screen.getByRole('heading', { name: 'Chào buổi sáng, Cô An!' }).closest('section'));
        expect(attentionHeading.compareDocumentPosition(creationHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(creationHeading.compareDocumentPosition(quickHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

        const quickSection = quickHeading.closest('section');
        expect(within(quickSection as HTMLElement).getAllByRole('button')).toHaveLength(6);
        expect(within(quickSection as HTMLElement).queryByRole('button', { name: /Tạo đề/i })).not.toBeInTheDocument();
    });

    it('uses administrator-specific overview copy for school-wide accounts', () => {
        useAuthStore.setState({
            isLoggedIn: true,
            username: 'admin',
            teacherName: 'Quản trị hệ thống',
            isAdmin: true,
            teacherClass: null,
        });

        renderOverview();

        expect(screen.getByText(/Theo dõi hoạt động toàn trường, quản lý công việc quan trọng/i)).toBeInTheDocument();
        expect(screen.getAllByText('Toàn trường').length).toBeGreaterThan(0);
    });

    it.each([
        ['Giao bài', 'assignments'],
        ['Thi trực tiếp', 'live-exam'],
        ['Xem kết quả', 'results'],
        ['Quản lý lớp', 'classes'],
        ['Cấp chứng nhận', 'certificates'],
        ['Quản lý đề', 'manage'],
    ] as const)('opens %s from the quick action area', (label, expectedTab) => {
        const onSelectTab = vi.fn();
        renderOverview({ onSelectTab });

        const quickSection = screen.getByRole('heading', { name: 'Thao tác nhanh' }).closest('section');
        fireEvent.click(within(quickSection as HTMLElement).getByRole('button', { name: new RegExp(label, 'i') }));
        expect(onSelectTab).toHaveBeenCalledWith(expectedTab);
    });

    it('opens AI and manual creation only from the dedicated panel', () => {
        const onCreateQuizWithAi = vi.fn();
        const onCreateQuizManually = vi.fn();
        renderOverview({ onCreateQuizWithAi, onCreateQuizManually });

        const creationPanel = screen.getByRole('heading', { name: 'Tạo đề kiểm tra' }).closest('section');
        fireEvent.click(within(creationPanel as HTMLElement).getByRole('button', { name: 'Tạo đề bằng AI' }));
        fireEvent.click(within(creationPanel as HTMLElement).getByRole('button', { name: 'Soạn đề thủ công' }));

        const recentSection = screen.getByRole('heading', { name: 'Đề kiểm tra gần đây' }).closest('section');
        expect(within(recentSection as HTMLElement).queryByRole('button', { name: 'Tạo đề bằng AI' })).not.toBeInTheDocument();
        expect(within(recentSection as HTMLElement).queryByRole('button', { name: 'Soạn đề thủ công' })).not.toBeInTheDocument();
        expect(onCreateQuizWithAi).toHaveBeenCalledTimes(1);
        expect(onCreateQuizManually).toHaveBeenCalledTimes(1);
    });

    it('keeps the legacy single create action inside the dedicated panel', () => {
        const onCreateQuizWithAi = vi.fn();
        renderOverview({ manualQuizWorkspaceEnabled: false, onCreateQuizWithAi });

        const creationPanel = screen.getByRole('heading', { name: 'Tạo đề kiểm tra' }).closest('section');
        expect(creationPanel).toBeTruthy();
        expect(within(creationPanel as HTMLElement).queryByRole('button', { name: 'Soạn đề thủ công' })).not.toBeInTheDocument();
        fireEvent.click(within(creationPanel as HTMLElement).getByRole('button', { name: 'Tạo đề mới' }));
        expect(onCreateQuizWithAi).toHaveBeenCalledTimes(1);
    });

    it('shows recent quizzes and opens the quiz management tab', () => {
        const onSelectTab = vi.fn();
        renderOverview({ onSelectTab });

        expect(screen.getAllByText('Đề lớp 3A').length).toBeGreaterThan(0);
        const recentSection = screen.getByRole('heading', { name: 'Đề kiểm tra gần đây' }).closest('section');
        fireEvent.click(within(recentSection as HTMLElement).getAllByRole('button', { name: /^Quản lý/i })[0]);
        expect(onSelectTab).toHaveBeenCalledWith('manage');
    });

    it('does not fall back to the paginated result array when summary loading fails', () => {
        renderOverview({
            resultSummary: null,
            summaryLoadState: 'error',
            summaryError: 'Không thể tải số liệu tổng quan.',
        });

        const kpiRegion = screen.getByRole('region', { name: 'Chỉ số tổng quan' });
        expect(within(kpiRegion).getAllByText('—').length).toBeGreaterThan(0);
        expect(screen.getByRole('alert')).toHaveTextContent('Không thể tải số liệu tổng quan.');
        expect(screen.getByRole('heading', { name: 'Không thể tải tình hình điểm số' })).toBeInTheDocument();
    });

    it('shows a retry action when loading results fails', () => {
        const onRetryResults = vi.fn();
        renderOverview({
            resultsLoadState: 'error',
            resultsError: 'Phiên đăng nhập đã hết hạn',
            onRetryResults,
        });

        expect(screen.getByRole('alert')).toHaveTextContent('Phiên đăng nhập đã hết hạn');
        fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
        expect(onRetryResults).toHaveBeenCalledTimes(1);
    });
});

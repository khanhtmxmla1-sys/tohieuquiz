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
        {...overrides}
    />,
);

describe('TeacherDashboard OverviewTab', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // 10:00 on 17/07/2026 in Hanoi (UTC+7). Keep the fixture
        // absolute so it behaves identically on UTC and GMT+7 runners.
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

    it('uses exact normalized class matching and only shows submissions from today', () => {
        renderOverview();

        const quizCard = screen.getByText('Đề kiểm tra').closest('article');
        const resultCard = screen.getByText('Tổng lượt nộp').closest('article');
        const studentCard = screen.getByText('Học sinh tham gia').closest('article');
        const averageCard = screen.getAllByText('Điểm trung bình')[0].closest('article');

        expect(quizCard && within(quizCard).getByText('1')).toBeTruthy();
        expect(resultCard && within(resultCard).getByText('285')).toBeTruthy();
        expect(resultCard?.textContent).toContain('188 bài hoàn thành · 0 lượt hôm nay');
        expect(studentCard && within(studentCard).getByText('18')).toBeTruthy();
        expect(averageCard && within(averageCard).getByText('5.8')).toBeTruthy();
        expect(averageCard?.textContent).toContain('67% bài đạt từ 5 điểm trở lên');
        expect(screen.queryByText('Số bài đã nộp')).toBeNull();
        expect(screen.getByRole('heading', { name: 'Tình hình điểm số' })).toBeTruthy();
        expect(screen.getByText('Tổng hợp từ 188 bài hoàn thành; mỗi bài lấy lần nộp cuối cùng.')).toBeTruthy();
        const recentSubmission = screen.getByText('vừa nộp').parentElement?.textContent || '';
        expect(recentSubmission).toContain('Bài kiểm tra');
        expect(document.body.textContent).not.toContain('Bình');
        expect(document.body.textContent).not.toContain('Chi');
    });

    it('uses the warm flat teacher dashboard palette for the hero', () => {
        renderOverview();

        const heroHeading = screen.getByRole('heading', { name: 'Chào buổi sáng, Cô An!' });
        const heroSection = heroHeading.closest('section');
        expect(heroSection).toBeTruthy();
        expect(heroSection?.className).toContain('bg-white');
        expect(heroSection?.className).toContain('border-slate-200');
        expect(heroSection?.className).toContain('rounded-[14px]');
        expect(heroSection?.className).not.toContain('gradient');
        expect(heroSection?.className).not.toContain('shadow');
        expect(screen.getByText('Theo dõi tiến độ học tập của lớp, tạo và giao bài, đồng thời xem nhanh kết quả của học sinh ngay tại đây.')).toBeTruthy();
        expect(within(heroSection as HTMLElement).queryByRole('button', { name: 'T?o ?? m?i' })).not.toBeInTheDocument();
        expect(within(heroSection as HTMLElement).queryByRole('button', { name: 'Xem k?t qu?' })).not.toBeInTheDocument();
        expect(screen.queryByText(/Dữ liệu đã sẵn sàng/i)).not.toBeInTheDocument();
    });

    it('gives quick actions subtle depth, icon surfaces and a highlighted primary action', () => {
        renderOverview();

        const quickActionsHeading = screen.getByRole('heading', { name: 'Bạn muốn làm gì?' });
        const quickActionsSection = quickActionsHeading.closest('section');
        const createAction = within(quickActionsSection as HTMLElement).getByRole('button', { name: /Tạo đề mới/i });
        const quizMetric = screen.getByText('Đề kiểm tra').closest('article');

        expect(quickActionsSection?.className).toContain('rounded-[14px]');
        expect(createAction.className).toContain('rounded-[16px]');
        expect(createAction.className).toContain('hover:-translate-y-0.5');
        expect(createAction.className).toContain('shadow-[0_2px_10px_rgba(15,23,42,0.05)]');
        expect(createAction.className).toContain('bg-gradient-to-br');
        expect(createAction.className).toContain('from-sky-50');
        expect(quizMetric?.className).toContain('rounded-[14px]');
        expect(quizMetric?.className).not.toContain('translate-y');
        expect(quizMetric?.className).not.toContain('gradient');
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

        expect(screen.getByText('Theo dõi hoạt động toàn trường, nắm nhanh số liệu quan trọng và xử lý các công việc cần thiết ngay tại đây.')).toBeTruthy();
        expect(screen.queryByText('Theo dõi tiến độ học tập của lớp, tạo và giao bài, đồng thời xem nhanh kết quả của học sinh ngay tại đây.')).toBeNull();
    });

    it('uses flat bordered analysis and activity panels', () => {
        renderOverview();

        const performancePanel = screen.getByRole('heading', { name: 'Tình hình điểm số' }).closest('section');
        const submissionsPanel = screen.getByRole('heading', { name: 'Bài vừa nộp' }).closest('section');
        const quizzesPanel = screen.getByRole('heading', { name: 'Đề kiểm tra gần đây' }).closest('section');

        for (const panel of [performancePanel, submissionsPanel, quizzesPanel]) {
            expect(panel?.className).toContain('rounded-[14px]');
            expect(panel?.className).toContain('border-slate-200');
            expect(panel?.className).not.toContain('shadow');
        }
    });

    it.each([
        ['Tạo đề mới', 'create'],
        ['Giao bài', 'assignments'],
        ['Thi trực tiếp', 'live-exam'],
        ['Xem kết quả', 'results'],
        ['Quản lý lớp', 'classes'],
        ['Cấp chứng nhận', 'certificates'],
    ] as const)('opens %s from the quick action area', (label, expectedTab) => {
        const onSelectTab = vi.fn();
        renderOverview({ onSelectTab });

        const quickActionsHeading = screen.getByRole('heading', { name: 'Bạn muốn làm gì?' });
        const quickActionsSection = quickActionsHeading.closest('section');
        expect(quickActionsSection).toBeTruthy();

        fireEvent.click(within(quickActionsSection as HTMLElement).getByRole('button', { name: new RegExp(label, 'i') }));
        expect(onSelectTab).toHaveBeenCalledWith(expectedTab);
    });

    it('shows recent quizzes and opens the quiz management tab', () => {
        const onSelectTab = vi.fn();
        renderOverview({ onSelectTab });

        expect(screen.getByRole('heading', { name: 'Đề kiểm tra gần đây' })).toBeTruthy();
        expect(screen.getAllByText('Đề lớp 3A').length).toBeGreaterThan(0);

        const recentQuizzesHeading = screen.getByRole('heading', { name: 'Đề kiểm tra gần đây' });
        const recentQuizzesSection = recentQuizzesHeading.closest('section');
        expect(recentQuizzesSection).toBeTruthy();

        fireEvent.click(within(recentQuizzesSection as HTMLElement).getAllByRole('button', { name: /^Quản lý/i })[0]);
        expect(onSelectTab).toHaveBeenCalledWith('manage');
    });

    it('does not fall back to the paginated result array when summary loading fails', () => {
        renderOverview({
            resultSummary: null,
            summaryLoadState: 'error',
            summaryError: 'Không thể tải số liệu tổng quan.',
        });

        const resultCard = screen.getByText('Tổng lượt nộp').parentElement;
        expect(resultCard && within(resultCard).getByText('—')).toBeTruthy();
        expect(screen.getByRole('alert').textContent).toContain('Không thể tải số liệu tổng quan.');
        expect(screen.getByRole('heading', { name: 'Không thể tải tình hình điểm số' })).toBeTruthy();
    });

    it('shows a retry action when loading results fails', () => {
        const onRetryResults = vi.fn();
        renderOverview({
            resultsLoadState: 'error',
            resultsError: 'Phiên đăng nhập đã hết hạn',
            onRetryResults,
        });

        expect(screen.getByRole('alert').textContent).toContain('Phiên đăng nhập đã hết hạn');
        fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
        expect(onRetryResults).toHaveBeenCalledTimes(1);
    });
});

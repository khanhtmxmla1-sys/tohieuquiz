import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResultDashboardSummary } from '../shared/result-summary.contract';
import OverviewTab from '../src/components/TeacherDashboard/OverviewTab';
import { useAuthStore } from '../stores/authStore';
import { useQuizStore } from '../stores/quizStore';
import { useTeacherDashboardUIStore } from '../src/stores/useTeacherDashboardUIStore';

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
        {...overrides}
    />,
);

describe('TeacherDashboard OverviewTab', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 6, 17, 10, 0, 0));
        useAuthStore.setState({
            isLoggedIn: true,
            username: 'teacher',
            teacherName: 'Cô An',
            isAdmin: false,
            teacherClass: '3A',
        });
        useTeacherDashboardUIStore.setState({ activeTab: 'overview' });
        useQuizStore.setState({
            quizzes: [
                {
                    id: 'quiz-3a',
                    title: 'Đề lớp 3A',
                    classLevel: 'Lớp 3-A',
                    questions: [],
                    timeLimit: 30,
                    createdAt: new Date(2026, 6, 17, 7, 0, 0).toISOString(),
                },
                {
                    id: 'quiz-13a',
                    title: 'Đề lớp 13A',
                    classLevel: '13A',
                    questions: [],
                    timeLimit: 30,
                    createdAt: new Date(2026, 6, 16, 7, 0, 0).toISOString(),
                },
            ] as any,
            results: [
                makeResult('today-3a', 'An', '3A', 8, new Date(2026, 6, 17, 9, 0, 0).toISOString()),
                makeResult('yesterday-3a', 'Bình', 'lớp 3-a', 6, new Date(2026, 6, 16, 9, 0, 0).toISOString()),
                makeResult('today-13a', 'Chi', '13A', 10, new Date(2026, 6, 17, 8, 0, 0).toISOString()),
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
        expect(heroSection?.className).toContain('border-[#E5E7EB]');
        expect(heroSection?.className).toContain('rounded-[14px]');
        expect(heroSection?.className).not.toContain('gradient');
        expect(heroSection?.className).not.toContain('shadow');
    });

    it('uses restrained flat cards without hover lift', () => {
        renderOverview();

        const quickActionsHeading = screen.getByRole('heading', { name: 'Bạn muốn làm gì?' });
        const quickActionsSection = quickActionsHeading.closest('section');
        const createAction = within(quickActionsSection as HTMLElement).getByRole('button', { name: /Tạo đề mới/i });
        const quizMetric = screen.getByText('Đề kiểm tra').closest('article');

        expect(quickActionsSection?.className).toContain('rounded-[14px]');
        expect(createAction.className).toContain('rounded-[12px]');
        expect(createAction.className).not.toContain('translate-y');
        expect(createAction.className).not.toContain('gradient');
        expect(quizMetric?.className).toContain('rounded-[14px]');
        expect(quizMetric?.className).not.toContain('translate-y');
        expect(quizMetric?.className).not.toContain('gradient');
    });

    it('uses flat bordered analysis and activity panels', () => {
        renderOverview();

        const performancePanel = screen.getByRole('heading', { name: 'Tình hình điểm số' }).closest('section');
        const submissionsPanel = screen.getByRole('heading', { name: 'Bài vừa nộp' }).closest('section');
        const quizzesPanel = screen.getByRole('heading', { name: 'Đề kiểm tra gần đây' }).closest('section');

        for (const panel of [performancePanel, submissionsPanel, quizzesPanel]) {
            expect(panel?.className).toContain('rounded-[14px]');
            expect(panel?.className).toContain('border-[#E5E7EB]');
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
        renderOverview();

        const quickActionsHeading = screen.getByRole('heading', { name: 'Bạn muốn làm gì?' });
        const quickActionsSection = quickActionsHeading.closest('section');
        expect(quickActionsSection).toBeTruthy();

        fireEvent.click(within(quickActionsSection as HTMLElement).getByRole('button', { name: new RegExp(label, 'i') }));
        expect(useTeacherDashboardUIStore.getState().activeTab).toBe(expectedTab);
    });

    it('shows recent quizzes and opens the quiz management tab', () => {
        renderOverview();

        expect(screen.getByRole('heading', { name: 'Đề kiểm tra gần đây' })).toBeTruthy();
        expect(screen.getAllByText('Đề lớp 3A').length).toBeGreaterThan(0);

        const recentQuizzesHeading = screen.getByRole('heading', { name: 'Đề kiểm tra gần đây' });
        const recentQuizzesSection = recentQuizzesHeading.closest('section');
        expect(recentQuizzesSection).toBeTruthy();

        fireEvent.click(within(recentQuizzesSection as HTMLElement).getAllByRole('button', { name: /^Quản lý/i })[0]);
        expect(useTeacherDashboardUIStore.getState().activeTab).toBe('manage');
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

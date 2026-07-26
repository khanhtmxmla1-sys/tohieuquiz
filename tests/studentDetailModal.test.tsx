import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StudentDetailModal } from '../src/components/teacher/ResultsView/StudentDetailModal';
import { fetchWeaknessProfile } from '../src/services/weaknessProfileService';
import {
    studentDetailQuestions,
    studentDetailResult,
    weaknessProfileFixture,
} from './fixtures/studentDetailModalFixture';

vi.mock('../src/services/weaknessProfileService', () => ({ fetchWeaknessProfile: vi.fn() }));
vi.mock('../src/services/classroomService', () => ({ getSmartAssignmentPreview: vi.fn() }));
vi.mock('../src/services/ai/studentAnalysisService', () => ({ analyzeStudentPerformance: vi.fn() }));
vi.mock('../src/components/common', () => ({
    QuestionReview: ({ question }: any) => <div>Review: {question.question}</div>,
}));
vi.mock('../src/features/analytics/components/CompetencyRadar', () => ({
    CompetencyRadar: () => <div>Competency Radar</div>,
}));
vi.mock('../src/features/analytics/components/AIInsightBox', () => ({
    AIInsightBox: () => <div>AI Insight Box</div>,
}));
vi.mock('html2canvas', () => ({ default: vi.fn() }));
vi.mock('react-hot-toast', () => ({
    toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));

const fetchWeaknessProfileMock = vi.mocked(fetchWeaknessProfile);

const renderModal = (onClose = vi.fn()) => {
    render(
        <StudentDetailModal
            result={studentDetailResult}
            questions={studentDetailQuestions}
            onClose={onClose}
        />
    );
    return onClose;
};

describe('StudentDetailModal public behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchWeaknessProfileMock.mockResolvedValue(weaknessProfileFixture as any);
    });

    it('renders result details, excludes skipped answers from wrong, and closes', () => {
        const onClose = renderModal();
        expect(screen.getByText('Lan')).toBeInTheDocument();
        expect(screen.getByText('Review: Hai cộng hai bằng bao nhiêu?')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Đúng\s*1/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Sai\s*0/i })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Đóng modal' }));
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('renders the skipped question snapshot with a grey palette state', () => {
        renderModal();
        const skippedQuestion = screen.getByRole('button', { name: '2ĐB' });
        expect(skippedQuestion).toHaveClass('bg-slate-100');
        fireEvent.click(skippedQuestion);
        expect(screen.getByText('Review: Viết số liền sau số 9')).toBeInTheDocument();
        expect(screen.getAllByText('Bỏ qua').length).toBeGreaterThan(0);
    });

    it('loads analytics data only after the analytics tab is selected', async () => {
        renderModal();
        const exportButton = screen.getByRole('button', { name: /Xuất PNG/i });
        expect(exportButton).toBeDisabled();
        expect(fetchWeaknessProfileMock).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: /Phân tích năng lực/i }));
        expect(exportButton).toBeEnabled();
        expect(screen.getByText('Competency Radar')).toBeInTheDocument();
        expect(screen.getByText('AI Insight Box')).toBeInTheDocument();
        await waitFor(() => {
            expect(fetchWeaknessProfileMock).toHaveBeenCalledWith('result-modal-1');
        });
    });
});

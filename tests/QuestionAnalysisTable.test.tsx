import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuestionAnalysisTable } from '../src/components/teacher/ResultsView/QuestionAnalysisTable';
import type { QuestionAnalysis } from '../src/utils/statisticsUtils';

vi.mock('../src/components/common/MathSpan', () => ({
    default: ({ content, className }: { content: string; className?: string }) => (
        <span className={className}>{content}</span>
    ),
}));

const analysis: QuestionAnalysis[] = [
    {
        questionId: 'q2',
        questionNumber: 2,
        questionText: 'Tính 5 + 5',
        correctCount: 2,
        wrongCount: 8,
        skippedCount: 1,
        unknownCount: 0,
        evaluatedCount: 10,
        correctRate: 20,
        wrongRate: 80,
        difficulty: 'hard',
        priority: 'high',
        correctAnswerText: '10',
        commonWrongAnswers: [{ answer: '9', count: 4 }],
        affectedStudents: ['An', 'Bình'],
    },
    {
        questionId: 'q1',
        questionNumber: 1,
        questionText: 'Tính 1 + 1',
        correctCount: 9,
        wrongCount: 1,
        skippedCount: 0,
        unknownCount: 0,
        evaluatedCount: 10,
        correctRate: 90,
        wrongRate: 10,
        difficulty: 'easy',
        priority: 'low',
        correctAnswerText: '2',
        commonWrongAnswers: [{ answer: '3', count: 1 }],
        affectedStudents: ['Chi'],
    },
];

describe('QuestionAnalysisTable', () => {
    it('shows stable question numbers and actionable class evidence', () => {
        render(
            <QuestionAnalysisTable
                analysis={analysis}
                cohortSize={10}
                attemptMode="latest"
                onAttemptModeChange={vi.fn()}
            />,
        );

        expect(screen.getByText('Câu sai nhiều nhất')).toBeInTheDocument();
        expect(screen.getAllByText('Câu 2').length).toBeGreaterThan(0);
        expect(screen.getByText('8/10 sai')).toBeInTheDocument();
        expect(screen.getByText('9 (4 học sinh)')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Xem 2 học sinh cần hỗ trợ'));
        expect(screen.getByText(/An, Bình/)).toBeInTheDocument();
    });

    it('allows the teacher to include all attempts explicitly', () => {
        const onAttemptModeChange = vi.fn();
        render(
            <QuestionAnalysisTable
                analysis={analysis}
                cohortSize={10}
                attemptMode="latest"
                onAttemptModeChange={onAttemptModeChange}
            />,
        );

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'all' } });
        expect(onAttemptModeChange).toHaveBeenCalledWith('all');
    });
});

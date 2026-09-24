import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StudentPreviewPane from '../src/features/manual-quiz-workspace/components/StudentPreviewPane';

vi.mock('../src/features/quiz-player/components/QuestionRenderer/atoms/MathSpan', () => ({
    default: ({ content }: { content: string }) => <span>{content}</span>,
}));

const mcq = (id: string, options: string[]) => ({
    id,
    type: 'MCQ',
    question: 'Chọn đáp án đúng',
    options,
    correctAnswer: 'A',
    difficulty: 1,
    points: 1,
});

describe('StudentPreviewPane ephemeral answer state', () => {
    it('renders MCQ interaction locally and resets answers when the question changes', () => {
        const firstQuestion = mcq('preview-mcq-1', ['Một', 'Hai']);
        const secondQuestion = mcq('preview-mcq-2', ['Chín', 'Mười']);
        const { rerender } = render(<StudentPreviewPane question={firstQuestion as any} />);

        const firstAnswer = screen.getByRole('button', { name: /Hai/ });
        fireEvent.click(firstAnswer);
        expect(firstAnswer).toHaveAttribute('aria-pressed', 'true');

        rerender(<StudentPreviewPane question={secondQuestion as any} />);
        expect(screen.getByRole('button', { name: /Mười/ })).toHaveAttribute('aria-pressed', 'false');
    });

    it('completes matching pairs locally without mutating the quiz question', () => {
        const question = {
            id: 'preview-matching',
            type: 'MATCHING',
            question: 'Nối hai cột',
            leftItems: [{ id: 'left-1', content: 'A' }],
            rightItems: [{ id: 'right-1', content: '1' }],
            points: 1,
        };

        render(<StudentPreviewPane question={question as any} />);
        fireEvent.click(screen.getByRole('button', { name: 'A' }));
        fireEvent.click(screen.getByRole('button', { name: '1' }));

        expect(screen.getAllByText('Cặp 1')).toHaveLength(2);
        expect(question).not.toHaveProperty('selectedLeft');
        expect(question).not.toHaveProperty('left-1');
    });
});

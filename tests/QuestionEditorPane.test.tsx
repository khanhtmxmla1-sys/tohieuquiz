import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import QuestionEditorPane from '../src/features/manual-quiz-workspace/components/QuestionEditorPane';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';

const seed = {
    title: 'Đề Toán lớp 4',
    classLevel: '4A',
    category: 'toan',
    timeLimit: 20,
    tags: [],
    requireCode: false,
    showOnHome: true,
};

describe('QuestionEditorPane math composer integration', () => {
    beforeEach(() => {
        localStorage.clear();
        useManualQuizWorkspaceStore.getState().reset();
        useManualQuizWorkspaceStore.getState().initializeFromSeed(seed, 'teacher-a');
        useManualQuizWorkspaceStore.getState().addQuestion({
            id: 'q-1',
            type: QuestionType.MCQ,
            question: '1 + 1 bằng bao nhiêu?',
            options: ['1', '2', '3', '4'],
            correctAnswer: 'B',
            difficulty: 1,
            points: 1,
        });
    });

    it('opens and closes the full visual math panel inside the editor pane', () => {
        render(<QuestionEditorPane />);

        const toggle = screen.getByRole('button', { name: 'Công thức toán' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('region', { name: 'Bảng chèn công thức toán' })).not.toBeInTheDocument();

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('region', { name: 'Bảng chèn công thức toán' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Đóng bảng công thức toán' }));
        expect(screen.queryByRole('region', { name: 'Bảng chèn công thức toán' })).not.toBeInTheDocument();
    });
});

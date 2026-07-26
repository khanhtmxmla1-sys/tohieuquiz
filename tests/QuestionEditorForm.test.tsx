import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuestionType } from '../src/types';
import type { AnyEditorDraft } from '../src/features/quiz-editor/types/quiz-editor.types';
import QuestionEditorForm from '../src/features/quiz-editor/components/QuestionEditorModal/QuestionEditorForm';
import QuestionEditorModal from '../src/features/quiz-editor/components/QuestionEditorModal/QuestionEditorModal';

const question = {
    id: 'q-1',
    type: QuestionType.MCQ,
    question: '1 + 1 bằng bao nhiêu?',
    options: ['1', '2', '3', '4'],
    correctAnswer: 'B',
    difficulty: 1 as const,
};

const initialDraft: AnyEditorDraft = {
    type: QuestionType.MCQ,
    question: question.question,
    options: [...question.options],
    correctAnswer: question.correctAnswer,
    difficulty: 1,
};

const ControlledForm = ({ mode }: { mode: 'inline' | 'modal' }) => {
    const [draft, setDraft] = useState(initialDraft);
    return (
        <QuestionEditorForm
            editingQuestion={question}
            draft={draft}
            onDraftChange={(updater) => setDraft((current) => updater(current))}
            onSave={vi.fn()}
            onCancel={vi.fn()}
            mode={mode}
        />
    );
};

describe('QuestionEditorForm', () => {
    it('renders inline without a dialog or backdrop and edits through the shared dispatcher', () => {
        render(<ControlledForm mode="inline" />);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByTestId('question-editor-form')).toHaveAttribute('data-mode', 'inline');
        const prompt = screen.getByPlaceholderText('Nhập nội dung câu hỏi...');
        fireEvent.change(prompt, { target: { value: 'Câu hỏi đã sửa' } });
        expect(prompt).toHaveValue('Câu hỏi đã sửa');
        expect(screen.getByText('Các đáp án')).toBeInTheDocument();
    });

    it('keeps the modal wrapper to one accessible dialog', () => {
        const onCancel = vi.fn();
        render(
            <QuestionEditorModal
                editingQuestion={question}
                draft={initialDraft}
                onDraftChange={vi.fn()}
                onSave={vi.fn()}
                onCancel={onCancel}
            />,
        );

        expect(screen.getAllByRole('dialog')).toHaveLength(1);
        expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
        expect(screen.getAllByTestId('question-editor-backdrop')).toHaveLength(1);
        fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });
});

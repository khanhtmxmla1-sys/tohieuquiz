import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { QuestionType } from '../src/types';
import type { AnyEditorDraft } from '../src/features/quiz-editor/types/quiz-editor.types';
import QuestionEditorForm from '../src/features/quiz-editor/components/QuestionEditorModal/QuestionEditorForm';
import QuestionEditorModal from '../src/features/quiz-editor/components/QuestionEditorModal/QuestionEditorModal';

beforeAll(() => {
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
    Range.prototype.getBoundingClientRect = () => ({
        x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0,
        toJSON: () => ({}),
    }) as DOMRect;
});

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
        <>
            <QuestionEditorForm
                editingQuestion={question}
                draft={draft}
                onDraftChange={(updater) => setDraft((current) => updater(current))}
                onSave={vi.fn()}
                onCancel={vi.fn()}
                mode={mode}
            />
            <output data-testid="draft-json">{JSON.stringify(draft)}</output>
        </>
    );
};

describe('QuestionEditorForm', () => {
    it('renders inline with the rich prompt editor and keeps the shared dispatcher', async () => {
        render(<ControlledForm mode="inline" />);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByTestId('question-editor-form')).toHaveAttribute('data-mode', 'inline');
        expect(await screen.findByTestId('question-rich-editor')).toHaveTextContent('1 + 1 bằng bao nhiêu?');
        expect(screen.queryByPlaceholderText('Nhập nội dung câu hỏi...')).not.toBeInTheDocument();
        expect(screen.getByText('Các đáp án')).toBeInTheDocument();
    });

    it('updates rich presentation and the plain fallback together', async () => {
        render(<ControlledForm mode="inline" />);
        await screen.findByTestId('question-rich-editor');

        fireEvent.click(screen.getByRole('button', { name: 'Căn giữa' }));

        await waitFor(() => {
            const draft = JSON.parse(screen.getByTestId('draft-json').textContent || '{}');
            expect(draft.question).toBe('1 + 1 bằng bao nhiêu?');
            expect(draft.questionRichText?.schemaVersion).toBe(1);
            expect(draft.questionRichText?.doc?.content?.[0]?.attrs?.textAlign).toBe('center');
        });
    });

    it('collapses the optional attachment by default and expands it only on demand', async () => {
        render(<ControlledForm mode="inline" />);
        await screen.findByTestId('question-rich-editor');

        const addAttachment = screen.getByRole('button', { name: 'Thêm ảnh đính kèm' });
        expect(addAttachment).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText('Chọn, kéo thả hoặc dán ảnh')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Mô tả ảnh Ảnh đính kèm')).not.toBeInTheDocument();

        fireEvent.click(addAttachment);

        expect(screen.getByRole('button', { name: 'Thêm ảnh đính kèm' })).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('button', { name: /Chọn.*ảnh/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Dùng URL/i })).toBeInTheDocument();
    });

    it('keeps the modal wrapper to one accessible dialog', async () => {
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

        await screen.findByTestId('question-rich-editor');
        expect(screen.getAllByRole('dialog')).toHaveLength(1);
        expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
        expect(screen.getAllByTestId('question-editor-backdrop')).toHaveLength(1);
        fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });
});

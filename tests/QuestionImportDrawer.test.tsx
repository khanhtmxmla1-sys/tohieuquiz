import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuestionImportDrawer from '../src/features/manual-quiz-workspace/components/QuestionImportDrawer';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';

beforeEach(() => {
    useManualQuizWorkspaceStore.getState().reset();
    useManualQuizWorkspaceStore.getState().initializeFromSeed({
        title: 'Đề nhập',
        classLevel: '3',
        category: 'toan',
        timeLimit: 15,
        tags: [],
        requireCode: false,
        showOnHome: true,
    }, 'teacher-a');
});

describe('QuestionImportDrawer', () => {
    it('imports selected CSV questions and undoes exactly that transaction', async () => {
        render(<QuestionImportDrawer open onClose={vi.fn()} />);
        const csv = [
            'type,question,optionA,optionB,correctAnswer,difficulty,points',
            'MCQ,"1 + 2 = ?",2,3,B,1,1',
        ].join('\n');
        const file = new File([csv], 'questions.csv', { type: 'text/csv' });

        fireEvent.change(screen.getByLabelText('Chọn tệp câu hỏi'), {
            target: { files: [file] },
        });

        expect(await screen.findByText('1 + 2 = ?')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Nhập 1 câu đã chọn' }));

        await waitFor(() => {
            expect(useManualQuizWorkspaceStore.getState().envelope!.quiz.questions).toHaveLength(1);
        });
        expect(screen.getByRole('status')).toHaveTextContent('Đã nhập 1 câu');

        fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác nhập câu hỏi' }));
        expect(useManualQuizWorkspaceStore.getState().envelope!.quiz.questions).toHaveLength(0);
    });

    it('rejects unsupported files without changing the quiz', async () => {
        render(<QuestionImportDrawer open onClose={vi.fn()} />);
        const file = new File(['text'], 'questions.txt', { type: 'text/plain' });
        fireEvent.change(screen.getByLabelText('Chọn tệp câu hỏi'), {
            target: { files: [file] },
        });
        expect(await screen.findByRole('alert')).toHaveTextContent('Chỉ hỗ trợ CSV, XLSX hoặc DOCX');
        expect(useManualQuizWorkspaceStore.getState().envelope!.quiz.questions).toHaveLength(0);
    });

    it('previews pasted JSON, imports the selected questions and keeps undo working', async () => {
        render(<QuestionImportDrawer open onClose={vi.fn()} />);

        fireEvent.click(screen.getByRole('tab', { name: 'Dán JSON' }));
        expect(screen.getByRole('tab', { name: 'Dán JSON' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('button', { name: 'Sao chép JSON mẫu' })).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Dữ liệu JSON'), {
            target: {
                value: JSON.stringify([
                    {
                        type: 'multiple_choice',
                        question: '2 + 3 bằng bao nhiêu?',
                        options: ['4', '5', '6', '7'],
                        answer: '5',
                    },
                ]),
            },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra JSON' }));

        expect(await screen.findByText('2 + 3 bằng bao nhiêu?')).toBeInTheDocument();
        expect(screen.getByText('1 sẵn sàng')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Nhập 1 câu đã chọn' }));

        await waitFor(() => {
            expect(useManualQuizWorkspaceStore.getState().envelope!.quiz.questions).toHaveLength(1);
        });
        expect(useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0]).toEqual(expect.objectContaining({
            correctAnswer: 'B',
        }));

        fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác nhập câu hỏi' }));
        expect(useManualQuizWorkspaceStore.getState().envelope!.quiz.questions).toHaveLength(0);
    });

    it('shows a readable alert for invalid pasted JSON and does not change the quiz', () => {
        render(<QuestionImportDrawer open onClose={vi.fn()} />);

        fireEvent.click(screen.getByRole('tab', { name: 'Dán JSON' }));
        fireEvent.change(screen.getByLabelText('Dữ liệu JSON'), {
            target: { value: '{bad json' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra JSON' }));

        expect(screen.getByRole('alert')).toHaveTextContent('JSON không hợp lệ');
        expect(useManualQuizWorkspaceStore.getState().envelope!.quiz.questions).toHaveLength(0);
    });
});

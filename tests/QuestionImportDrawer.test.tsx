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

    it('keeps questionRichText when a pasted JSON question is imported into the workspace', async () => {
        const questionRichText = {
            schemaVersion: 1,
            doc: {
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        attrs: { textAlign: 'left' },
                        content: [{ type: 'text', text: 'Quan sát biểu thức.' }],
                    },
                    {
                        type: 'paragraph',
                        attrs: { textAlign: 'center' },
                        content: [{ type: 'text', text: '$12 \\div 3 = ?$', marks: [{ type: 'bold' }] }],
                    },
                ],
            },
        };
        const plainQuestion = 'Quan sát biểu thức.\n$12 \\div 3 = ?$';
        render(<QuestionImportDrawer open onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('tab', { name: 'Dán JSON' }));
        fireEvent.change(screen.getByLabelText('Dữ liệu JSON'), {
            target: {
                value: JSON.stringify([{
                    question_type: 'SINGLE_CHOICE',
                    question: plainQuestion,
                    questionRichText,
                    options: ['2', '3', '4', '6'],
                    correct_answer: 'C',
                }]),
            },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra JSON' }));

        expect(await screen.findByText('1 sẵn sàng')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Nhập 1 câu đã chọn' }));

        await waitFor(() => {
            expect(useManualQuizWorkspaceStore.getState().envelope!.quiz.questions).toHaveLength(1);
        });
        const imported = useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0] as any;
        expect(imported.question).toBe(plainQuestion);
        expect(imported.questionRichText).toEqual(questionRichText);
    });
    it('shows canonical short-answer and matching answers in JSON preview', async () => {
        render(<QuestionImportDrawer open onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('tab', { name: 'Dán JSON' }));
        fireEvent.change(screen.getByLabelText('Dữ liệu JSON'), {
            target: {
                value: JSON.stringify([
                    {
                        question_type: 'SHORT_ANSWER',
                        question: 'This is your book. It is _____.',
                        accepted_answers: ['yours'],
                    },
                    {
                        question_type: 'MATCHING',
                        question: 'Nối hai cột.',
                        left_items: [
                            { id: 'L1', text: 'my book' },
                            { id: 'L2', text: 'her doll' },
                        ],
                        right_items: [
                            { id: 'R1', text: 'hers' },
                            { id: 'R2', text: 'mine' },
                        ],
                        matches: [
                            { left: 'L1', right: 'R2' },
                            { left: 'L2', right: 'R1' },
                        ],
                    },
                ]),
            },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra JSON' }));

        expect(await screen.findByText('2 sẵn sàng')).toBeInTheDocument();
        expect(screen.getByLabelText('Đáp án đúng Câu JSON 1')).toHaveValue('yours');
        expect(screen.getByLabelText('Đáp án đúng Câu JSON 2')).toHaveValue('my book → mine; her doll → hers');
        expect(screen.queryByText(/Thiếu đáp án đúng/)).not.toBeInTheDocument();
    });
    it('keeps field-leaking DROPDOWN JSON out of the ready-to-import count', async () => {
        render(<QuestionImportDrawer open onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('tab', { name: 'Dán JSON' }));
        fireEvent.change(screen.getByLabelText('Dữ liệu JSON'), {
            target: {
                value: JSON.stringify([{
                    question_type: 'DROPDOWN',
                    question: 'Chọn từ thích hợp.\nCông cha {{select1}} núi Thái Sơn.',
                    content: 'Công cha {{select1}} núi Thái Sơn.',
                    dropdowns: [
                        { id: 'select1', options: ['như', 'tựa'], correct_answer: 'như' },
                    ],
                }]),
            },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra JSON' }));

        expect(await screen.findByText('0 sẵn sàng')).toBeInTheDocument();
        expect(screen.getByText('1 cần rà soát')).toBeInTheDocument();
        expect(screen.getByText(/^Câu DROPDOWN đang đưa \{\{select\.\.\.\}\} vào question/)).toBeInTheDocument();
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

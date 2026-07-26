import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType, type Question } from '../src/types';
import {
    cloneQuestionFromBank,
    filterTestBankItems,
} from '../src/features/quiz-editor/components/TestBankBrowser';
import QuestionBankDrawer from '../src/features/manual-quiz-workspace/components/QuestionBankDrawer';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';
import type { TestBankItem } from '../src/services/testBankService';

const bankMocks = vi.hoisted(() => ({
    getTestBank: vi.fn(),
    deleteQuestion: vi.fn(),
}));

vi.mock('../src/components/common/MathSpan', () => ({
    default: ({ content, as: Element = 'span', ...props }: any) => <Element {...props}>{content}</Element>,
}));

vi.mock('../src/services/testBankService', async () => {
    const actual = await vi.importActual<typeof import('../src/services/testBankService')>(
        '../src/services/testBankService',
    );
    return {
        ...actual,
        testBankService: {
            ...actual.testBankService,
            getTestBank: bankMocks.getTestBank,
            deleteQuestion: bankMocks.deleteQuestion,
        },
    };
});

const questionOne: Question = {
    id: 'bank-q-1',
    type: QuestionType.MCQ,
    question: String.raw`Tính \(\frac{1}{2}+\frac{1}{2}\)`,
    options: ['0', '1', '2', '3'],
    correctAnswer: 'B',
    difficulty: 1,
    subject: 'toan',
    skillCode: 'TOAN-PHAN-SO',
    tags: ['phân số'],
    explanation: String.raw`Vì \(\frac{1}{2}+\frac{1}{2}=1\).`,
    points: 2,
};

const questionTwo: Question = {
    id: 'bank-q-2',
    type: QuestionType.SHORT_ANSWER,
    question: 'Từ nào chỉ hoạt động?',
    correctAnswer: 'chạy',
    difficulty: 2,
    subject: 'tieng-viet',
    tags: ['động từ'],
    explanation: '“Chạy” là từ chỉ hoạt động.',
    points: 1,
};

const bankItems: TestBankItem[] = [
    {
        id: 'item-1',
        teacher_id: 'teacher-a',
        question_data: questionOne,
        tags: ['toán'],
        created_at: '2026-07-21T08:00:00.000Z',
    },
    {
        id: 'item-2',
        teacher_id: 'teacher-a',
        question_data: questionTwo,
        tags: ['tiếng việt'],
        created_at: '2026-07-21T09:00:00.000Z',
    },
];

beforeEach(() => {
    vi.clearAllMocks();
    bankMocks.getTestBank.mockResolvedValue(bankItems);
    bankMocks.deleteQuestion.mockResolvedValue(true);
    useManualQuizWorkspaceStore.getState().reset();
    useManualQuizWorkspaceStore.getState().initializeFromSeed({
        title: 'Đề kiểm tra',
        classLevel: '3',
        category: 'toan',
        timeLimit: 15,
        tags: [],
        requireCode: false,
        showOnHome: true,
    }, 'teacher-a');
});

describe('question bank browser helpers', () => {
    it('filters by keyword, type, difficulty and subject', () => {
        expect(filterTestBankItems(bankItems, {
            query: 'phân số',
            type: QuestionType.MCQ,
            difficulty: '1',
            subject: 'toan',
        })).toEqual([bankItems[0]]);

        expect(filterTestBankItems(bankItems, {
            query: 'hoạt động',
            type: 'all',
            difficulty: 'all',
            subject: 'tieng-viet',
        })).toEqual([bankItems[1]]);
    });

    it('clones a bank question with a new id while preserving metadata and LaTeX', () => {
        const clone = cloneQuestionFromBank(questionOne);
        expect(clone.id).not.toBe(questionOne.id);
        expect(clone.question).toBe(questionOne.question);
        expect(clone.explanation).toBe(questionOne.explanation);
        expect(clone.skillCode).toBe('TOAN-PHAN-SO');
        expect(clone.tags).toEqual(['phân số']);
        expect(clone.options).toEqual(questionOne.options);
        expect(clone.options).not.toBe(questionOne.options);
    });
});

describe('QuestionBankDrawer', () => {
    it('loads, filters, selects many questions and adds them in one store transaction', async () => {
        const onClose = vi.fn();
        render(<QuestionBankDrawer open teacherId="teacher-a" onClose={onClose} />);

        const dialog = await screen.findByRole('dialog', { name: 'Kho câu hỏi' });
        expect(bankMocks.getTestBank).toHaveBeenCalledWith('teacher-a');

        fireEvent.change(within(dialog).getByLabelText('Lọc theo môn'), {
            target: { value: 'toan' },
        });
        expect(within(dialog).getByText(/Tính/)).toBeInTheDocument();
        expect(within(dialog).queryByText('Từ nào chỉ hoạt động?')).not.toBeInTheDocument();

        fireEvent.change(within(dialog).getByLabelText('Lọc theo môn'), {
            target: { value: 'all' },
        });
        fireEvent.click(within(dialog).getByRole('checkbox', { name: /Tính/ }));
        fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Từ nào chỉ hoạt động?' }));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Thêm 2 câu vào đề' }));

        const questions = useManualQuizWorkspaceStore.getState().envelope!.quiz.questions;
        expect(questions).toHaveLength(2);
        expect(questions.map((question) => question.id)).not.toContain('bank-q-1');
        expect(questions.map((question) => question.id)).not.toContain('bank-q-2');
        expect(questions[0]).toEqual(expect.objectContaining({
            question: questionOne.question,
            explanation: questionOne.explanation,
            skillCode: 'TOAN-PHAN-SO',
            points: 2,
        }));
        expect(useManualQuizWorkspaceStore.getState().envelope!.selectedQuestionId).toBe(questions[1].id);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows service failures without closing the drawer', async () => {
        bankMocks.getTestBank.mockRejectedValueOnce(new Error('Không thể kết nối kho câu hỏi'));
        const onClose = vi.fn();
        render(<QuestionBankDrawer open teacherId="teacher-a" onClose={onClose} />);

        expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối kho câu hỏi');
        expect(onClose).not.toHaveBeenCalled();
    });
});

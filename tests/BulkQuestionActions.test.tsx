import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType } from '../src/types';
import BulkQuestionActions from '../src/features/manual-quiz-workspace/components/BulkQuestionActions';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';

const aiMocks = vi.hoisted(() => ({
    generateSmartDistractors: vi.fn(),
    explainAnswer: vi.fn(),
    saveQuestion: vi.fn(),
}));

vi.mock('../src/services/smartDistractorService', () => ({
    generateSmartDistractors: aiMocks.generateSmartDistractors,
}));
vi.mock('../src/services/aiTutorService', () => ({
    explainAnswer: aiMocks.explainAnswer,
}));
vi.mock('../src/services/testBankService', async () => {
    const actual = await vi.importActual<typeof import('../src/services/testBankService')>('../src/services/testBankService');
    return {
        ...actual,
        testBankService: {
            ...actual.testBankService,
            saveQuestion: aiMocks.saveQuestion,
        },
    };
});

const seedQuestions = () => {
    useManualQuizWorkspaceStore.getState().initializeFromSeed({
        title: 'Đề bulk',
        classLevel: '3',
        category: 'toan',
        timeLimit: 15,
        tags: [],
        requireCode: false,
        showOnHome: true,
    }, 'teacher-a');
    useManualQuizWorkspaceStore.getState().addQuestions([
        {
            id: 'q-1',
            type: QuestionType.MCQ,
            question: '1 + 1 = ?',
            options: ['1', '2', '5'],
            correctAnswer: 'B',
            difficulty: 1,
            points: 1,
        },
        {
            id: 'q-2',
            type: QuestionType.SHORT_ANSWER,
            question: '3 + 3 = ?',
            correctAnswer: '6',
            difficulty: 1,
            points: 1,
        },
    ] as any);
};

beforeEach(() => {
    vi.clearAllMocks();
    useManualQuizWorkspaceStore.getState().reset();
    seedQuestions();
    aiMocks.generateSmartDistractors.mockResolvedValue(['3', '4']);
    aiMocks.explainAnswer.mockResolvedValue({ explanation: 'Hai số hạng cộng lại bằng 2.', tip: 'Đếm thêm.' });
    aiMocks.saveQuestion.mockResolvedValue('bank-id');
});

describe('BulkQuestionActions', () => {
    it('previews bulk changes, applies them once and undoes the snapshot', () => {
        render(<BulkQuestionActions selectedIds={new Set(['q-1', 'q-2'])} teacherId="teacher-a" onClear={vi.fn()} />);

        fireEvent.change(screen.getByLabelText('Thao tác hàng loạt'), { target: { value: 'difficulty' } });
        fireEvent.change(screen.getByLabelText('Độ khó mới'), { target: { value: '3' } });
        fireEvent.click(screen.getByRole('button', { name: 'Xem trước thay đổi' }));

        expect(screen.getByRole('dialog', { name: 'Xác nhận thay đổi hàng loạt' })).toHaveTextContent('2 câu');
        expect(useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0].difficulty).toBe(1);
        fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }));
        expect(useManualQuizWorkspaceStore.getState().envelope!.quiz.questions.map((q) => q.difficulty)).toEqual([3, 3]);

        fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác thao tác hàng loạt' }));
        expect(useManualQuizWorkspaceStore.getState().envelope!.quiz.questions.map((q) => q.difficulty)).toEqual([1, 1]);
    });

    it('saves selected questions to the personal bank without changing the draft', async () => {
        const before = useManualQuizWorkspaceStore.getState().envelope!.quiz.questions;
        render(<BulkQuestionActions selectedIds={new Set(['q-1', 'q-2'])} teacherId="teacher-a" onClear={vi.fn()} />);
        fireEvent.change(screen.getByLabelText('Thao tác hàng loạt'), { target: { value: 'save-bank' } });
        fireEvent.click(screen.getByRole('button', { name: 'Xem trước thay đổi' }));
        fireEvent.click(screen.getByRole('button', { name: 'Áp dụng thay đổi' }));
        await waitFor(() => expect(aiMocks.saveQuestion).toHaveBeenCalledTimes(2));
        expect(useManualQuizWorkspaceStore.getState().envelope!.quiz.questions).toEqual(before);
    });

    it('keeps AI distractors as a proposal until the teacher accepts and never changes the correct answer', async () => {
        render(<BulkQuestionActions selectedIds={new Set(['q-1'])} teacherId="teacher-a" onClear={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'AI tạo đáp án nhiễu' }));

        expect(await screen.findByRole('dialog', { name: 'Duyệt đề xuất AI' })).toHaveTextContent('3');
        expect((useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0] as any).options).toEqual(['1', '2', '5']);
        fireEvent.click(screen.getByRole('button', { name: 'Từ chối đề xuất AI' }));
        expect((useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0] as any).options).toEqual(['1', '2', '5']);

        fireEvent.click(screen.getByRole('button', { name: 'AI tạo đáp án nhiễu' }));
        await screen.findByRole('dialog', { name: 'Duyệt đề xuất AI' });
        fireEvent.click(screen.getByRole('button', { name: 'Chấp nhận đề xuất AI' }));
        const updated = useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0] as any;
        expect(updated.correctAnswer).toBe('B');
        expect(updated.options).toEqual(['3', '2', '4']);
    });

    it('previews an AI explanation and writes it only after confirmation', async () => {
        render(<BulkQuestionActions selectedIds={new Set(['q-1'])} teacherId="teacher-a" onClear={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'AI tạo lời giải' }));
        expect(await screen.findByRole('dialog', { name: 'Duyệt lời giải AI' })).toHaveTextContent('Hai số hạng');
        expect(useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0].explanation).toBeUndefined();
        fireEvent.click(screen.getByRole('button', { name: 'Chấp nhận lời giải AI' }));
        expect(useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0].explanation).toBe('Hai số hạng cộng lại bằng 2.');
    });
});

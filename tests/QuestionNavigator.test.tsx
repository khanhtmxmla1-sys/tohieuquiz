import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType } from '../src/types';
import QuestionNavigator, {
    handleQuestionDragEnd,
} from '../src/features/manual-quiz-workspace/components/QuestionNavigator';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';

const seed = {
    title: 'Đề Toán lớp 4', classLevel: '4A', category: 'toan', timeLimit: 20,
    tags: [], requireCode: false, showOnHome: true,
};

const addQuestion = (id: string, prompt: string) => {
    useManualQuizWorkspaceStore.getState().addQuestion({
        id,
        type: QuestionType.MCQ,
        question: prompt,
        options: ['A', 'B'],
        correctAnswer: 'A',
        difficulty: 1,
        points: 1,
    });
};

const questionIds = () => useManualQuizWorkspaceStore.getState()
    .envelope!.quiz.questions.map((question) => question.id);

describe('QuestionNavigator operations', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        useManualQuizWorkspaceStore.getState().reset();
        useManualQuizWorkspaceStore.getState().initializeFromSeed(seed, 'teacher-a');
        addQuestion('q-1', 'Câu một');
        addQuestion('q-2', 'Câu hai');
        addQuestion('q-3', 'Câu ba');
    });

    it('reorders through the dnd-kit drag-end contract', () => {
        const reorder = vi.fn();
        handleQuestionDragEnd({
            active: { id: 'q-3' },
            over: { id: 'q-1' },
        } as any, reorder);

        expect(reorder).toHaveBeenCalledWith('q-3', 'q-1');
        handleQuestionDragEnd({ active: { id: 'q-1' }, over: null } as any, reorder);
        expect(reorder).toHaveBeenCalledTimes(1);
    });

    it('renders stable drag handles and moves questions with keyboard-friendly buttons', () => {
        render(<QuestionNavigator />);

        expect(screen.getByRole('button', { name: 'Kéo câu 1' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Di chuyển câu 2 lên' }));
        expect(questionIds()).toEqual(['q-2', 'q-1', 'q-3']);
        expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe('q-2');

        fireEvent.click(screen.getByRole('button', { name: 'Di chuyển câu 1 xuống' }));
        expect(questionIds()).toEqual(['q-1', 'q-2', 'q-3']);
    });

    it('duplicates with a new stable id and selects the copy', () => {
        render(<QuestionNavigator />);
        fireEvent.click(screen.getByRole('button', { name: 'Nhân bản câu 1' }));

        const ids = questionIds();
        expect(ids).toHaveLength(4);
        expect(ids[0]).toBe('q-1');
        expect(ids[1]).not.toBe('q-1');
        expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe(ids[1]);
    });

    it('undoes deletion into the exact position within eight seconds', () => {
        render(<QuestionNavigator />);
        fireEvent.click(screen.getByRole('button', { name: 'Xóa câu 2' }));

        expect(questionIds()).toEqual(['q-1', 'q-3']);
        const undoStatus = screen.getByRole('status', { name: 'Hoàn tác xóa câu hỏi' });
        expect(undoStatus).toHaveTextContent('Đã xóa câu 2');
        fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác xóa câu hỏi' }));

        expect(questionIds()).toEqual(['q-1', 'q-2', 'q-3']);
        expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe('q-2');
    });

    it('enters multi-select mode and exposes bulk actions after checking questions', () => {
        render(<QuestionNavigator teacherId="teacher-a" />);

        fireEvent.click(screen.getByRole('button', { name: 'Chọn nhiều câu hỏi' }));
        expect(screen.queryByRole('button', { name: 'Kéo câu 1' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn hàng loạt câu 1' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn hàng loạt câu 2' }));

        expect(screen.getByRole('region', { name: 'Bảng thao tác hàng loạt' })).toHaveTextContent('Đã chọn 2 câu');
        fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn tất cả' }));
        expect(screen.queryByRole('region', { name: 'Bảng thao tác hàng loạt' })).not.toBeInTheDocument();
    });

    it('expires the undo snapshot after eight seconds', () => {
        render(<QuestionNavigator />);
        fireEvent.click(screen.getByRole('button', { name: 'Xóa câu 2' }));

        act(() => vi.advanceTimersByTime(7_999));
        expect(screen.getByRole('button', { name: 'Hoàn tác xóa câu hỏi' })).toBeInTheDocument();
        act(() => vi.advanceTimersByTime(1));

        expect(screen.queryByRole('button', { name: 'Hoàn tác xóa câu hỏi' })).not.toBeInTheDocument();
        expect(questionIds()).toEqual(['q-1', 'q-3']);
    });
});

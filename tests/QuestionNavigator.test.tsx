import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType } from '../src/types';
import QuestionNavigator, {
    handleQuestionDragEnd,
} from '../src/features/manual-quiz-workspace/components/QuestionNavigator';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';

vi.mock('better-react-mathjax', () => ({
    MathJax: ({ children }: { children: React.ReactNode }) => <span data-testid="mathjax">{children}</span>,
    MathJaxContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

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

    it('declares a bounded independent scroll region for long question lists', () => {
        render(<QuestionNavigator />);

        const navigator = screen.getByRole('navigation', { name: 'Danh sách câu hỏi' });
        const scrollRegion = screen.getByTestId('question-navigator-scroll');
        expect(navigator).toHaveClass('h-full', 'min-h-0', 'overflow-hidden');
        expect(scrollRegion).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
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

    it('runs the page transition guard before selecting another question', () => {
        const guard = vi.fn(() => false);
        useManualQuizWorkspaceStore.getState().selectQuestion('q-1');
        render(<QuestionNavigator onBeforeAction={guard} />);

        fireEvent.click(screen.getByRole('button', { name: 'Chọn câu 2: Câu hai' }));

        expect(guard).toHaveBeenCalledTimes(1);
        expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe('q-1');
    });

    it('renders the full-width overview variant with status filtering and edit callback', () => {
        const onEditQuestion = vi.fn();
        render(
            <QuestionNavigator
                variant="overview"
                onEditQuestion={onEditQuestion}
                issues={[{ code: 'QUESTION_EMPTY', severity: 'error', message: 'Thiếu nội dung', questionId: 'q-2' }]}
            />,
        );

        expect(screen.getByRole('main', { name: 'Tổng quan câu hỏi' })).toHaveAttribute('data-question-navigator-variant', 'overview');
        expect(screen.getByRole('main', { name: 'Tổng quan câu hỏi' })).toHaveClass('h-auto', 'overflow-visible', 'lg:h-full', 'lg:overflow-hidden');
        expect(screen.getByTestId('question-navigator-scroll')).toHaveClass('flex-none', 'overflow-visible', 'lg:flex-1', 'lg:overflow-y-auto');
        expect(screen.getByRole('button', { name: 'Cần sửa' })).toBeInTheDocument();
        const secondRow = screen.getByRole('button', { name: /Chọn câu 2:/ }).closest('article');
        expect(secondRow).toHaveClass('lg:grid-cols-[auto_minmax(0,1fr)_180px_120px_auto]');
        expect(secondRow).not.toHaveClass('sm:grid-cols-[auto_minmax(0,1fr)_180px_120px_auto]');
        const firstRow = screen.getByRole('button', { name: /Chọn câu 1:/ }).closest('article');
        if (!firstRow) throw new Error('Expected the first overview row.');
        const summary = firstRow.querySelector('summary');
        if (!summary) throw new Error('Expected the row overflow menu.');
        fireEvent.click(summary);
        expect(within(firstRow).getByRole('button', { name: 'Nhân bản' })).toHaveClass('min-h-11', 'focus-visible:outline');
        fireEvent.click(screen.getByRole('button', { name: 'Sửa câu 2' }));
        expect(onEditQuestion).toHaveBeenCalledWith('q-2');

        fireEvent.click(screen.getByRole('button', { name: 'Cần sửa' }));
        expect(screen.queryByRole('button', { name: /Chọn câu 1:/ })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Chọn câu 2:/ })).toBeInTheDocument();
    });

    it('renders LaTeX summaries through the shared math renderer in overview rows', () => {
        useManualQuizWorkspaceStore.getState().updateQuestion('q-1', (question) => ({
            ...question,
            question: 'Mẹ cắt $\\frac{1}{4}$ tấm vải',
        }));

        render(<QuestionNavigator variant="overview" />);

        const firstRowButton = screen.getByRole('button', { name: /Chọn câu 1:/ });
        expect(within(firstRowButton).getByTestId('mathjax')).toHaveTextContent('$\\frac{1}{4}$');
    });

    it('keeps bulk selection reachable in the overview variant', () => {
        render(<QuestionNavigator variant="overview" />);

        fireEvent.click(screen.getByRole('button', { name: 'Chọn nhiều câu hỏi' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn hàng loạt câu 1' }));

        expect(screen.getByRole('region', { name: 'Bảng thao tác hàng loạt' })).toHaveTextContent('Đã chọn 1 câu');
        expect(screen.getByRole('button', { name: 'Thoát chọn nhiều câu hỏi' })).toBeInTheDocument();
    });

    it('highlights questions added after opening the question bank', async () => {
        const onOpenQuestionBank = vi.fn();
        const { container } = render(<QuestionNavigator variant="overview" onOpenQuestionBank={onOpenQuestionBank} />);

        fireEvent.click(screen.getByRole('button', { name: 'Kho câu hỏi' }));
        expect(onOpenQuestionBank).toHaveBeenCalledTimes(1);
        act(() => addQuestion('q-4', 'Câu mới từ kho'));

        expect(screen.getByText('Mới thêm')).toBeInTheDocument();
        expect(container.querySelector('[data-question-id="q-4"]')).toHaveAttribute('data-new-question', 'true');

        act(() => addQuestion('q-5', 'Câu thêm thường'));
        expect(container.querySelector('[data-question-id="q-5"]')).not.toHaveAttribute('data-new-question', 'true');
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

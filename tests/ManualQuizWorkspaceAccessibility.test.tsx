import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../stores/authStore';
import { QuestionType } from '../src/types';
import ManualQuizWorkspacePage from '../src/features/manual-quiz-workspace/ManualQuizWorkspacePage';
import { useWorkspaceKeyboardShortcuts } from '../src/features/manual-quiz-workspace/hooks/useWorkspaceKeyboardShortcuts';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';

const seed = {
    title: 'Đề accessibility', classLevel: '3', category: 'toan', timeLimit: 20,
    tags: [], requireCode: false, showOnHome: true,
};

const renderWorkspace = () => render(
    <MemoryRouter initialEntries={[{
        pathname: '/teacher/quizzes/manual/new',
        state: { manualQuizSeed: seed },
    }]}>
        <Routes>
            <Route path="/teacher/quizzes/manual/new" element={<ManualQuizWorkspacePage />} />
        </Routes>
    </MemoryRouter>,
);

const ShortcutHarness: React.FC<{
    onSave: () => void;
    onNext: () => void;
    onMove: (offset: -1 | 1) => void;
    onEscape: () => void;
}> = ({ onSave, onNext, onMove, onEscape }) => {
    useWorkspaceKeyboardShortcuts({
        onSaveDraft: onSave,
        onSaveQuestionAndNext: onNext,
        onMoveQuestion: onMove,
        onEscape,
    });
    return <div>Shortcut harness</div>;
};

describe('manual quiz keyboard shortcuts', () => {
    it('supports save, save-and-next, move and escape while ignoring IME composition', () => {
        const onSave = vi.fn();
        const onNext = vi.fn();
        const onMove = vi.fn();
        const onEscape = vi.fn();
        render(<ShortcutHarness onSave={onSave} onNext={onNext} onMove={onMove} onEscape={onEscape} />);

        fireEvent.keyDown(window, { key: 's', ctrlKey: true });
        fireEvent.keyDown(window, { key: 'Enter', metaKey: true });
        fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true });
        fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true });
        fireEvent.keyDown(window, { key: 'Escape' });
        fireEvent.keyDown(window, { key: 's', ctrlKey: true, isComposing: true });

        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onNext).toHaveBeenCalledTimes(1);
        expect(onMove.mock.calls).toEqual([[-1], [1]]);
        expect(onEscape).toHaveBeenCalledTimes(1);
    });
});

describe('ManualQuizWorkspace focus and screen-reader access', () => {
    beforeEach(() => {
        localStorage.clear();
        useManualQuizWorkspaceStore.getState().reset();
        useAuthStore.setState({
            isLoggedIn: true,
            username: 'teacher-accessible',
            teacherName: 'Cô Accessible',
            isAdmin: false,
        });
    });

    it('traps focus in the publish drawer, closes with Escape and returns focus to the trigger', async () => {
        renderWorkspace();
        const trigger = await screen.findByRole('button', { name: 'Kiểm tra và xuất bản' });
        trigger.focus();
        fireEvent.click(trigger);

        const dialog = screen.getByRole('dialog', { name: 'Kiểm tra trước khi xuất bản' });
        const close = screen.getByRole('button', { name: 'Đóng kiểm tra xuất bản' });
        expect(close).toHaveFocus();

        fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
        expect(dialog).toContainElement(document.activeElement as HTMLElement);

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('dialog', { name: 'Kiểm tra trước khi xuất bản' })).not.toBeInTheDocument();
        await waitFor(() => expect(trigger).toHaveFocus());
    });

    it('saves the current question, advances and restores editor focus with Ctrl+Enter', async () => {
        renderWorkspace();
        await screen.findByRole('main', { name: 'Trình soạn câu hỏi' });
        await waitFor(() => expect(screen.getByLabelText('Tên đề kiểm tra')).toHaveValue('Đề accessibility'));
        act(() => {
            useManualQuizWorkspaceStore.getState().addQuestions([
                {
                    id: 'q-access-1', type: QuestionType.MCQ, question: 'Câu một',
                    options: ['A', 'B'], correctAnswer: 'A', difficulty: 1, points: 1,
                },
                {
                    id: 'q-access-2', type: QuestionType.SHORT_ANSWER, question: 'Câu hai',
                    correctAnswer: 'Hai', difficulty: 1, points: 1,
                },
            ] as any);
            useManualQuizWorkspaceStore.getState().selectQuestion('q-access-1');
        });

        const editor = await screen.findByPlaceholderText('Nhập nội dung câu hỏi...');
        fireEvent.change(editor, { target: { value: 'Câu một đã sửa' } });
        fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });

        await waitFor(() => {
            const state = useManualQuizWorkspaceStore.getState().envelope!;
            expect(state.selectedQuestionId).toBe('q-access-2');
            expect((state.quiz.questions[0] as any).question).toBe('Câu một đã sửa');
        });
        await waitFor(() => expect(screen.getByPlaceholderText('Nhập nội dung câu hỏi...')).toHaveFocus());
    });

    it('keeps live regions and keyboard alternatives available at high zoom', async () => {
        renderWorkspace();
        await screen.findByRole('main', { name: 'Trình soạn câu hỏi' });
        expect(screen.getByText(/Đã tự động lưu|Chưa lưu thay đổi mới/).closest('[aria-live="polite"]')).toBeInTheDocument();
        expect(screen.getByRole('status', { name: 'Trạng thái đề kiểm tra' })).toHaveAttribute('aria-live', 'polite');
        expect(screen.getByRole('button', { name: 'Kiểm tra và xuất bản' })).toHaveClass('h-11');
    });
});

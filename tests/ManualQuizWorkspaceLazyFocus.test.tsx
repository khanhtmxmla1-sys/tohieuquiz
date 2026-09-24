import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../stores/authStore';
import { QuestionType } from '../src/types';
import ManualQuizWorkspacePage from '../src/features/manual-quiz-workspace/ManualQuizWorkspacePage';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';

vi.mock('../src/features/quiz-editor/components/RichQuestionEditor/RichQuestionEditor', () => ({
    default: ({ onEditorReady }: { onEditorReady?: () => void }) => {
        const [ready, setReady] = React.useState(false);

        React.useEffect(() => {
            const timer = window.setTimeout(() => setReady(true), 40);
            return () => window.clearTimeout(timer);
        }, []);

        React.useEffect(() => {
            if (ready) onEditorReady?.();
        }, [onEditorReady, ready]);

        if (!ready) return <div aria-busy="true" />;
        return <div data-testid="question-rich-editor" aria-label="Nội dung câu hỏi" tabIndex={0} />;
    },
}));

const seed = {
    title: 'Đề lazy focus', classLevel: '3', category: 'toan', timeLimit: 20,
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

describe('manual workspace lazy editor focus', () => {
    beforeAll(() => {
        Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
        Range.prototype.getBoundingClientRect = () => ({
            x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0,
            toJSON: () => ({}),
        }) as DOMRect;
    });

    beforeEach(() => {
        localStorage.clear();
        useManualQuizWorkspaceStore.getState().reset();
        useAuthStore.setState({
            isLoggedIn: true,
            username: 'teacher-lazy-focus',
            teacherName: 'Cô Lazy Focus',
            isAdmin: false,
        });
    });

    it('focuses the rich editor when an existing question editor mounts late', async () => {
        renderWorkspace();
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });
        act(() => {
            useManualQuizWorkspaceStore.getState().addQuestion({
                id: 'q-lazy-existing', type: QuestionType.MCQ, question: 'Câu mount muộn',
                options: ['A', 'B'], correctAnswer: 'A', difficulty: 1, points: 1,
            } as any);
        });

        fireEvent.click(await screen.findByRole('button', { name: 'Sửa câu 1' }));

        await waitFor(() => expect(screen.getByTestId('question-rich-editor')).toHaveFocus(), { timeout: 2000 });
    }, 10_000);

    it('waits for the rich editor instead of focusing a temporary fallback field', async () => {
        renderWorkspace();
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });
        act(() => {
            useManualQuizWorkspaceStore.getState().addQuestion({
                id: 'q-lazy-no-fallback', type: QuestionType.MCQ, question: 'Câu không focus tạm',
                options: ['A', 'B'], correctAnswer: 'A', difficulty: 1, points: 1,
            } as any);
        });

        fireEvent.click(await screen.findByRole('button', { name: 'Sửa câu 1' }));
        await screen.findByRole('main', { name: 'Trình soạn câu hỏi' });
        await new Promise((resolve) => window.setTimeout(resolve, 10));

        const provisionalFocus = document.activeElement as HTMLElement | null;
        if (provisionalFocus?.closest('[aria-label="Trình soạn câu hỏi"]')) {
            expect(provisionalFocus).toHaveAttribute('data-testid', 'question-rich-editor');
        }
        await waitFor(() => expect(screen.getByTestId('question-rich-editor')).toHaveFocus(), { timeout: 2000 });
    }, 10_000);

    it('focuses the rich editor when a quick-added question editor mounts late', async () => {
        renderWorkspace();
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });

        fireEvent.click(screen.getByRole('button', { name: 'Thêm nhanh Trắc nghiệm' }));

        await waitFor(() => expect(screen.getByTestId('question-rich-editor')).toHaveFocus(), { timeout: 2000 });
    }, 10_000);

    it('does not steal focus after the teacher moves to another field while the editor loads', async () => {
        renderWorkspace();
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });
        act(() => {
            useManualQuizWorkspaceStore.getState().addQuestion({
                id: 'q-lazy-user-moved', type: QuestionType.MCQ, question: 'Câu người dùng chuyển focus',
                options: ['A', 'B'], correctAnswer: 'A', difficulty: 1, points: 1,
            } as any);
        });

        fireEvent.click(await screen.findByRole('button', { name: 'Sửa câu 1' }));
        const pointsInput = await screen.findByRole('spinbutton', { name: 'Điểm câu hỏi' });
        act(() => pointsInput.focus());

        await screen.findByTestId('question-rich-editor');
        await new Promise((resolve) => window.setTimeout(resolve, 80));
        expect(pointsInput).toHaveFocus();
    }, 10_000);

    it('focuses the delayed rich editor after next and previous transitions', async () => {
        renderWorkspace();
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });
        act(() => {
            useManualQuizWorkspaceStore.getState().addQuestions([
                {
                    id: 'q-lazy-next-1', type: QuestionType.MCQ, question: 'Câu trước',
                    options: ['A', 'B'], correctAnswer: 'A', difficulty: 1, points: 1,
                },
                {
                    id: 'q-lazy-next-2', type: QuestionType.MCQ, question: 'Câu sau',
                    options: ['A', 'B'], correctAnswer: 'B', difficulty: 1, points: 1,
                },
            ] as any);
        });

        fireEvent.click(await screen.findByRole('button', { name: 'Sửa câu 1' }));
        await screen.findByTestId('question-rich-editor');

        fireEvent.click(screen.getByRole('button', { name: 'Lưu và câu sau' }));
        await waitFor(() => expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe('q-lazy-next-2'));
        await waitFor(() => expect(screen.getByTestId('question-rich-editor')).toHaveFocus(), { timeout: 2000 });

        fireEvent.click(screen.getByRole('button', { name: 'Câu trước' }));
        await waitFor(() => expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe('q-lazy-next-1'));
        await waitFor(() => expect(screen.getByTestId('question-rich-editor')).toHaveFocus(), { timeout: 2000 });
    }, 15_000);

    it('ignores a pending editor focus when the workspace view changes before mount', async () => {
        renderWorkspace();
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });
        act(() => {
            useManualQuizWorkspaceStore.getState().addQuestion({
                id: 'q-lazy-view-change', type: QuestionType.MCQ, question: 'Câu đổi chế độ',
                options: ['A', 'B'], correctAnswer: 'A', difficulty: 1, points: 1,
            } as any);
        });

        fireEvent.click(await screen.findByRole('button', { name: 'Sửa câu 1' }));
        fireEvent.click(screen.getByRole('button', { name: 'Xem trước' }));
        expect(screen.getByTestId('workspace-view-preview')).toBeVisible();
        const titleInput = screen.getByLabelText('Tên đề kiểm tra');
        act(() => titleInput.focus());

        await screen.findByTestId('question-rich-editor');
        await new Promise((resolve) => window.setTimeout(resolve, 80));
        expect(titleInput).toHaveFocus();
    }, 10_000);

    it('ignores a pending editor focus when the selected question changes', async () => {
        renderWorkspace();
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });
        act(() => {
            useManualQuizWorkspaceStore.getState().addQuestions([
                {
                    id: 'q-lazy-selection-1', type: QuestionType.MCQ, question: 'Câu bị thay thế',
                    options: ['A', 'B'], correctAnswer: 'A', difficulty: 1, points: 1,
                },
                {
                    id: 'q-lazy-selection-2', type: QuestionType.MCQ, question: 'Câu mới được chọn',
                    options: ['A', 'B'], correctAnswer: 'B', difficulty: 1, points: 1,
                },
            ] as any);
        });

        fireEvent.click(await screen.findByRole('button', { name: 'Sửa câu 1' }));
        act(() => useManualQuizWorkspaceStore.getState().selectQuestion('q-lazy-selection-2'));

        await screen.findByTestId('question-rich-editor');
        await new Promise((resolve) => window.setTimeout(resolve, 80));
        expect(document.activeElement?.closest('[data-testid="workspace-view-edit"]')).not.toBeInTheDocument();
    }, 10_000);

    it('does not run a delayed focus callback after the workspace unmounts', async () => {
        const view = renderWorkspace();
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });
        act(() => {
            useManualQuizWorkspaceStore.getState().addQuestion({
                id: 'q-lazy-unmount', type: QuestionType.MCQ, question: 'Câu unmount',
                options: ['A', 'B'], correctAnswer: 'A', difficulty: 1, points: 1,
            } as any);
        });

        fireEvent.click(await screen.findByRole('button', { name: 'Sửa câu 1' }));
        view.unmount();
        await new Promise((resolve) => window.setTimeout(resolve, 80));
        expect(document.querySelector('[data-testid="question-rich-editor"]')).not.toBeInTheDocument();
    }, 10_000);
});

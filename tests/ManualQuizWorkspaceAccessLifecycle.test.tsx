import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../stores/authStore';
import { useQuizStore } from '../stores/quizStore';
import { QuestionType } from '../src/types';
import { useClassStore } from '../src/stores/useClassStore';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';

const editorService = vi.hoisted(() => ({
    getQuizEditorPayload: vi.fn(),
    createQuizVersion: vi.fn(),
}));
vi.mock('../src/features/manual-quiz-workspace/services/quizEditorService', () => editorService);

import ManualQuizWorkspacePage from '../src/features/manual-quiz-workspace/ManualQuizWorkspacePage';

type Deferred<T> = {
    promise: Promise<T>;
    resolve(value: T): void;
    reject(error: unknown): void;
};

const deferred = <T,>(): Deferred<T> => {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
};

const editability = {
    mode: 'EDIT' as const,
    canEditStructure: true,
    canCreateVersion: true,
    reason: null,
    requiresPublishedWarning: false,
    resultCount: 0,
    activeLiveExamCount: 0,
    openAssignmentCount: 0,
};

const readonlyEditability = {
    ...editability,
    mode: 'READONLY' as const,
    canEditStructure: false,
    reason: 'HAS_SUBMISSIONS' as const,
    resultCount: 2,
    openAssignmentCount: 1,
};

const quiz = {
    id: 'quiz-access',
    title: 'Đề quyền truy cập',
    classLevel: '4',
    category: 'toan',
    timeLimit: 20,
    createdAt: '2026-08-01T00:00:00.000Z',
    createdBy: 'teacher-a',
    questions: [],
    sourceType: 'ai' as const,
    parentQuizId: null,
    versionNumber: 1,
    revision: 4,
};

const payloadFor = (overrides: Record<string, unknown> = {}) => ({
    quiz: { ...quiz, ...(overrides.quiz as Record<string, unknown> | undefined) },
    questions: overrides.questions ?? [],
    editability: overrides.editability ?? editability,
});

const RouteSwitcher = ({ to }: { to: string }) => {
    const navigate = useNavigate();
    return <button type="button" onClick={() => navigate(to)}>switch route</button>;
};

const renderEditRoute = (entry = '/teacher/quizzes/quiz-access/edit', controls?: React.ReactNode) => render(
    <MemoryRouter initialEntries={[entry]}>
        <Routes>
            <Route path="/teacher/quizzes/:quizId/edit" element={<ManualQuizWorkspacePage />} />
        </Routes>
        {controls}
    </MemoryRouter>,
);

describe('ManualQuizWorkspace access lifecycle characterization', () => {
    beforeEach(() => {
        editorService.getQuizEditorPayload.mockReset();
        editorService.createQuizVersion.mockReset();
        localStorage.clear();
        useManualQuizWorkspaceStore.getState().reset();
        useAuthStore.setState({
            isLoggedIn: true,
            username: 'teacher-a',
            teacherName: 'Cô A',
            isAdmin: false,
        });
        useClassStore.setState({
            classes: [],
            isLoading: false,
            error: null,
            fetchClasses: async () => undefined,
        });
        useQuizStore.setState({
            quizzes: [],
            selectedQuiz: null,
            quizzesLoadedAt: null,
            loadQuizzes: vi.fn(async () => undefined),
        });
    });

    it('normalizes editor questions, upserts the catalog and hydrates the workspace', async () => {
        editorService.getQuizEditorPayload.mockResolvedValue({
            ...payloadFor({ editability }),
            questions: [{
                id: 'q-normalized',
                type: QuestionType.MCQ,
                main_question: 'Câu hỏi chuẩn hóa',
                options: 'A|B',
                correct_answer: 'option-1',
                difficulty: 1,
                points: 5,
            }],
        });

        renderEditRoute();

        await waitFor(() => expect(useQuizStore.getState().quizzes).toHaveLength(1));
        const storedQuiz = useQuizStore.getState().quizzes[0];
        expect(storedQuiz).toMatchObject({ id: quiz.id, title: quiz.title });
        expect(storedQuiz.questions[0]).toMatchObject({
            id: 'q-normalized',
            options: ['A', 'B'],
            correctAnswer: 'B',
            mainQuestion: 'Câu hỏi chuẩn hóa',
        });
        await waitFor(() => expect(useManualQuizWorkspaceStore.getState().envelope?.quiz.questions[0]).toMatchObject({
            id: 'q-normalized',
            options: ['A', 'B'],
            correctAnswer: 'B',
        }));
    });

    it('preserves the selected catalog quiz while replacing its payload with normalized data', async () => {
        const catalogQuiz = { ...quiz, title: 'Tiêu đề cũ trong danh mục' };
        useQuizStore.setState({ quizzes: [catalogQuiz], selectedQuiz: catalogQuiz });
        editorService.getQuizEditorPayload.mockResolvedValue({
            ...payloadFor({ editability }),
            quiz: { ...quiz, title: 'Tiêu đề mới từ trình soạn' },
            questions: [{
                id: 'q-selected',
                type: QuestionType.MCQ,
                options: 'A|B',
                correct_answer: 'A',
            }],
        });

        renderEditRoute();

        await waitFor(() => expect(useQuizStore.getState().selectedQuiz?.title).toBe('Tiêu đề mới từ trình soạn'));
        expect(useQuizStore.getState().selectedQuiz?.id).toBe(quiz.id);
        expect(useQuizStore.getState().selectedQuiz).toBe(useQuizStore.getState().quizzes[0]);
        expect(useQuizStore.getState().selectedQuiz?.questions[0].options).toEqual(['A', 'B']);
    });

    it('renders readonly access success without opening an editable workspace', async () => {
        editorService.getQuizEditorPayload.mockResolvedValue({ ...payloadFor({ editability: readonlyEditability }) });

        renderEditRoute();

        expect(await screen.findByRole('alert')).toHaveTextContent('đã có 2 bài nộp');
        expect(screen.getByText('Chỉ đọc – dữ liệu gốc được bảo vệ')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Tạo phiên bản mới để chỉnh sửa' })).toBeEnabled();
    });

    it('shows the Error rejection message from the access request', async () => {
        editorService.getQuizEditorPayload.mockRejectedValue(new Error('permission denied'));

        renderEditRoute();

        expect(await screen.findByRole('alert')).toHaveTextContent('Không thể mở Trình soạn đề: permission denied');
    });

    it('uses the original fallback for a non-Error access rejection', async () => {
        editorService.getQuizEditorPayload.mockRejectedValue('network sentinel');

        renderEditRoute();

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Không thể mở Trình soạn đề: Không thể tải quyền chỉnh sửa đề.',
        );
    });

    it('ignores a late access resolution after the route changes and does not reset the existing workspace', async () => {
        useManualQuizWorkspaceStore.getState().initializeFromSeed({
            title: 'Bản nháp đang mở',
            classLevel: '4',
            category: 'toan',
            timeLimit: 15,
            tags: [],
            requireCode: false,
            showOnHome: true,
        }, 'teacher-a');
        const existingDraftId = useManualQuizWorkspaceStore.getState().envelope?.draftId;
        const first = deferred<ReturnType<typeof payloadFor>>();
        const second = deferred<ReturnType<typeof payloadFor>>();
        editorService.getQuizEditorPayload
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);

        renderEditRoute('/teacher/quizzes/quiz-access/edit', <RouteSwitcher to="/teacher/quizzes/quiz-next/edit" />);
        await waitFor(() => expect(editorService.getQuizEditorPayload).toHaveBeenCalledWith('quiz-access'));
        fireEvent.click(screen.getByRole('button', { name: 'switch route' }));
        await waitFor(() => expect(editorService.getQuizEditorPayload).toHaveBeenCalledWith('quiz-next'));

        await act(async () => {
            first.resolve(payloadFor({ quiz: { id: 'quiz-access' } }));
            await Promise.resolve();
        });
        expect(useQuizStore.getState().quizzes).toEqual([]);
        expect(useManualQuizWorkspaceStore.getState().envelope?.draftId).toBe(existingDraftId);

        await act(async () => {
            second.resolve(payloadFor({ quiz: { id: 'quiz-next', title: 'Đề tiếp theo' } }));
            await Promise.resolve();
        });
        await waitFor(() => expect(useQuizStore.getState().quizzes[0]?.id).toBe('quiz-next'));
    });

    it('ignores a late access rejection after the username changes', async () => {
        const first = deferred<ReturnType<typeof payloadFor>>();
        const second = deferred<ReturnType<typeof payloadFor>>();
        editorService.getQuizEditorPayload
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);

        renderEditRoute();
        await waitFor(() => expect(editorService.getQuizEditorPayload).toHaveBeenCalledTimes(1));
        act(() => useAuthStore.setState({ username: 'teacher-b' }));
        await waitFor(() => expect(editorService.getQuizEditorPayload).toHaveBeenCalledTimes(2));

        await act(async () => {
            first.reject(new Error('stale access rejection'));
            await Promise.resolve();
        });
        expect(useQuizStore.getState().quizzes).toEqual([]);

        await act(async () => {
            second.resolve(payloadFor({ quiz: { id: 'quiz-access', createdBy: 'teacher-b' } }));
            await Promise.resolve();
        });
        await waitFor(() => expect(useManualQuizWorkspaceStore.getState().envelope?.ownerUsername).toBe('teacher-b'));
        expect(screen.queryByText('stale access rejection')).not.toBeInTheDocument();
    });

    it('ignores access resolution and rejection after unmount', async () => {
        const first = deferred<ReturnType<typeof payloadFor>>();
        const second = deferred<ReturnType<typeof payloadFor>>();
        editorService.getQuizEditorPayload
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);

        const firstRender = renderEditRoute();
        await waitFor(() => expect(editorService.getQuizEditorPayload).toHaveBeenCalledTimes(1));
        firstRender.unmount();
        await act(async () => {
            first.resolve(payloadFor());
            await Promise.resolve();
        });
        expect(useQuizStore.getState().quizzes).toEqual([]);

        const secondRender = renderEditRoute();
        await waitFor(() => expect(editorService.getQuizEditorPayload).toHaveBeenCalledTimes(2));
        secondRender.unmount();
        await act(async () => {
            second.reject(new Error('late unmounted rejection'));
            await Promise.resolve();
        });
        expect(useQuizStore.getState().quizzes).toEqual([]);
    });
});

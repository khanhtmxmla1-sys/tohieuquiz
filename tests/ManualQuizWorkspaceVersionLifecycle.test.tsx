import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../stores/authStore';
import { useQuizStore } from '../stores/quizStore';
import { QuestionType } from '../src/types';
import { useClassStore } from '../src/stores/useClassStore';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';
import type { QuizEditorEditability } from '../src/features/manual-quiz-workspace/types/manualQuizWorkspace.types';

const editorService = vi.hoisted(() => ({
    getQuizEditorPayload: vi.fn(),
    createQuizVersion: vi.fn(),
}));
const editorPaneState = vi.hoisted(() => ({
    flushCalls: 0,
    flushResult: { ok: true } as { ok: boolean; error?: string },
}));

vi.mock('../src/features/manual-quiz-workspace/services/quizEditorService', () => editorService);
vi.mock('../src/features/manual-quiz-workspace/components/QuestionEditorPane', async () => {
    const ReactModule = await import('react');
    const MockQuestionEditorPane = ReactModule.forwardRef<any, any>((_props, ref) => {
        ReactModule.useImperativeHandle(ref, () => ({
            flush: () => {
                editorPaneState.flushCalls += 1;
                return { ...editorPaneState.flushResult };
            },
            getPreviewQuestion: () => null,
        }), []);
        return ReactModule.createElement('div', { 'data-testid': 'mock-question-editor' });
    });
    return { default: MockQuestionEditorPane };
});

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

const quiz = {
    id: 'quiz-version',
    title: 'Đề phiên bản',
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

const readonlyEditability = {
    mode: 'READONLY' as const,
    canEditStructure: false,
    canCreateVersion: true,
    reason: 'HAS_SUBMISSIONS' as const,
    requiresPublishedWarning: false,
    resultCount: 2,
    activeLiveExamCount: 0,
    openAssignmentCount: 1,
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

const question = {
    id: 'q-version',
    type: QuestionType.MCQ,
    question: 'Câu hỏi phiên bản',
    options: ['A', 'B'],
    correctAnswer: 'A',
    difficulty: 1,
    points: 5,
};

const payloadFor = (
    editabilityOverride: QuizEditorEditability = readonlyEditability,
    quizOverride = quiz,
) => ({
    quiz: quizOverride,
    questions: [question],
    editability: editabilityOverride,
});

const version = {
    id: 'quiz-version-2',
    title: 'Đề phiên bản - Bản chỉnh sửa',
    parentQuizId: quiz.id,
    versionNumber: 2,
    revision: 1,
};

const LocationProbe = () => {
    const location = useLocation();
    return <span data-testid="location">{location.pathname}</span>;
};

const HistoryBack = () => {
    const navigate = useNavigate();
    return <button type="button" onClick={() => navigate(-1)}>history back</button>;
};

const renderWorkspace = (entries: string[] = ['/teacher/quizzes/quiz-version/edit'], controls?: React.ReactNode) => render(
    <MemoryRouter initialEntries={entries}>
        <Routes>
            <Route path="/teacher/quizzes/:quizId/edit" element={<ManualQuizWorkspacePage />} />
        </Routes>
        <LocationProbe />
        {controls}
    </MemoryRouter>,
);

describe('ManualQuizWorkspace version lifecycle characterization', () => {
    beforeEach(() => {
        editorService.getQuizEditorPayload.mockReset();
        editorService.createQuizVersion.mockReset();
        editorPaneState.flushCalls = 0;
        editorPaneState.flushResult = { ok: true };
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

    it('stops version creation when the existing editor guard fails', async () => {
        editorPaneState.flushResult = { ok: false, error: 'draft cannot be saved' };
        editorService.getQuizEditorPayload.mockResolvedValue(payloadFor());

        renderWorkspace();

        const createButton = await screen.findByRole('button', { name: 'Tạo phiên bản mới để chỉnh sửa' });
        fireEvent.click(createButton);

        expect(editorPaneState.flushCalls).toBe(1);
        expect(editorService.createQuizVersion).not.toHaveBeenCalled();
        expect(createButton).toBeEnabled();
    });

    it('resets, replaces the route and tolerates best-effort catalog refresh failure after success', async () => {
        const nextAccess = deferred<ReturnType<typeof payloadFor>>();
        const creating = deferred<typeof version>();
        const loadQuizzes = vi.fn(async () => { throw new Error('catalog refresh failed'); });
        editorService.getQuizEditorPayload
            .mockResolvedValueOnce(payloadFor())
            .mockReturnValueOnce(nextAccess.promise);
        editorService.createQuizVersion.mockReturnValueOnce(creating.promise);
        useQuizStore.setState({ loadQuizzes });

        renderWorkspace(['/teacher/quizzes/manage', '/teacher/quizzes/quiz-version/edit'], <HistoryBack />);
        const createButton = await screen.findByRole('button', { name: 'Tạo phiên bản mới để chỉnh sửa' });
        act(() => useManualQuizWorkspaceStore.getState().updateQuiz({ title: 'Tiêu đề bản nháp hiện tại' }));
        fireEvent.click(createButton);
        expect(editorService.createQuizVersion).toHaveBeenCalledWith(
            quiz.id,
            'Tiêu đề bản nháp hiện tại - Bản chỉnh sửa',
        );

        await act(async () => {
            creating.resolve(version);
            await Promise.resolve();
        });
        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/teacher/quizzes/quiz-version-2/edit'));
        expect(useManualQuizWorkspaceStore.getState().envelope).toBeNull();
        expect(loadQuizzes).toHaveBeenCalledWith({ force: true, includeQuestions: true });
        expect(screen.queryByText('catalog refresh failed')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'history back' }));
        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/teacher/quizzes/manage'));

        await act(async () => {
            nextAccess.resolve(payloadFor(editability));
            await Promise.resolve();
        });
    });

    it('clears the busy state after rejection and allows a retry', async () => {
        editorService.getQuizEditorPayload.mockResolvedValue(payloadFor());
        editorService.createQuizVersion
            .mockRejectedValueOnce(new Error('version rejected'))
            .mockResolvedValueOnce(version);

        renderWorkspace();
        const createButton = await screen.findByRole('button', { name: 'Tạo phiên bản mới để chỉnh sửa' });
        fireEvent.click(createButton);
        expect(await screen.findByText('version rejected')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Tạo phiên bản mới để chỉnh sửa' })).toBeEnabled());

        fireEvent.click(screen.getByRole('button', { name: 'Tạo phiên bản mới để chỉnh sửa' }));
        await waitFor(() => expect(editorService.createQuizVersion).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/teacher/quizzes/quiz-version-2/edit'));
    });

    it('clears a version error through the page-owned access error when access reloads', async () => {
        editorService.getQuizEditorPayload.mockResolvedValue(payloadFor());
        editorService.createQuizVersion.mockRejectedValue(new Error('version error'));

        renderWorkspace();
        fireEvent.click(await screen.findByRole('button', { name: 'Tạo phiên bản mới để chỉnh sửa' }));
        expect(await screen.findByText('version error')).toBeInTheDocument();

        act(() => useAuthStore.setState({ username: 'teacher-b' }));
        await waitFor(() => expect(editorService.getQuizEditorPayload).toHaveBeenCalledTimes(2));
        expect(screen.queryByText('version error')).not.toBeInTheDocument();
    });

    it('keeps the original busy button state while a version request is pending', async () => {
        const creating = deferred<typeof version>();
        editorService.getQuizEditorPayload.mockResolvedValue(payloadFor());
        editorService.createQuizVersion.mockReturnValue(creating.promise);

        renderWorkspace();
        const createButton = await screen.findByRole('button', { name: 'Tạo phiên bản mới để chỉnh sửa' });
        fireEvent.click(createButton);

        expect(await screen.findByRole('button', { name: 'Đang tạo phiên bản…' })).toBeDisabled();
        expect(editorService.createQuizVersion).toHaveBeenCalledTimes(1);
        await act(async () => {
            creating.resolve(version);
            await Promise.resolve();
        });
    });

    it('uses the exact default title when the access payload and workspace title are empty', async () => {
        editorService.getQuizEditorPayload.mockResolvedValue(payloadFor(
            readonlyEditability,
            { ...quiz, title: '' },
        ));
        editorService.createQuizVersion.mockRejectedValue(new Error('capture title only'));

        renderWorkspace();
        const createButton = await screen.findByRole('button', { name: 'Tạo phiên bản mới để chỉnh sửa' });
        fireEvent.click(createButton);
        await waitFor(() => expect(editorService.createQuizVersion).toHaveBeenCalledWith(
            quiz.id,
            'Đề kiểm tra - Bản chỉnh sửa',
        ));
    });
});

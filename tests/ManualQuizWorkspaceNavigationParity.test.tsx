import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../stores/authStore';
import { QuestionType } from '../src/types';
import type { ManualQuizQuestion } from '../src/features/manual-quiz-workspace/types/manualQuizWorkspace.types';
import type { QuizEditorEditability } from '../src/features/manual-quiz-workspace/types/manualQuizWorkspace.types';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';
import ManualQuizWorkspacePage from '../src/features/manual-quiz-workspace/ManualQuizWorkspacePage';

const testState = vi.hoisted(() => ({
    flushResults: [] as Array<{ ok: boolean }>,
    flushCalls: 0,
    latestPreview: null as ManualQuizQuestion | null,
    publish: vi.fn(),
    confirm: null as (() => unknown) | null,
    editability: {
        mode: 'EDIT',
        reason: null,
        canEditStructure: true,
        canCreateVersion: false,
        requiresPublishedWarning: false,
        resultCount: 0,
        activeLiveExamCount: 0,
        openAssignmentCount: 0,
    } as QuizEditorEditability,
}));

vi.mock('../src/features/manual-quiz-workspace/components/QuestionEditorPane', async () => {
    const ReactModule = await import('react');
    const MockQuestionEditorPane = ReactModule.forwardRef<any, any>((props, ref) => {
        ReactModule.useImperativeHandle(ref, () => ({
            flush: () => {
                testState.flushCalls += 1;
                return testState.flushResults.shift() ?? { ok: true };
            },
            getPreviewQuestion: () => testState.latestPreview,
        }), []);
        return ReactModule.createElement('main', { 'aria-label': 'Trình soạn câu hỏi' },
            ReactModule.createElement('button', { type: 'button', onClick: props.onBack }, 'Về danh sách'),
            ReactModule.createElement('button', {
                type: 'button',
                onClick: props.onPrevious,
            }, 'Câu trước'),
            ReactModule.createElement('button', {
                type: 'button',
                onClick: () => props.onPreview?.(testState.latestPreview),
            }, 'Xem trước'),
            ReactModule.createElement('button', { type: 'button', onClick: props.onNext }, 'Lưu và câu sau'),
            ReactModule.createElement('button', { type: 'button', onClick: props.onDone }, 'Xong'),
        );
    });
    return { default: MockQuestionEditorPane };
});

vi.mock('../src/features/manual-quiz-workspace/components/StudentPreviewPane', () => ({
    default: ({ question, onBack }: { question: ManualQuizQuestion | null; onBack: () => void }) => (
        <main aria-label="Xem trước học sinh">
            <button type="button" onClick={onBack}>Về danh sách</button>
            <p>{question?.question}</p>
        </main>
    ),
}));

vi.mock('../src/features/manual-quiz-workspace/hooks/useManualQuizEditorAccess', () => ({
    useManualQuizEditorAccess: () => ({
        editability: testState.editability,
        editorAccessStatus: 'loaded',
    }),
}));

vi.mock('../src/features/manual-quiz-workspace/hooks/useManualQuizAutosave', () => ({
    useManualQuizAutosave: () => ({
        conflict: null,
        isResolvingConflict: false,
        serverResolutionVersion: 0,
        saveNow: vi.fn(),
        persistLocalNow: vi.fn(),
        resolveWithLocal: vi.fn(),
        resolveWithServer: vi.fn(),
    }),
}));

vi.mock('../src/features/manual-quiz-workspace/hooks/useManualQuizPublish', () => ({
    useManualQuizPublish: () => ({
        publish: testState.publish,
        isPublishing: false,
        error: null,
        cleanupWarning: null,
    }),
}));

vi.mock('../src/utils/toast', async () => {
    const actual = await vi.importActual<typeof import('../src/utils/toast')>('../src/utils/toast');
    return {
        ...actual,
        showConfirm: (options: { onConfirm?: () => unknown }) => {
            testState.confirm = options.onConfirm ?? null;
            return Promise.resolve(false);
        },
    };
});

const seed = {
    title: 'Đề navigation parity', classLevel: '3', category: 'toan', timeLimit: 20,
    tags: [], requireCode: false, showOnHome: true,
};

const makeQuestion = (id: string, question: string): ManualQuizQuestion => ({
    id,
    type: QuestionType.MCQ,
    question,
    options: ['A', 'B'],
    correctAnswer: 'A',
    difficulty: 1,
    points: 1,
});

const renderWorkspace = (initialEntries?: any[]) => render(
    <MemoryRouter initialEntries={initialEntries ?? [{
        pathname: '/teacher/quizzes/manual/new',
        state: { manualQuizSeed: seed },
    }]}>
        <Routes>
            <Route path="/teacher/quizzes/manual/new" element={<ManualQuizWorkspacePage />} />
            <Route path="/previous" element={<div data-testid="previous-route">previous</div>} />
        </Routes>
    </MemoryRouter>,
);

const addQuestions = (...questions: ManualQuizQuestion[]) => {
    act(() => useManualQuizWorkspaceStore.getState().addQuestions(questions));
};

describe('ManualQuizWorkspace navigation parity characterization', () => {
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
            username: 'teacher-navigation',
            teacherName: 'Cô Navigation',
            isAdmin: false,
        });
        testState.flushResults = [];
        testState.flushCalls = 0;
        testState.latestPreview = null;
        testState.publish.mockReset();
        testState.confirm = null;
        testState.editability = {
            mode: 'EDIT',
            reason: null,
            canEditStructure: true,
            canCreateVersion: false,
            requiresPublishedWarning: false,
            resultCount: 0,
            activeLiveExamCount: 0,
            openAssignmentCount: 0,
        };
    });

    it('keeps previous/next navigation at both question bounds', async () => {
        renderWorkspace();
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });
        addQuestions(makeQuestion('q-bound-1', 'Câu đầu'), makeQuestion('q-bound-2', 'Câu cuối'));

        fireEvent.click(await screen.findByRole('button', { name: 'Sửa câu 1' }));
        await screen.findByRole('main', { name: 'Trình soạn câu hỏi' });
        fireEvent.click(screen.getByRole('button', { name: 'Câu trước' }));
        expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe('q-bound-1');

        fireEvent.click(screen.getByRole('button', { name: 'Lưu và câu sau' }));
        await waitFor(() => expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe('q-bound-2'));
        expect(screen.getByRole('button', { name: 'Xong' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Câu trước' }));
        await waitFor(() => expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe('q-bound-1'));
        fireEvent.click(screen.getByRole('button', { name: 'Lưu và câu sau' }));
        await waitFor(() => expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe('q-bound-2'));
        fireEvent.click(screen.getByRole('button', { name: 'Lưu và câu sau' }));
        expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe('q-bound-2');
    });

    it('blocks every guarded navigation and publish action when flush fails', async () => {
        renderWorkspace();
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });
        addQuestions(makeQuestion('q-guard-1', 'Câu một'), makeQuestion('q-guard-2', 'Câu hai'));
        fireEvent.click(await screen.findByRole('button', { name: 'Sửa câu 2' }));
        testState.flushCalls = 0;
        testState.flushResults = [{ ok: false }, { ok: false }, { ok: false }, { ok: false }, { ok: false }];

        const editor = await screen.findByRole('main', { name: 'Trình soạn câu hỏi' });
        fireEvent.click(screen.getByRole('button', { name: 'Về danh sách' }));
        expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe('q-guard-2');
        expect(screen.getByTestId('workspace-view-edit')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Xem trước' }));
        expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe('q-guard-2');
        expect(screen.getByTestId('workspace-view-edit')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Câu trước' }));
        expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe('q-guard-2');
        expect(screen.getByTestId('workspace-view-edit')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Xong' }));
        expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe('q-guard-2');
        expect(screen.getByTestId('workspace-view-edit')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra và xuất bản' }));
        expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe('q-guard-2');
        expect(screen.getByTestId('workspace-view-edit')).toBeVisible();

        expect(screen.getByRole('main', { name: 'Trình soạn câu hỏi' })).toBe(editor);
        expect(screen.getByTestId('workspace-view-edit')).toBeVisible();
        expect(screen.queryByRole('dialog', { name: 'Kiểm tra trước khi xuất bản' })).not.toBeInTheDocument();
        expect(testState.flushCalls).toBe(5);
        expect(testState.publish).not.toHaveBeenCalled();
    });

    it('uses the newest editor snapshot when opening preview', async () => {
        const latest = makeQuestion('q-preview-latest', 'Nội dung vừa gõ');
        testState.latestPreview = latest;
        renderWorkspace();
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });
        addQuestions(makeQuestion('q-preview-latest', 'Nội dung cũ'));

        fireEvent.click(await screen.findByRole('button', { name: 'Sửa câu 1' }));
        fireEvent.click(screen.getByRole('button', { name: 'Mở xem trước' }));

        await waitFor(() => expect(screen.getByRole('main', { name: 'Xem trước học sinh' })).toBeVisible());
        expect(within(screen.getByRole('main', { name: 'Xem trước học sinh' })).getByText('Nội dung vừa gõ')).toBeInTheDocument();
    });

    it('navigates back from overview through the router history', async () => {
        renderWorkspace([
            '/previous',
            { pathname: '/teacher/quizzes/manual/new', state: { manualQuizSeed: seed } },
        ]);
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });

        fireEvent.click(screen.getByRole('button', { name: 'Quay lại trang tạo đề' }));
        await waitFor(() => expect(screen.getByTestId('previous-route')).toBeInTheDocument());
    });

    it('keeps readonly open/back in preview and never publishes', async () => {
        testState.editability = {
            mode: 'READONLY',
            reason: 'HAS_SUBMISSIONS',
            canEditStructure: false,
            canCreateVersion: false,
            requiresPublishedWarning: false,
            resultCount: 1,
            activeLiveExamCount: 0,
            openAssignmentCount: 0,
        };
        renderWorkspace();
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });
        addQuestions(makeQuestion('q-readonly', 'Câu chỉ đọc'));

        fireEvent.click(await screen.findByRole('button', { name: 'Xem câu 1' }));
        await waitFor(() => expect(screen.getByRole('main', { name: 'Xem trước học sinh' })).toBeVisible());
        expect(screen.getByRole('button', { name: 'Đề đang ở chế độ chỉ đọc' })).toBeDisabled();

        fireEvent.click(within(screen.getByRole('main', { name: 'Xem trước học sinh' })).getByRole('button', { name: 'Về danh sách' }));
        expect(screen.getByTestId('workspace-view-overview')).toBeVisible();
        expect(testState.publish).not.toHaveBeenCalled();
    });

    it('runs the published-warning guard twice before the single publish request', async () => {
        testState.editability = {
            mode: 'EDIT',
            reason: null,
            canEditStructure: true,
            canCreateVersion: false,
            requiresPublishedWarning: true,
            resultCount: 0,
            activeLiveExamCount: 0,
            openAssignmentCount: 1,
        };
        renderWorkspace();
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });
        addQuestions(makeQuestion('q-publish-warning', 'Câu hợp lệ'));

        fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra và xuất bản' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Xuất bản đề' }));

        expect(testState.flushCalls).toBe(2);
        expect(testState.confirm).toEqual(expect.any(Function));
        expect(testState.publish).not.toHaveBeenCalled();

        act(() => { testState.confirm?.(); });
        await waitFor(() => expect(testState.publish).toHaveBeenCalledTimes(1));
        expect(testState.flushCalls).toBe(3);
    });

    it('does not open a confirmation or publish when the publish guard fails', async () => {
        testState.editability = {
            mode: 'EDIT',
            reason: null,
            canEditStructure: true,
            canCreateVersion: false,
            requiresPublishedWarning: true,
            resultCount: 0,
            activeLiveExamCount: 0,
            openAssignmentCount: 1,
        };
        renderWorkspace();
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });
        addQuestions(makeQuestion('q-publish-guard-blocked', 'Câu hợp lệ'));

        fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra và xuất bản' }));
        await screen.findByRole('button', { name: 'Xuất bản đề' });
        testState.flushCalls = 0;
        testState.flushResults = [{ ok: false }];
        fireEvent.click(screen.getByRole('button', { name: 'Xuất bản đề' }));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(testState.flushCalls).toBe(1);
        expect(testState.confirm).toBeNull();
        expect(testState.publish).not.toHaveBeenCalled();
    });

    it('does not publish when the confirmation guard fails', async () => {
        testState.editability = {
            mode: 'EDIT',
            reason: null,
            canEditStructure: true,
            canCreateVersion: false,
            requiresPublishedWarning: true,
            resultCount: 0,
            activeLiveExamCount: 0,
            openAssignmentCount: 1,
        };
        renderWorkspace();
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });
        addQuestions(makeQuestion('q-publish-blocked', 'Câu hợp lệ'));
        testState.flushResults = [{ ok: true }, { ok: true }, { ok: false }];

        fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra và xuất bản' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Xuất bản đề' }));
        act(() => { testState.confirm?.(); });
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(testState.flushCalls).toBe(3);
        expect(testState.publish).not.toHaveBeenCalled();
    });
});

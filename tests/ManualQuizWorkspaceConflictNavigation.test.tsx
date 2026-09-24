import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManualQuizDraftRecord } from '../shared/manual-quiz-draft.contract';
import { useAuthStore } from '../stores/authStore';
import { QuestionType } from '../src/types';
import type {
    ManualQuizDraftEnvelope,
    ManualQuizQuestion,
} from '../src/features/manual-quiz-workspace/types/manualQuizWorkspace.types';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';

const testState = vi.hoisted(() => ({
    flushResults: [] as Array<{ ok: boolean }>,
    flushCalls: 0,
    previewQuestion: null as ManualQuizQuestion | null,
    serverRecord: null as ManualQuizDraftRecord | null,
    setConflict: null as ((record: ManualQuizDraftRecord) => void) | null,
}));

vi.mock('../src/features/manual-quiz-workspace/components/QuestionEditorPane', async () => {
    const ReactModule = await import('react');
    const MockQuestionEditorPane = ReactModule.forwardRef<any, any>((_props, ref) => {
        ReactModule.useImperativeHandle(ref, () => ({
            flush: () => {
                testState.flushCalls += 1;
                return testState.flushResults.shift() ?? { ok: true };
            },
            getPreviewQuestion: () => testState.previewQuestion,
        }), []);
        return ReactModule.createElement('div', { 'data-testid': 'mock-question-editor' });
    });
    return { default: MockQuestionEditorPane };
});

vi.mock('../src/features/manual-quiz-workspace/hooks/useManualQuizAutosave', async () => {
    const ReactModule = await import('react');
    const { useManualQuizWorkspaceStore: workspaceStore } = await import(
        '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore'
    );

    const useManualQuizAutosave = () => {
        const [conflict, setConflict] = ReactModule.useState<ManualQuizDraftRecord | null>(null);
        const [serverResolutionVersion, setServerResolutionVersion] = ReactModule.useState(0);

        ReactModule.useEffect(() => {
            testState.setConflict = setConflict;
            return () => {
                testState.setConflict = null;
            };
        }, []);

        const resolveWithServer = ReactModule.useCallback(async () => {
            const record = testState.serverRecord;
            if (!record) return;
            workspaceStore.getState().replaceEnvelope(record.draft as ManualQuizDraftEnvelope);
            setServerResolutionVersion((value) => value + 1);
            setConflict(null);
        }, []);

        return {
            conflict,
            isResolvingConflict: false,
            serverResolutionVersion,
            captureConflict: vi.fn(),
            resolveWithLocal: vi.fn(async () => undefined),
            resolveWithServer,
            saveNow: vi.fn(),
            persistLocalNow: vi.fn(),
        };
    };

    return { useManualQuizAutosave };
});

import ManualQuizWorkspacePage from '../src/features/manual-quiz-workspace/ManualQuizWorkspacePage';

const seed = {
    title: 'Đề P2',
    classLevel: '3',
    category: 'toan',
    timeLimit: 15,
    tags: [],
    requireCode: false,
    showOnHome: true,
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

const makeQuestion = (id: string, question: string): ManualQuizQuestion => ({
    id,
    type: QuestionType.MCQ,
    question,
    options: ['A', 'B'],
    correctAnswer: 'A',
    difficulty: 1,
    points: 1,
});

describe('manual workspace P2 conflict and quick-add paths', () => {
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
            username: 'teacher-p2',
            teacherName: 'Cô P2',
            isAdmin: false,
        });
        testState.flushResults = [];
        testState.flushCalls = 0;
        testState.previewQuestion = null;
        testState.serverRecord = null;
        testState.setConflict = null;
    });

    it('shows the accepted server question when resolving a conflict from a stale preview', async () => {
        renderWorkspace();
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });
        const localQuestion = makeQuestion('q-preview-p2', 'Bản cũ trong xem trước');
        act(() => useManualQuizWorkspaceStore.getState().addQuestion(localQuestion));
        testState.previewQuestion = localQuestion;

        fireEvent.click(screen.getByRole('button', { name: 'Mở xem trước' }));
        expect(screen.getByTestId('workspace-view-preview')).toBeVisible();
        expect(screen.getAllByText('Bản cũ trong xem trước').length).toBeGreaterThan(0);

        const localEnvelope = useManualQuizWorkspaceStore.getState().envelope!;
        const serverQuestion = makeQuestion('q-preview-p2', 'Bản mới trên hệ thống');
        const serverRecord: ManualQuizDraftRecord = {
            id: localEnvelope.draftId,
            ownerUsername: localEnvelope.ownerUsername,
            revision: 4,
            draft: {
                ...localEnvelope,
                revision: 4,
                quiz: { ...localEnvelope.quiz, questions: [serverQuestion] },
                selectedQuestionId: serverQuestion.id,
            },
            createdAt: '2026-09-24T01:00:00.000Z',
            updatedAt: '2026-09-24T02:00:00.000Z',
        };
        testState.serverRecord = serverRecord;
        act(() => testState.setConflict?.(serverRecord));

        fireEvent.click(await screen.findByRole('button', { name: 'Dùng bản trên hệ thống' }));

        await waitFor(() => {
            expect(screen.getByTestId('workspace-view-preview')).toBeVisible();
            expect(screen.getAllByText('Bản mới trên hệ thống').length).toBeGreaterThan(0);
            expect(screen.queryByRole('dialog', { name: 'Bản nháp có thay đổi ở nơi khác' })).not.toBeInTheDocument();
        });
        expect(screen.queryByText('Bản cũ trong xem trước')).not.toBeInTheDocument();
    });

    it('does not guard twice or leave a half-mutated workspace after quick-add', async () => {
        testState.flushResults = [{ ok: true }, { ok: false }];
        renderWorkspace();
        await screen.findByRole('main', { name: 'Tổng quan câu hỏi' });

        fireEvent.click(screen.getByRole('button', { name: 'Thêm nhanh Trắc nghiệm' }));

        await waitFor(() => expect(useManualQuizWorkspaceStore.getState().envelope?.quiz.questions).toHaveLength(1));
        expect(testState.flushCalls).toBe(1);
        expect(screen.getByTestId('workspace-view-edit')).toBeVisible();
        expect(screen.getByTestId('workspace-view-overview')).not.toBeVisible();
    });
});

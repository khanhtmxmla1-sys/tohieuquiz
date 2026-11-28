import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManualQuizDraftRecord } from '../shared/manual-quiz-draft.contract';
import { useAuthStore } from '../stores/authStore';
import { useQuizStore } from '../stores/quizStore';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';
import {
    loadLocalDraft,
    saveLocalDraft,
} from '../src/features/manual-quiz-workspace/draft/manualQuizDraftRepository';
import type {
    ManualQuizDraftEnvelope,
    ManualQuizSeed,
} from '../src/features/manual-quiz-workspace/types/manualQuizWorkspace.types';

const getRemoteManualQuizDraftMock = vi.hoisted(() => vi.fn());
const editorService = vi.hoisted(() => ({
    getQuizEditorPayload: vi.fn(),
}));

vi.mock('../src/services/manualQuizDraftService', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/services/manualQuizDraftService')>();
    return { ...actual, getRemoteManualQuizDraft: getRemoteManualQuizDraftMock };
});
vi.mock('../src/features/manual-quiz-workspace/services/quizEditorService', () => editorService);

import ManualQuizWorkspacePage from '../src/features/manual-quiz-workspace/ManualQuizWorkspacePage';

const seed: ManualQuizSeed = {
    title: 'Đề seed P2',
    classLevel: '3A',
    category: 'toan',
    timeLimit: 15,
    tags: [],
    requireCode: false,
    showOnHome: true,
};

const baseQuiz = {
    id: 'quiz-recovery',
    title: 'Đề trong danh mục',
    classLevel: '3A',
    category: 'toan',
    timeLimit: 20,
    createdAt: '2026-10-01T08:00:00.000Z',
    createdBy: 'teacher-a',
    questions: [],
    sourceType: 'manual' as const,
    parentQuizId: null,
    versionNumber: 1,
    revision: 3,
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

const payloadFor = (overrides: Record<string, unknown> = {}) => ({
    quiz: { ...baseQuiz, ...(overrides.quiz as Record<string, unknown> | undefined) },
    questions: overrides.questions ?? [],
    editability: overrides.editability ?? editability,
});

const makeDraft = (
    overrides: Partial<ManualQuizDraftEnvelope> = {},
): ManualQuizDraftEnvelope => ({
    schemaVersion: 1,
    draftId: 'draft-local',
    quizId: undefined,
    ownerUsername: 'teacher-a',
    revision: 2,
    quiz: {
        ...baseQuiz,
        id: 'quiz-local',
        title: 'Bản nháp cục bộ',
        questions: [],
    },
    selectedQuestionId: null,
    targetPoints: 10,
    updatedAt: '2026-10-02T08:00:00.000Z',
    ...overrides,
});

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
};

const RemoteSwitcher = ({ draftId }: { draftId: string }) => {
    const navigate = useNavigate();
    return (
        <button
            type="button"
            onClick={() => navigate(`/teacher/quizzes/manual/new?draftId=${draftId}`)}
        >
            switch remote draft
        </button>
    );
};

const renderNewWorkspace = (
    search = '',
    navigationState: Record<string, unknown> = { manualQuizSeed: seed },
    controls?: React.ReactNode,
) => render(
    <MemoryRouter initialEntries={[{
        pathname: '/teacher/quizzes/manual/new',
        search,
        state: navigationState,
    }]}>
        <Routes>
            <Route path="/teacher/quizzes/manual/new" element={<ManualQuizWorkspacePage />} />
        </Routes>
        {controls}
    </MemoryRouter>,
);

const renderEditWorkspace = (entry = '/teacher/quizzes/quiz-recovery/edit') => render(
    <MemoryRouter initialEntries={[entry]}>
        <Routes>
            <Route path="/teacher/quizzes/:quizId/edit" element={<ManualQuizWorkspacePage />} />
        </Routes>
    </MemoryRouter>,
);

describe('ManualQuizWorkspace recovery lifecycle characterization', () => {
    beforeEach(() => {
        getRemoteManualQuizDraftMock.mockReset();
        editorService.getQuizEditorPayload.mockReset();
        localStorage.clear();
        useManualQuizWorkspaceStore.getState().reset();
        useAuthStore.setState({
            isLoggedIn: true,
            username: 'teacher-a',
            teacherName: 'Cô A',
            isAdmin: false,
        });
        useQuizStore.setState({
            quizzes: [],
            selectedQuiz: null,
            quizzesLoadedAt: null,
            loadQuizzes: vi.fn(async () => undefined),
        });
    });

    it('hydrates remote draft metadata from the authoritative record', async () => {
        const remoteDraft = makeDraft({
            draftId: 'payload-draft-id',
            quizId: 'payload-quiz-id',
            ownerUsername: 'payload-owner',
            revision: 1,
            updatedAt: '2026-10-01T01:00:00.000Z',
            quiz: { ...baseQuiz, id: 'payload-quiz-id', title: 'Nội dung cũ trong payload' },
        });
        const remoteRecord: ManualQuizDraftRecord = {
            id: 'record-draft-id',
            quizId: 'quiz-authoritative',
            ownerUsername: 'teacher-a',
            revision: 7,
            draft: remoteDraft,
            createdAt: '2026-10-03T01:00:00.000Z',
            updatedAt: '2026-10-03T02:00:00.000Z',
        };
        getRemoteManualQuizDraftMock.mockResolvedValue(remoteRecord);

        renderNewWorkspace('?draftId=record-draft-id');

        await waitFor(() => expect(useManualQuizWorkspaceStore.getState().envelope).toMatchObject({
            draftId: 'record-draft-id',
            quizId: 'quiz-authoritative',
            ownerUsername: 'teacher-a',
            revision: 7,
            updatedAt: '2026-10-03T02:00:00.000Z',
        }));
        expect(getRemoteManualQuizDraftMock).toHaveBeenCalledWith('record-draft-id', expect.any(AbortSignal));
    });

    it('keeps the remote error visible while falling back to a newer local draft', async () => {
        saveLocalDraft(makeDraft({ updatedAt: '2026-10-04T08:00:00.000Z' }));
        getRemoteManualQuizDraftMock.mockRejectedValue(new Error('remote unavailable'));

        renderNewWorkspace('?draftId=missing-draft');

        expect(await screen.findByRole('alert')).toHaveTextContent('remote unavailable');
        expect(await screen.findByRole('dialog', { name: 'Tiếp tục bản nháp chưa hoàn thành?' })).toBeInTheDocument();
        expect(screen.getByText('Bản nháp cục bộ')).toBeInTheDocument();
    });

    it('initializes the incoming seed when remote recovery errors and no local draft exists', async () => {
        getRemoteManualQuizDraftMock.mockRejectedValue('network sentinel');

        renderNewWorkspace('?draftId=missing-draft');

        expect(await screen.findByRole('alert')).toHaveTextContent('Không thể mở bản nháp đã chọn.');
        expect(await screen.findByDisplayValue(seed.title)).toBeInTheDocument();
        expect(screen.queryByRole('dialog', { name: 'Tiếp tục bản nháp chưa hoàn thành?' })).not.toBeInTheDocument();
    });

    it('aborts remote recovery on unmount without hydrating or surfacing a late result', async () => {
        const request = deferred<ManualQuizDraftRecord>();
        getRemoteManualQuizDraftMock.mockReturnValue(request.promise);

        const mounted = renderNewWorkspace('?draftId=unmounted-draft');
        await waitFor(() => expect(getRemoteManualQuizDraftMock).toHaveBeenCalledTimes(1));
        const signal = getRemoteManualQuizDraftMock.mock.calls[0][1] as AbortSignal;

        mounted.unmount();
        expect(signal.aborted).toBe(true);

        await act(async () => {
            request.resolve({
                id: 'unmounted-draft',
                quizId: 'quiz-recovery',
                ownerUsername: 'teacher-a',
                revision: 1,
                draft: makeDraft(),
                createdAt: '2026-10-01T01:00:00.000Z',
                updatedAt: '2026-10-01T02:00:00.000Z',
            });
            await Promise.resolve();
        });

        expect(useManualQuizWorkspaceStore.getState().envelope).toBeNull();
    });

    it('aborts the previous remote request when the requested draft query changes', async () => {
        const first = deferred<ManualQuizDraftRecord>();
        const second = deferred<ManualQuizDraftRecord>();
        getRemoteManualQuizDraftMock
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);

        renderNewWorkspace(
            '?draftId=first-draft',
            { manualQuizSeed: seed },
            <RemoteSwitcher draftId="second-draft" />,
        );
        await waitFor(() => expect(getRemoteManualQuizDraftMock).toHaveBeenCalledTimes(1));
        const firstSignal = getRemoteManualQuizDraftMock.mock.calls[0][1] as AbortSignal;

        fireEvent.click(screen.getByRole('button', { name: 'switch remote draft' }));
        await waitFor(() => expect(getRemoteManualQuizDraftMock).toHaveBeenCalledTimes(2));
        expect(firstSignal.aborted).toBe(true);

        await act(async () => {
            first.resolve({
                id: 'first-draft',
                quizId: 'quiz-first',
                ownerUsername: 'teacher-a',
                revision: 1,
                draft: makeDraft({ draftId: 'first-draft' }),
                createdAt: '2026-10-01T01:00:00.000Z',
                updatedAt: '2026-10-01T02:00:00.000Z',
            });
            await Promise.resolve();
        });
        expect(useManualQuizWorkspaceStore.getState().envelope).toBeNull();

        await act(async () => {
            second.resolve({
                id: 'second-draft',
                quizId: 'quiz-second',
                ownerUsername: 'teacher-a',
                revision: 2,
                draft: makeDraft({ draftId: 'second-draft' }),
                createdAt: '2026-10-02T01:00:00.000Z',
                updatedAt: '2026-10-02T02:00:00.000Z',
            });
            await Promise.resolve();
        });
        await waitFor(() => expect(useManualQuizWorkspaceStore.getState().envelope).toMatchObject({
            draftId: 'second-draft',
            quizId: 'quiz-second',
        }));
    });

    it('waits for readonly access and skips remote fetch and local recovery', async () => {
        const access = deferred<ReturnType<typeof payloadFor>>();
        saveLocalDraft(makeDraft({
            quizId: 'quiz-recovery',
            quiz: { ...baseQuiz, title: 'Không được mở bản nháp local' },
            updatedAt: '2026-10-04T08:00:00.000Z',
        }));
        editorService.getQuizEditorPayload.mockReturnValue(access.promise);

        renderEditWorkspace('/teacher/quizzes/quiz-recovery/edit?draftId=readonly-draft');

        await waitFor(() => expect(editorService.getQuizEditorPayload).toHaveBeenCalledWith('quiz-recovery'));
        expect(getRemoteManualQuizDraftMock).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog', { name: 'Tiếp tục bản nháp chưa hoàn thành?' })).not.toBeInTheDocument();

        await act(async () => {
            access.resolve(payloadFor({
                editability: readonlyEditability,
                quiz: { title: 'Đề readonly từ server' },
            }));
            await Promise.resolve();
        });

        await waitFor(() => expect(screen.getByText('Chỉ đọc – dữ liệu gốc được bảo vệ')).toBeInTheDocument());
        expect(useManualQuizWorkspaceStore.getState().envelope).toBeNull();
        expect(getRemoteManualQuizDraftMock).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog', { name: 'Tiếp tục bản nháp chưa hoàn thành?' })).not.toBeInTheDocument();
    });

    it('opens a local recovery dialog when its timestamp is newer than the entry', async () => {
        saveLocalDraft(makeDraft({ updatedAt: '2026-10-04T08:00:00.000Z' }));

        renderNewWorkspace('', {
            manualQuizSeed: seed,
            workspaceStartedAt: '2026-10-04T07:59:59.000Z',
        });

        expect(await screen.findByRole('dialog', { name: 'Tiếp tục bản nháp chưa hoàn thành?' })).toBeInTheDocument();
    });

    it.each([
        ['equal', '2026-10-04T08:00:00.000Z'],
        ['older', '2026-10-04T08:00:01.000Z'],
    ])('initializes the seed when the local draft is %s than the entry', async (_label, workspaceStartedAt) => {
        saveLocalDraft(makeDraft({ updatedAt: '2026-10-04T08:00:00.000Z' }));

        renderNewWorkspace('', { manualQuizSeed: seed, workspaceStartedAt });

        expect(await screen.findByDisplayValue(seed.title)).toBeInTheDocument();
        expect(screen.queryByRole('dialog', { name: 'Tiếp tục bản nháp chưa hoàn thành?' })).not.toBeInTheDocument();
    });

    it('continues the exact pending envelope without deleting local drafts', async () => {
        const pending = makeDraft({
            draftId: 'draft-to-continue',
            quizId: 'quiz-to-continue',
            ownerUsername: 'teacher-a',
            revision: 9,
            selectedQuestionId: 'question-selected',
            targetPoints: 25,
            updatedAt: '2026-10-04T08:00:00.000Z',
        });
        const otherDraft = makeDraft({
            draftId: 'draft-to-keep',
            updatedAt: '2026-10-03T08:00:00.000Z',
        });
        saveLocalDraft(pending);
        saveLocalDraft(otherDraft);

        renderNewWorkspace('', {
            manualQuizSeed: seed,
            workspaceStartedAt: '2026-10-03T08:00:00.000Z',
        });
        await screen.findByRole('dialog', { name: 'Tiếp tục bản nháp chưa hoàn thành?' });

        fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục soạn' }));

        await waitFor(() => expect(useManualQuizWorkspaceStore.getState().envelope).toMatchObject({
            draftId: 'draft-to-continue',
            quizId: 'quiz-to-continue',
            ownerUsername: 'teacher-a',
            revision: 9,
            selectedQuestionId: 'question-selected',
            targetPoints: 25,
            updatedAt: '2026-10-04T08:00:00.000Z',
        }));
        expect(loadLocalDraft('teacher-a', 'draft-to-continue')).not.toBeNull();
        expect(loadLocalDraft('teacher-a', 'draft-to-keep')).not.toBeNull();
    });

    it('discards only the current user draft and preserves other draft keys', async () => {
        const currentDraft = makeDraft({
            draftId: 'draft-current',
            updatedAt: '2026-10-04T08:00:00.000Z',
        });
        saveLocalDraft(currentDraft);
        saveLocalDraft(makeDraft({
            draftId: 'draft-same-user',
            updatedAt: '2026-10-03T08:00:00.000Z',
        }));
        saveLocalDraft(makeDraft({
            draftId: 'draft-other-user',
            ownerUsername: 'teacher-b',
            updatedAt: '2026-10-02T08:00:00.000Z',
        }));

        renderNewWorkspace('', {
            manualQuizSeed: seed,
            workspaceStartedAt: '2026-10-03T08:00:00.000Z',
        });
        await screen.findByRole('dialog', { name: 'Tiếp tục bản nháp chưa hoàn thành?' });

        fireEvent.click(screen.getByRole('button', { name: 'Bỏ bản nháp' }));

        expect(await screen.findByDisplayValue(seed.title)).toBeInTheDocument();
        expect(loadLocalDraft('teacher-a', 'draft-current')).toBeNull();
        expect(loadLocalDraft('teacher-a', 'draft-same-user')).not.toBeNull();
        expect(loadLocalDraft('teacher-b', 'draft-other-user')).not.toBeNull();
    });

    it('waits for editable access before initializing from the available quiz', async () => {
        const access = deferred<ReturnType<typeof payloadFor>>();
        editorService.getQuizEditorPayload.mockReturnValue(access.promise);

        renderEditWorkspace();

        await waitFor(() => expect(editorService.getQuizEditorPayload).toHaveBeenCalledWith('quiz-recovery'));
        expect(useManualQuizWorkspaceStore.getState().envelope).toBeNull();

        await act(async () => {
            access.resolve(payloadFor({ quiz: { title: 'Đề editable từ server' } }));
            await Promise.resolve();
        });

        await waitFor(() => expect(useManualQuizWorkspaceStore.getState().envelope?.quiz.title).toBe('Đề editable từ server'));
        expect(screen.queryByRole('dialog', { name: 'Tiếp tục bản nháp chưa hoàn thành?' })).not.toBeInTheDocument();
    });
});

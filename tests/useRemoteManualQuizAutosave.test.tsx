import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManualQuizDraftRecord } from '../shared/manual-quiz-draft.contract';
import DraftConflictDialog from '../src/features/manual-quiz-workspace/components/DraftConflictDialog';
import { useManualQuizAutosave } from '../src/features/manual-quiz-workspace/hooks/useManualQuizAutosave';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';
import { ManualQuizDraftConflictError } from '../src/services/manualQuizDraftService';

const putRemoteMock = vi.hoisted(() => vi.fn());

vi.mock('../src/services/manualQuizDraftService', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/services/manualQuizDraftService')>();
    return { ...actual, putRemoteManualQuizDraft: putRemoteMock };
});

const seed = {
    title: 'Đề trên máy',
    classLevel: '3A',
    category: 'toan',
    timeLimit: 15,
    tags: [],
    requireCode: false,
    showOnHome: true,
};

const setOnline = (online: boolean) => {
    Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        value: online,
    });
};

const serverRecord = (revision = 1, title = 'Đề trên hệ thống'): ManualQuizDraftRecord => {
    const local = useManualQuizWorkspaceStore.getState().envelope!;
    return {
        id: local.draftId,
        ownerUsername: local.ownerUsername,
        revision,
        draft: {
            ...local,
            revision,
            updatedAt: '2026-07-21T10:00:00.000Z',
            quiz: { ...local.quiz, title },
        },
        createdAt: '2026-07-21T08:00:00.000Z',
        updatedAt: '2026-07-21T10:00:00.000Z',
    };
};

const AutosaveHarness = () => {
    const envelope = useManualQuizWorkspaceStore((state) => state.envelope);
    const status = useManualQuizWorkspaceStore((state) => state.saveStatus);
    const controller = useManualQuizAutosave(envelope);

    return (
        <>
            <span data-testid="remote-status">{status}</span>
            {controller.conflict && envelope && (
                <DraftConflictDialog
                    localDraft={envelope}
                    serverRecord={controller.conflict}
                    isResolving={controller.isResolvingConflict}
                    onUseLocal={controller.resolveWithLocal}
                    onUseServer={controller.resolveWithServer}
                />
            )}
        </>
    );
};

describe('remote manual quiz autosave', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
        putRemoteMock.mockReset();
        setOnline(true);
        useManualQuizWorkspaceStore.getState().reset();
        useManualQuizWorkspaceStore.getState().initializeFromSeed(seed, 'teacher-a');
    });

    it('saves locally first, then syncs remotely after two seconds of inactivity', async () => {
        putRemoteMock.mockImplementation(async () => serverRecord(1, 'Đề trên máy'));
        render(<AutosaveHarness />);
        const envelope = useManualQuizWorkspaceStore.getState().envelope!;
        const storageKey = `tohieuquiz:manual-draft:v1:teacher-a:${envelope.draftId}`;

        await act(async () => { await vi.advanceTimersByTimeAsync(600); });
        expect(localStorage.getItem(storageKey)).toContain('Đề trên máy');
        expect(putRemoteMock).not.toHaveBeenCalled();

        await act(async () => { await vi.advanceTimersByTimeAsync(1400); });
        expect(putRemoteMock).toHaveBeenCalledTimes(1);
        expect(putRemoteMock).toHaveBeenCalledWith(
            expect.objectContaining({ quiz: expect.objectContaining({ title: 'Đề trên máy' }) }),
            0,
            expect.any(AbortSignal),
        );
        expect(useManualQuizWorkspaceStore.getState().envelope?.revision).toBe(1);
        expect(screen.getByTestId('remote-status')).toHaveTextContent('saved');
    });

    it('syncs the configured duration in the remote draft envelope', async () => {
        putRemoteMock.mockImplementation(async () => serverRecord(1, 'Đề trên máy'));
        render(<AutosaveHarness />);

        act(() => useManualQuizWorkspaceStore.getState().updateQuiz({ timeLimit: 60 }));
        await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });

        expect(putRemoteMock).toHaveBeenCalledTimes(1);
        expect(putRemoteMock.mock.calls[0][0].quiz.timeLimit).toBe(60);
    });

    it('keeps a new placeholder draft local until the teacher adds meaningful content', async () => {
        useManualQuizWorkspaceStore.getState().reset();
        useManualQuizWorkspaceStore.getState().initializeFromSeed({
            title: 'Đề kiểm tra mới',
            classLevel: '3',
            category: 'toan',
            timeLimit: 15,
            tags: [],
            requireCode: false,
            showOnHome: true,
        }, 'teacher-a');
        putRemoteMock.mockImplementation(async () => serverRecord(1, 'Đề đã bắt đầu soạn'));
        render(<AutosaveHarness />);

        await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });

        expect(putRemoteMock).not.toHaveBeenCalled();
        expect(screen.getByTestId('remote-status')).toHaveTextContent('saved');

        act(() => useManualQuizWorkspaceStore.getState().updateQuiz({ title: 'Đề đã bắt đầu soạn' }));
        await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });

        expect(putRemoteMock).toHaveBeenCalledTimes(1);
        expect(putRemoteMock.mock.calls[0][0].quiz.title).toBe('Đề đã bắt đầu soạn');
    });

    it('keeps editing offline and syncs the latest draft immediately when online returns', async () => {
        setOnline(false);
        putRemoteMock.mockImplementation(async () => serverRecord(1, 'Bản mới nhất'));
        render(<AutosaveHarness />);

        act(() => useManualQuizWorkspaceStore.getState().updateQuiz({ title: 'Bản mới nhất' }));
        await act(async () => { await vi.advanceTimersByTimeAsync(2500); });

        expect(putRemoteMock).not.toHaveBeenCalled();
        expect(screen.getByTestId('remote-status')).toHaveTextContent('offline');
        expect(useManualQuizWorkspaceStore.getState().envelope?.quiz.title).toBe('Bản mới nhất');

        setOnline(true);
        act(() => window.dispatchEvent(new Event('online')));
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });

        expect(putRemoteMock).toHaveBeenCalledTimes(1);
        expect(putRemoteMock.mock.calls[0][0].quiz.title).toBe('Bản mới nhất');
        expect(screen.getByTestId('remote-status')).toHaveTextContent('saved');
    });

    it('does not overwrite a conflict and can accept the server version', async () => {
        const current = serverRecord(4);
        putRemoteMock.mockRejectedValueOnce(new ManualQuizDraftConflictError('conflict', current));
        render(<AutosaveHarness />);

        await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

        expect(screen.getByRole('dialog', { name: 'Bản nháp có thay đổi ở nơi khác' })).toBeInTheDocument();
        expect(screen.getByTestId('remote-status')).toHaveTextContent('conflict');
        expect(useManualQuizWorkspaceStore.getState().envelope?.quiz.title).toBe('Đề trên máy');

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Dùng bản trên hệ thống' }));
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(useManualQuizWorkspaceStore.getState().envelope?.quiz.title).toBe('Đề trên hệ thống');
        expect(useManualQuizWorkspaceStore.getState().envelope?.revision).toBe(4);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('can keep the latest local version by retrying against the server revision', async () => {
        const current = serverRecord(3);
        putRemoteMock
            .mockRejectedValueOnce(new ManualQuizDraftConflictError('conflict', current))
            .mockImplementationOnce(async (localDraft) => ({
                ...current,
                revision: 4,
                draft: { ...localDraft, revision: 4, updatedAt: '2026-07-21T11:00:00.000Z' },
                updatedAt: '2026-07-21T11:00:00.000Z',
            }));
        render(<AutosaveHarness />);
        await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

        act(() => useManualQuizWorkspaceStore.getState().updateQuiz({ title: 'Bản máy đã sửa thêm' }));
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Giữ bản trên máy' }));
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(putRemoteMock).toHaveBeenCalledTimes(2);
        expect(putRemoteMock.mock.calls[1][0].quiz.title).toBe('Bản máy đã sửa thêm');
        expect(putRemoteMock.mock.calls[1][1]).toBe(3);
        expect(useManualQuizWorkspaceStore.getState().envelope?.revision).toBe(4);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});

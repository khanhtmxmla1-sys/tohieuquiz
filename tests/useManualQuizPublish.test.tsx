import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType } from '../src/types';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';
import { useManualQuizPublish } from '../src/features/manual-quiz-workspace/hooks/useManualQuizPublish';

const quizStoreMocks = vi.hoisted(() => ({
    createQuiz: vi.fn(),
    modifyQuiz: vi.fn(),
    loadQuizzes: vi.fn(),
}));
const cleanupMocks = vi.hoisted(() => ({
    removeLocalDraft: vi.fn(),
    deleteRemoteDraft: vi.fn(),
}));

vi.mock('../stores/quizStore', () => ({
    useQuizStore: (selector: any) => selector(quizStoreMocks),
}));
vi.mock('../src/features/manual-quiz-workspace/draft/manualQuizDraftRepository', () => ({
    removeLocalDraft: cleanupMocks.removeLocalDraft,
}));
vi.mock('../src/services/manualQuizDraftService', () => ({
    deleteRemoteManualQuizDraftIfExists: cleanupMocks.deleteRemoteDraft,
}));

const seed = {
    title: 'Đề Toán lớp 4', classLevel: '4A', category: 'toan', timeLimit: 20,
    tags: [], requireCode: false, showOnHome: true,
};

const initializeValidDraft = (edit = false) => {
    const store = useManualQuizWorkspaceStore.getState();
    store.reset();
    store.initializeFromSeed(seed, 'teacher-a');
    store.addQuestion({
        id: 'q-1', type: QuestionType.MCQ, question: '1 + 1 bằng bao nhiêu?',
        options: ['1', '2'], correctAnswer: 'B', difficulty: 1, points: 10,
    });
    if (edit) {
        const envelope = useManualQuizWorkspaceStore.getState().envelope!;
        useManualQuizWorkspaceStore.getState().hydrateEnvelope({
            ...envelope,
            quizId: envelope.quiz.id,
        });
    }
};

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};

beforeEach(() => {
    vi.clearAllMocks();
    quizStoreMocks.createQuiz.mockResolvedValue(undefined);
    quizStoreMocks.modifyQuiz.mockResolvedValue(undefined);
    quizStoreMocks.loadQuizzes.mockResolvedValue(undefined);
    cleanupMocks.removeLocalDraft.mockReturnValue(undefined);
    cleanupMocks.deleteRemoteDraft.mockResolvedValue(undefined);
    initializeValidDraft(false);
});

describe('useManualQuizPublish', () => {
    it('validates the final snapshot, creates a new quiz, then removes drafts and refreshes', async () => {
        const order: string[] = [];
        quizStoreMocks.createQuiz.mockImplementation(async () => { order.push('canonical'); });
        cleanupMocks.removeLocalDraft.mockImplementation(() => { order.push('local-draft'); });
        cleanupMocks.deleteRemoteDraft.mockImplementation(async () => { order.push('remote-draft'); });
        quizStoreMocks.loadQuizzes.mockImplementation(async () => { order.push('refresh'); });
        const onSuccess = vi.fn();
        const { result } = renderHook(() => useManualQuizPublish({
            envelope: useManualQuizWorkspaceStore.getState().envelope,
            onSuccess,
        }));

        let published = false;
        await act(async () => { published = await result.current.publish(); });

        expect(published).toBe(true);
        expect(quizStoreMocks.createQuiz).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Đề Toán lớp 4', questions: [expect.objectContaining({ points: 10 })],
        }));
        expect(quizStoreMocks.modifyQuiz).not.toHaveBeenCalled();
        expect(order[0]).toBe('canonical');
        expect(order).toEqual(expect.arrayContaining(['local-draft', 'remote-draft', 'refresh']));
        expect(quizStoreMocks.loadQuizzes).toHaveBeenCalledWith({ force: true });
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(useManualQuizWorkspaceStore.getState().envelope).toBeNull();
    });

    it('updates an existing quiz instead of creating a new one', async () => {
        initializeValidDraft(true);
        const { result } = renderHook(() => useManualQuizPublish({
            envelope: useManualQuizWorkspaceStore.getState().envelope,
        }));

        await act(async () => { await result.current.publish(); });

        expect(quizStoreMocks.modifyQuiz).toHaveBeenCalledTimes(1);
        expect(quizStoreMocks.createQuiz).not.toHaveBeenCalled();
    });

    it('keeps both drafts after canonical save failure and can retry', async () => {
        quizStoreMocks.createQuiz.mockRejectedValueOnce(new Error('D1 tạm thời lỗi'));
        const onSuccess = vi.fn();
        const { result } = renderHook(() => useManualQuizPublish({
            envelope: useManualQuizWorkspaceStore.getState().envelope,
            onSuccess,
        }));

        let first = true;
        await act(async () => { first = await result.current.publish(); });
        expect(first).toBe(false);
        expect(result.current.error).toContain('D1 tạm thời lỗi');
        expect(cleanupMocks.removeLocalDraft).not.toHaveBeenCalled();
        expect(cleanupMocks.deleteRemoteDraft).not.toHaveBeenCalled();
        expect(useManualQuizWorkspaceStore.getState().envelope).not.toBeNull();

        let second = false;
        await act(async () => { second = await result.current.publish(); });
        expect(second).toBe(true);
        expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it('rejects an invalid final snapshot without calling canonical save', async () => {
        useManualQuizWorkspaceStore.getState().updateQuiz({ title: '  ' });
        const { result } = renderHook(() => useManualQuizPublish({
            envelope: useManualQuizWorkspaceStore.getState().envelope,
        }));

        let published = true;
        await act(async () => { published = await result.current.publish(); });

        expect(published).toBe(false);
        expect(result.current.validationIssues).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'QUIZ_TITLE_REQUIRED', severity: 'error' }),
        ]));
        expect(quizStoreMocks.createQuiz).not.toHaveBeenCalled();
    });

    it('uses a mutex to ignore a second publish while the first request is in flight', async () => {
        const pending = deferred<void>();
        quizStoreMocks.createQuiz.mockReturnValueOnce(pending.promise);
        const { result } = renderHook(() => useManualQuizPublish({
            envelope: useManualQuizWorkspaceStore.getState().envelope,
        }));

        let firstPromise!: Promise<boolean>;
        let secondResult = true;
        act(() => {
            firstPromise = result.current.publish();
            void result.current.publish().then((value) => { secondResult = value; });
        });
        expect(quizStoreMocks.createQuiz).toHaveBeenCalledTimes(1);

        pending.resolve(undefined);
        await act(async () => { await firstPromise; await Promise.resolve(); });
        expect(secondResult).toBe(false);
        expect(quizStoreMocks.createQuiz).toHaveBeenCalledTimes(1);
    });

    it('still completes canonical publish when draft cleanup is unavailable', async () => {
        cleanupMocks.deleteRemoteDraft.mockRejectedValueOnce(new Error('offline'));
        const onSuccess = vi.fn();
        const { result } = renderHook(() => useManualQuizPublish({
            envelope: useManualQuizWorkspaceStore.getState().envelope,
            onSuccess,
        }));

        await act(async () => { await result.current.publish(); });

        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(result.current.cleanupWarning).toContain('bản nháp');
    });
});

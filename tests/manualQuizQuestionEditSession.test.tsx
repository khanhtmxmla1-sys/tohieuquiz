import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType } from '../src/types';
import type { AnyEditorDraft } from '../src/features/quiz-editor/types/quiz-editor.types';
import { useQuestionEditSession } from '../src/features/manual-quiz-workspace/hooks/useQuestionEditSession';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';
import type { ManualQuizQuestion } from '../src/features/manual-quiz-workspace/types/manualQuizWorkspace.types';
import { getManualQuizDraftKey } from '../src/features/manual-quiz-workspace/draft/manualQuizDraftRepository';

const seed = {
    title: 'Đề Toán lớp 4',
    classLevel: '4A',
    category: 'toan',
    timeLimit: 20,
    tags: [],
    requireCode: false,
    showOnHome: true,
};

const firstQuestion: ManualQuizQuestion = {
    id: 'q-1',
    type: QuestionType.MCQ,
    question: 'Câu hỏi ban đầu',
    options: ['1', '2', '3', '4'],
    correctAnswer: 'B',
    difficulty: 1,
    points: 1.5,
    explanation: 'Giải thích ban đầu',
    imageAlt: 'Ảnh ban đầu',
    showExplanation: false,
};

const secondQuestion: ManualQuizQuestion = {
    id: 'q-2',
    type: QuestionType.MCQ,
    question: 'Câu hỏi tiếp theo',
    options: ['A', 'B'],
    correctAnswer: 'A',
    difficulty: 2,
    points: 2,
};

describe('useQuestionEditSession', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    beforeEach(() => {
        vi.useFakeTimers();
        useManualQuizWorkspaceStore.getState().reset();
        useManualQuizWorkspaceStore.getState().initializeFromSeed(seed, 'teacher-a');
        useManualQuizWorkspaceStore.getState().addQuestion(firstQuestion);
        useManualQuizWorkspaceStore.getState().addQuestion(secondQuestion);
        useManualQuizWorkspaceStore.getState().selectQuestion(firstQuestion.id);
    });

    it('flushes the latest draft before switching questions and preserves question metadata', () => {
        const question = useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0];
        const persistLocalNow = vi.fn();
        const result = renderHook(() => useQuestionEditSession(question, false, { persistLocalNow }));

        act(() => {
            result.result.current.onDraftChange((draft) => ({
                ...draft,
                question: 'Nội dung vừa sửa',
            }) as AnyEditorDraft);
        });

        expect(result.result.current.dirty).toBe(true);
        expect(result.result.current.previewQuestion.question).toBe('Nội dung vừa sửa');

        let flushResult: ReturnType<typeof result.result.current.flush> | undefined;
        act(() => {
            flushResult = result.result.current.flush();
            if (flushResult.ok) {
                useManualQuizWorkspaceStore.getState().selectQuestion(secondQuestion.id);
            }
        });

        expect(flushResult).toEqual({ ok: true });
        expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe(secondQuestion.id);
        expect(useManualQuizWorkspaceStore.getState().envelope?.quiz.questions[0]).toEqual(
            expect.objectContaining({
                question: 'Nội dung vừa sửa',
                points: 1.5,
                explanation: 'Giải thích ban đầu',
                imageAlt: 'Ảnh ban đầu',
                showExplanation: false,
            }),
        );
        expect(persistLocalNow).toHaveBeenCalledWith(
            expect.objectContaining({
                quiz: expect.objectContaining({
                    questions: expect.arrayContaining([
                        expect.objectContaining({ question: 'Nội dung vừa sửa' }),
                    ]),
                }),
            }),
        );
        expect(result.result.current.dirty).toBe(false);
    });

    it('keeps the latest draft and blocks a transition when local persistence fails', () => {
        const question = useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0];
        const persistLocalNow = vi.fn(() => {
            throw new DOMException('Quota exceeded', 'QuotaExceededError');
        });
        const result = renderHook(() => useQuestionEditSession(question, false, { persistLocalNow }));

        act(() => {
            result.result.current.onDraftChange((draft) => ({
                ...draft,
                question: 'Bản nháp chưa thể lưu',
            }) as AnyEditorDraft);
        });

        let flushResult: ReturnType<typeof result.result.current.flush> | undefined;
        act(() => {
            flushResult = result.result.current.flush();
            if (flushResult.ok) useManualQuizWorkspaceStore.getState().selectQuestion(secondQuestion.id);
        });

        expect(flushResult).toEqual({
            ok: false,
            error: expect.stringMatching(/lưu bản nháp|trình duyệt/i),
        });
        expect(useManualQuizWorkspaceStore.getState().envelope?.selectedQuestionId).toBe(firstQuestion.id);
        expect(result.result.current.draft.question).toBe('Bản nháp chưa thể lưu');
        expect(result.result.current.previewQuestion.question).toBe('Bản nháp chưa thể lưu');
        expect(result.result.current.dirty).toBe(true);
        expect(result.result.current.error).toEqual(expect.stringMatching(/lưu bản nháp|trình duyệt/i));
    });

    it('resyncs a clean session when the same question id is replaced externally', () => {
        const question = useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0];
        const result = renderHook(
            ({ currentQuestion }) => useQuestionEditSession(currentQuestion, false),
            { initialProps: { currentQuestion: question } },
        );
        const externallyUpdatedQuestion = {
            ...question,
            question: 'Nội dung vừa được cập nhật bên ngoài',
        };

        act(() => {
            useManualQuizWorkspaceStore.getState().updateQuestion(
                question.id,
                () => externallyUpdatedQuestion,
            );
            result.rerender({
                currentQuestion: useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0],
            });
        });

        expect(result.result.current.dirty).toBe(false);
        expect(result.result.current.draft.question).toBe(externallyUpdatedQuestion.question);
        expect(result.result.current.previewQuestion.question).toBe(externallyUpdatedQuestion.question);
    });

    it('preserves a dirty local draft when the same question id is replaced externally', () => {
        const question = useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0];
        const result = renderHook(
            ({ currentQuestion }) => useQuestionEditSession(currentQuestion, false),
            { initialProps: { currentQuestion: question } },
        );

        act(() => {
            result.result.current.onDraftChange((draft) => ({
                ...draft,
                question: 'Bản nháp đang gõ tại máy này',
            }) as AnyEditorDraft);
            useManualQuizWorkspaceStore.getState().updateQuestion(
                question.id,
                () => ({
                    ...question,
                    question: 'Nội dung vừa được cập nhật bên ngoài',
                }),
            );
            result.rerender({
                currentQuestion: useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0],
            });
        });

        expect(result.result.current.dirty).toBe(true);
        expect(result.result.current.draft.question).toBe('Bản nháp đang gõ tại máy này');
    });

    it('warns beforeunload during the draft debounce and clears the guard after flush', () => {
        const question = useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0];
        const persistLocalNow = vi.fn();
        const result = renderHook(() => useQuestionEditSession(question, false, { persistLocalNow }));

        act(() => {
            result.result.current.onDraftChange((draft) => ({
                ...draft,
                question: 'Bản nháp vừa gõ',
            }) as AnyEditorDraft);
        });

        const duringDebounce = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(duringDebounce);
        expect(duringDebounce.defaultPrevented).toBe(true);

        act(() => {
            expect(result.result.current.flush()).toEqual({ ok: true });
        });

        const afterFlush = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(afterFlush);
        expect(afterFlush.defaultPrevented).toBe(false);

        result.unmount();
        const afterUnmount = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(afterUnmount);
        expect(afterUnmount.defaultPrevented).toBe(false);
    });

    it('allows incomplete math content to be saved as a draft', () => {
        const question = {
            ...useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0],
            question: 'Tính $\\frac{1}{2',
        };
        useManualQuizWorkspaceStore.getState().updateQuestion(question.id, () => question);
        const persistLocalNow = vi.fn();
        const result = renderHook(() => useQuestionEditSession(question, false, { persistLocalNow }));

        let flushResult: ReturnType<typeof result.result.current.flush> | undefined;
        act(() => {
            flushResult = result.result.current.flush();
        });

        expect(flushResult).toEqual({ ok: true });
        expect(persistLocalNow).toHaveBeenCalledTimes(1);
        expect(useManualQuizWorkspaceStore.getState().envelope?.quiz.questions[0].question)
            .toBe('Tính $\\frac{1}{2');
    });

    it('uses the shared local draft repository when no page controller is injected', () => {
        const question = useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0];
        const envelope = useManualQuizWorkspaceStore.getState().envelope!;
        const result = renderHook(() => useQuestionEditSession(question, false));

        act(() => {
            result.result.current.onDraftChange((draft) => ({
                ...draft,
                question: 'Bản nháp có thể khôi phục',
            }) as AnyEditorDraft);
            expect(result.result.current.flush()).toEqual({ ok: true });
        });

        expect(localStorage.getItem(getManualQuizDraftKey(envelope.ownerUsername, envelope.draftId)))
            .toContain('Bản nháp có thể khôi phục');
    });

    it('does not mutate or persist when read-only', () => {
        const question = useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0];
        const persistLocalNow = vi.fn();
        const result = renderHook(() => useQuestionEditSession(question, true, { persistLocalNow }));

        act(() => {
            result.result.current.onDraftChange((draft) => ({
                ...draft,
                question: 'Không được sửa',
            }) as AnyEditorDraft);
        });

        expect(result.result.current.draft.question).toBe(firstQuestion.question);
        expect(result.result.current.dirty).toBe(false);
        expect(result.result.current.flush()).toEqual({ ok: true });
        expect(persistLocalNow).not.toHaveBeenCalled();
        expect(useManualQuizWorkspaceStore.getState().envelope?.quiz.questions[0].question)
            .toBe(firstQuestion.question);
    });
});

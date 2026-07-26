import { beforeEach, describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import {
    selectManualQuizIssueCount,
    selectManualQuizTotalPoints,
    selectManualQuizWarningCount,
} from '../src/features/manual-quiz-workspace/store/manualQuizWorkspaceSelectors';
import { useManualQuizWorkspaceStore } from '../src/features/manual-quiz-workspace/store/useManualQuizWorkspaceStore';

const seed = {
    title: 'Đề Toán lớp 4',
    classLevel: '4A',
    category: 'toan',
    timeLimit: 20,
    tags: ['phân số'],
    requireCode: false,
    showOnHome: true,
};

const makeQuestion = (id: string, question: string, points = 1) => ({
    id,
    type: QuestionType.MCQ,
    question,
    options: ['1', '2'],
    correctAnswer: 'B',
    difficulty: 1 as const,
    points,
});

describe('manual quiz workspace store', () => {
    beforeEach(() => {
        useManualQuizWorkspaceStore.getState().reset();
    });

    it('initializes an isolated draft envelope from navigation seed', () => {
        useManualQuizWorkspaceStore.getState().initializeFromSeed(seed, 'teacher-a');
        const state = useManualQuizWorkspaceStore.getState();

        expect(state.envelope).toEqual(expect.objectContaining({
            schemaVersion: 1,
            ownerUsername: 'teacher-a',
            revision: 0,
            selectedQuestionId: null,
            targetPoints: 10,
        }));
        expect(state.envelope?.quiz).toEqual(expect.objectContaining({
            title: 'Đề Toán lớp 4',
            classLevel: '4A',
            questions: [],
        }));
    });

    it('updates questions immutably and keeps stable ids', () => {
        const store = useManualQuizWorkspaceStore.getState();
        store.initializeFromSeed(seed, 'teacher-a');
        store.addQuestion(makeQuestion('q-1', 'Câu cũ'));
        const previousQuestion = useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0];

        useManualQuizWorkspaceStore.getState().updateQuestion('q-1', (question) => ({
            ...question,
            question: 'Câu mới',
        }));
        const nextQuestion = useManualQuizWorkspaceStore.getState().envelope!.quiz.questions[0];

        expect(nextQuestion.id).toBe('q-1');
        expect(nextQuestion).not.toBe(previousQuestion);
        expect((nextQuestion as any).question).toBe('Câu mới');
    });

    it('duplicates, reorders, removes and selects without mutating source ids', () => {
        const store = useManualQuizWorkspaceStore.getState();
        store.initializeFromSeed(seed, 'teacher-a');
        store.addQuestion(makeQuestion('q-1', 'Một'));
        useManualQuizWorkspaceStore.getState().addQuestion(makeQuestion('q-2', 'Hai'));

        useManualQuizWorkspaceStore.getState().duplicateQuestion('q-1');
        let state = useManualQuizWorkspaceStore.getState();
        const duplicateId = state.envelope!.selectedQuestionId!;
        expect(duplicateId).not.toBe('q-1');
        expect(state.envelope!.quiz.questions.map((question) => question.id)).toEqual(['q-1', duplicateId, 'q-2']);

        useManualQuizWorkspaceStore.getState().reorderQuestion('q-2', 'q-1');
        state = useManualQuizWorkspaceStore.getState();
        expect(state.envelope!.quiz.questions.map((question) => question.id)).toEqual(['q-2', 'q-1', duplicateId]);

        useManualQuizWorkspaceStore.getState().removeQuestion('q-1');
        state = useManualQuizWorkspaceStore.getState();
        expect(state.envelope!.quiz.questions.map((question) => question.id)).toEqual(['q-2', duplicateId]);
        expect(state.envelope!.selectedQuestionId).toBe(duplicateId);
    });

    it('derives point totals and actionable quality counts', () => {
        const store = useManualQuizWorkspaceStore.getState();
        store.initializeFromSeed(seed, 'teacher-a');
        store.addQuestion(makeQuestion('q-1', 'Đủ dữ liệu', 2.5));
        useManualQuizWorkspaceStore.getState().addQuestion({
            ...makeQuestion('q-2', '', 0),
            options: ['', ''],
            correctAnswer: '',
        });

        const state = useManualQuizWorkspaceStore.getState();
        expect(selectManualQuizTotalPoints(state)).toBe(2.5);
        expect(selectManualQuizIssueCount(state)).toBeGreaterThanOrEqual(2);
        expect(selectManualQuizWarningCount(state)).toBeGreaterThanOrEqual(1);
    });
});

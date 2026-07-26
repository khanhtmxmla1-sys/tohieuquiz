import { create } from 'zustand';
import type { Quiz } from '../../../types';
import type {
    ManualQuizDraftEnvelope,
    ManualQuizQuestion,
    ManualQuizSaveStatus,
    ManualQuizSeed,
} from '../types/manualQuizWorkspace.types';

let fallbackId = 0;

const createWorkspaceId = (prefix: string): string => {
    const randomUuid = globalThis.crypto?.randomUUID?.();
    if (randomUuid) return `${prefix}-${randomUuid}`;
    fallbackId += 1;
    return `${prefix}-fallback-${fallbackId}`;
};

const nowIso = (): string => new Date().toISOString();

const touchEnvelope = (
    envelope: ManualQuizDraftEnvelope,
    patch: Partial<ManualQuizDraftEnvelope>,
): ManualQuizDraftEnvelope => ({
    ...envelope,
    ...patch,
    updatedAt: nowIso(),
});

interface ManualQuizWorkspaceState {
    envelope: ManualQuizDraftEnvelope | null;
    saveStatus: ManualQuizSaveStatus;
    saveError: string | null;
    isNavigatorCollapsed: boolean;
    isPreviewCollapsed: boolean;
    initializeFromSeed(seed: ManualQuizSeed, ownerUsername: string): void;
    initializeFromQuiz(quiz: Quiz, ownerUsername: string): void;
    hydrateEnvelope(envelope: ManualQuizDraftEnvelope): void;
    replaceEnvelope(envelope: ManualQuizDraftEnvelope): void;
    acknowledgeRemoteRevision(revision: number, updatedAt?: string): void;
    updateQuiz(patch: Partial<ManualQuizDraftEnvelope['quiz']>): void;
    selectQuestion(questionId: string | null): void;
    addQuestion(question: ManualQuizQuestion): void;
    addQuestions(questions: ManualQuizQuestion[]): void;
    removeQuestions(questionIds: string[]): void;
    replaceQuestions(questions: ManualQuizQuestion[], selectedQuestionId?: string | null): void;
    bulkUpdateQuestions(
        questionIds: string[],
        patch: Partial<Pick<ManualQuizQuestion, 'difficulty' | 'points' | 'explanation'>>,
    ): void;
    updateQuestion(
        questionId: string,
        updater: (question: ManualQuizQuestion) => ManualQuizQuestion,
    ): void;
    duplicateQuestion(questionId: string): void;
    removeQuestion(questionId: string): void;
    restoreQuestion(question: ManualQuizQuestion, index: number): void;
    moveQuestion(questionId: string, offset: -1 | 1): void;
    reorderQuestion(activeId: string, overId: string): void;
    setQuestionPoints(pointsByQuestionId: Record<string, number>): void;
    setTargetPoints(targetPoints: number): void;
    setSaveStatus(status: ManualQuizSaveStatus, error?: string | null): void;
    setNavigatorCollapsed(collapsed: boolean): void;
    setPreviewCollapsed(collapsed: boolean): void;
    reset(): void;
}

const initialState = {
    envelope: null,
    saveStatus: 'idle' as ManualQuizSaveStatus,
    saveError: null,
    isNavigatorCollapsed: false,
    isPreviewCollapsed: false,
};

export const useManualQuizWorkspaceStore = create<ManualQuizWorkspaceState>((set) => ({
    ...initialState,

    initializeFromSeed: (seed, ownerUsername) => {
        const createdAt = nowIso();
        const quizId = createWorkspaceId('quiz-manual');
        set({
            ...initialState,
            envelope: {
                schemaVersion: 1,
                draftId: createWorkspaceId('draft'),
                ownerUsername,
                revision: 0,
                quiz: {
                    id: quizId,
                    title: seed.title,
                    classLevel: seed.classLevel,
                    category: seed.category,
                    timeLimit: seed.timeLimit,
                    tags: [...seed.tags],
                    requireCode: seed.requireCode,
                    accessCode: seed.accessCode,
                    showOnHome: seed.showOnHome,
                    createdAt,
                    createdBy: ownerUsername,
                    questions: [],
                },
                selectedQuestionId: null,
                targetPoints: 10,
                updatedAt: createdAt,
            },
        });
    },

    initializeFromQuiz: (quiz, ownerUsername) => {
        const updatedAt = nowIso();
        set({
            ...initialState,
            envelope: {
                schemaVersion: 1,
                draftId: createWorkspaceId('draft'),
                quizId: quiz.id,
                ownerUsername,
                revision: 0,
                quiz: {
                    ...quiz,
                    questions: quiz.questions.map((question) => ({ ...question })),
                },
                selectedQuestionId: quiz.questions[0]?.id ?? null,
                targetPoints: 10,
                updatedAt,
            },
        });
    },

    hydrateEnvelope: (envelope) => set({
        ...initialState,
        envelope: {
            ...envelope,
            quiz: {
                ...envelope.quiz,
                questions: envelope.quiz.questions.map((question) => ({ ...question })),
            },
        },
    }),

    replaceEnvelope: (envelope) => set((state) => ({
        envelope: {
            ...envelope,
            quiz: {
                ...envelope.quiz,
                questions: envelope.quiz.questions.map((question) => ({ ...question })),
            },
        },
        saveStatus: 'saved',
        saveError: null,
        isNavigatorCollapsed: state.isNavigatorCollapsed,
        isPreviewCollapsed: state.isPreviewCollapsed,
    })),

    acknowledgeRemoteRevision: (revision, updatedAt) => set((state) => state.envelope ? ({
        envelope: {
            ...state.envelope,
            revision,
            updatedAt: updatedAt || state.envelope.updatedAt,
        },
    }) : state),

    updateQuiz: (patch) => set((state) => state.envelope ? ({
        envelope: touchEnvelope(state.envelope, {
            quiz: { ...state.envelope.quiz, ...patch },
        }),
        saveStatus: 'idle',
        saveError: null,
    }) : state),

    selectQuestion: (questionId) => set((state) => state.envelope ? ({
        envelope: touchEnvelope(state.envelope, { selectedQuestionId: questionId }),
    }) : state),

    addQuestion: (question) => set((state) => state.envelope ? ({
        envelope: touchEnvelope(state.envelope, {
            quiz: {
                ...state.envelope.quiz,
                questions: [...state.envelope.quiz.questions, { ...question }],
            },
            selectedQuestionId: question.id,
        }),
        saveStatus: 'idle',
        saveError: null,
    }) : state),

    addQuestions: (questions) => set((state) => {
        if (!state.envelope || questions.length === 0) return state;
        const clones = questions.map((question) => ({ ...question }));
        return {
            envelope: touchEnvelope(state.envelope, {
                quiz: {
                    ...state.envelope.quiz,
                    questions: [...state.envelope.quiz.questions, ...clones],
                },
                selectedQuestionId: clones[clones.length - 1].id,
            }),
            saveStatus: 'idle',
            saveError: null,
        };
    }),

    replaceQuestions: (questions, selectedQuestionId) => set((state) => state.envelope ? ({
        envelope: touchEnvelope(state.envelope, {
            quiz: {
                ...state.envelope.quiz,
                questions: questions.map((question) => ({ ...question })),
            },
            selectedQuestionId: selectedQuestionId === undefined
                ? state.envelope.selectedQuestionId
                : selectedQuestionId,
        }),
        saveStatus: 'idle',
        saveError: null,
    }) : state),

    bulkUpdateQuestions: (questionIds, patch) => set((state) => {
        if (!state.envelope || questionIds.length === 0) return state;
        const idSet = new Set(questionIds);
        return {
            envelope: touchEnvelope(state.envelope, {
                quiz: {
                    ...state.envelope.quiz,
                    questions: state.envelope.quiz.questions.map((question) => idSet.has(question.id)
                        ? { ...question, ...patch }
                        : question),
                },
            }),
            saveStatus: 'idle',
            saveError: null,
        };
    }),

    removeQuestions: (questionIds) => set((state) => {
        if (!state.envelope || questionIds.length === 0) return state;
        const idSet = new Set(questionIds);
        const questions = state.envelope.quiz.questions.filter((question) => !idSet.has(question.id));
        const selectedQuestionId = state.envelope.selectedQuestionId && idSet.has(state.envelope.selectedQuestionId)
            ? questions[questions.length - 1]?.id ?? null
            : state.envelope.selectedQuestionId;
        return {
            envelope: touchEnvelope(state.envelope, {
                quiz: { ...state.envelope.quiz, questions },
                selectedQuestionId,
            }),
            saveStatus: 'idle',
            saveError: null,
        };
    }),

    updateQuestion: (questionId, updater) => set((state) => {
        if (!state.envelope) return state;
        const questions = state.envelope.quiz.questions.map((question) =>
            question.id === questionId ? updater({ ...question }) : question,
        );
        return {
            envelope: touchEnvelope(state.envelope, {
                quiz: { ...state.envelope.quiz, questions },
            }),
            saveStatus: 'idle',
            saveError: null,
        };
    }),

    duplicateQuestion: (questionId) => set((state) => {
        if (!state.envelope) return state;
        const sourceIndex = state.envelope.quiz.questions.findIndex((question) => question.id === questionId);
        if (sourceIndex < 0) return state;
        const source = state.envelope.quiz.questions[sourceIndex];
        const duplicate = { ...source, id: createWorkspaceId('question') } as ManualQuizQuestion;
        const questions = [...state.envelope.quiz.questions];
        questions.splice(sourceIndex + 1, 0, duplicate);
        return {
            envelope: touchEnvelope(state.envelope, {
                quiz: { ...state.envelope.quiz, questions },
                selectedQuestionId: duplicate.id,
            }),
            saveStatus: 'idle',
            saveError: null,
        };
    }),

    removeQuestion: (questionId) => set((state) => {
        if (!state.envelope) return state;
        const sourceIndex = state.envelope.quiz.questions.findIndex((question) => question.id === questionId);
        if (sourceIndex < 0) return state;
        const questions = state.envelope.quiz.questions.filter((question) => question.id !== questionId);
        const selectedQuestionId = state.envelope.selectedQuestionId === questionId
            ? questions[Math.min(sourceIndex, questions.length - 1)]?.id ?? null
            : state.envelope.selectedQuestionId;
        return {
            envelope: touchEnvelope(state.envelope, {
                quiz: { ...state.envelope.quiz, questions },
                selectedQuestionId,
            }),
            saveStatus: 'idle',
            saveError: null,
        };
    }),

    restoreQuestion: (question, index) => set((state) => {
        if (!state.envelope) return state;
        if (state.envelope.quiz.questions.some((item) => item.id === question.id)) return state;
        const questions = [...state.envelope.quiz.questions];
        const safeIndex = Math.max(0, Math.min(index, questions.length));
        questions.splice(safeIndex, 0, { ...question });
        return {
            envelope: touchEnvelope(state.envelope, {
                quiz: { ...state.envelope.quiz, questions },
                selectedQuestionId: question.id,
            }),
            saveStatus: 'idle',
            saveError: null,
        };
    }),

    moveQuestion: (questionId, offset) => set((state) => {
        if (!state.envelope) return state;
        const questions = [...state.envelope.quiz.questions];
        const sourceIndex = questions.findIndex((question) => question.id === questionId);
        const targetIndex = sourceIndex + offset;
        if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= questions.length) return state;
        const [question] = questions.splice(sourceIndex, 1);
        questions.splice(targetIndex, 0, question);
        return {
            envelope: touchEnvelope(state.envelope, {
                quiz: { ...state.envelope.quiz, questions },
                selectedQuestionId: questionId,
            }),
            saveStatus: 'idle',
            saveError: null,
        };
    }),

    reorderQuestion: (activeId, overId) => set((state) => {
        if (!state.envelope || activeId === overId) return state;
        const questions = [...state.envelope.quiz.questions];
        const activeIndex = questions.findIndex((question) => question.id === activeId);
        const overIndex = questions.findIndex((question) => question.id === overId);
        if (activeIndex < 0 || overIndex < 0) return state;
        const [activeQuestion] = questions.splice(activeIndex, 1);
        questions.splice(overIndex, 0, activeQuestion);
        return {
            envelope: touchEnvelope(state.envelope, {
                quiz: { ...state.envelope.quiz, questions },
            }),
            saveStatus: 'idle',
            saveError: null,
        };
    }),

    setQuestionPoints: (pointsByQuestionId) => set((state) => {
        if (!state.envelope) return state;
        const questions = state.envelope.quiz.questions.map((question) => (
            Object.prototype.hasOwnProperty.call(pointsByQuestionId, question.id)
                ? { ...question, points: Number(pointsByQuestionId[question.id]) }
                : question
        ));
        return {
            envelope: touchEnvelope(state.envelope, {
                quiz: { ...state.envelope.quiz, questions },
            }),
            saveStatus: 'idle',
            saveError: null,
        };
    }),

    setTargetPoints: (targetPoints) => set((state) => state.envelope ? ({
        envelope: touchEnvelope(state.envelope, {
            targetPoints: Number.isFinite(targetPoints) && targetPoints > 0 ? targetPoints : 10,
        }),
        saveStatus: 'idle',
    }) : state),

    setSaveStatus: (saveStatus, saveError = null) => set({ saveStatus, saveError }),
    setNavigatorCollapsed: (isNavigatorCollapsed) => set({ isNavigatorCollapsed }),
    setPreviewCollapsed: (isPreviewCollapsed) => set({ isPreviewCollapsed }),
    reset: () => set({ ...initialState }),
}));

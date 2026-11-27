import type { Question } from '../../../types';
import type { QuizAttemptDraft } from '../quizAttemptDraft';

interface QuizDraftResume {
    restoredOrder: Question[];
    canResumeDraft: boolean;
}

export const resolveQuizDraftResume = (
    restoredDraft: QuizAttemptDraft | null,
    resolvedQuestions: Question[],
): QuizDraftResume => {
    const loadedById = new Map(resolvedQuestions.map((question) => [String(question.id), question]));
    const restoredOrder = restoredDraft
        ? restoredDraft.questionOrder
            .map((questionId) => loadedById.get(questionId))
            .filter((question): question is Question => Boolean(question))
        : [];
    const canResumeDraft = Boolean(
        restoredDraft
        && restoredOrder.length === resolvedQuestions.length
        && restoredOrder.length === restoredDraft.questionOrder.length,
    );

    return { restoredOrder, canResumeDraft };
};

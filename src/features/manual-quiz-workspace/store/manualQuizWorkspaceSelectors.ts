import { QuestionType } from '../../../types';
import type { ManualQuizQuestion } from '../types/manualQuizWorkspace.types';
import type { useManualQuizWorkspaceStore } from './useManualQuizWorkspaceStore';

type ManualQuizWorkspaceState = ReturnType<typeof useManualQuizWorkspaceStore.getState>;

const questionPrompt = (question: ManualQuizQuestion): string => {
    if (question.type === QuestionType.TRUE_FALSE) {
        return String((question as any).mainQuestion || '').trim();
    }
    return String((question as any).question || '').trim();
};

const hasCorrectAnswer = (question: ManualQuizQuestion): boolean => {
    const data = question as any;
    switch (question.type) {
        case QuestionType.MCQ:
        case QuestionType.IMAGE_QUESTION:
        case QuestionType.SHORT_ANSWER:
        case QuestionType.WORD_SCRAMBLE:
        case QuestionType.ERROR_CORRECTION:
            return String(data.correctAnswer || data.correctWord || '').trim().length > 0;
        case QuestionType.MULTIPLE_SELECT:
            return Array.isArray(data.correctAnswers) && data.correctAnswers.length > 0;
        case QuestionType.TRUE_FALSE:
            return Array.isArray(data.items) && data.items.length > 0;
        case QuestionType.MATCHING:
            return Array.isArray(data.pairs) && data.pairs.length > 0;
        case QuestionType.ORDERING:
            return Array.isArray(data.items) && data.items.length > 0;
        default:
            return true;
    }
};

export const selectManualQuizTotalPoints = (state: ManualQuizWorkspaceState): number =>
    state.envelope?.quiz.questions.reduce((total, question) => {
        const points = Number((question as ManualQuizQuestion).points);
        return total + (Number.isFinite(points) && points > 0 ? points : 0);
    }, 0) ?? 0;

export const selectManualQuizIssueCount = (state: ManualQuizWorkspaceState): number => {
    if (!state.envelope) return 0;
    let issues = state.envelope.quiz.title.trim() ? 0 : 1;
    if (state.envelope.quiz.questions.length === 0) issues += 1;
    for (const question of state.envelope.quiz.questions) {
        if (!questionPrompt(question)) issues += 1;
        if (!hasCorrectAnswer(question)) issues += 1;
    }
    return issues;
};

export const selectManualQuizWarningCount = (state: ManualQuizWorkspaceState): number => {
    if (!state.envelope) return 0;
    let warnings = 0;
    for (const question of state.envelope.quiz.questions) {
        const points = Number(question.points);
        if (!Number.isFinite(points) || points <= 0) warnings += 1;
        if (!(question as any).difficulty) warnings += 1;
    }
    if (Math.abs(selectManualQuizTotalPoints(state) - state.envelope.targetPoints) > 0.001) warnings += 1;
    return warnings;
};

export const selectManualQuizSummary = (state: ManualQuizWorkspaceState) => ({
    questionCount: state.envelope?.quiz.questions.length ?? 0,
    totalPoints: selectManualQuizTotalPoints(state),
    issueCount: selectManualQuizIssueCount(state),
    warningCount: selectManualQuizWarningCount(state),
});

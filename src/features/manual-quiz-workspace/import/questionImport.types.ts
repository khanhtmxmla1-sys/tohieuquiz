import type { ManualQuizQuestion } from '../types/manualQuizWorkspace.types';

export type QuestionImportStatus = 'accepted' | 'needsReview' | 'rejected';

export interface QuestionImportCandidate {
    id: string;
    sourceRow: number;
    sourceLabel: string;
    status: QuestionImportStatus;
    issues: string[];
    question: ManualQuizQuestion;
}

export interface QuestionImportResult {
    accepted: QuestionImportCandidate[];
    needsReview: QuestionImportCandidate[];
    rejected: QuestionImportCandidate[];
}

export const createEmptyQuestionImportResult = (): QuestionImportResult => ({
    accepted: [],
    needsReview: [],
    rejected: [],
});

export const appendImportCandidate = (
    result: QuestionImportResult,
    candidate: QuestionImportCandidate,
): void => {
    result[candidate.status].push(candidate);
};

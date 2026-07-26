import type { QuestionSnapshot, StudentResult } from '../../../../../types';

export interface NormalizedAnswer {
    selectedAnswer: any;
    isCorrect?: boolean;
    timeSpent?: number;
    snapshot?: QuestionSnapshot;
}

export const isAnswerSkipped = (value: any): boolean => {
    if (value === undefined || value === null || value === '') return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') {
        const meaningfulEntries = Object.entries(value)
            .filter(([key]) => key !== 'selectedLeft' && key !== '__shuffledIds');
        return meaningfulEntries.length === 0
            || meaningfulEntries.every(([, item]) => isAnswerSkipped(item));
    }
    return false;
};

export const normalizeResultAnswer = (
    result: StudentResult,
    questionId: string,
    answerData: any
): NormalizedAnswer => {
    if (answerData && typeof answerData === 'object'
        && ('selectedAnswer' in answerData || 'questionSnapshot' in answerData)) {
        return {
            selectedAnswer: answerData.selectedAnswer,
            isCorrect: typeof answerData.isCorrect === 'boolean'
                ? answerData.isCorrect
                : undefined,
            timeSpent: answerData.timeSpent,
            snapshot: answerData.questionSnapshot,
        };
    }
    const validation = result.validationDetails?.find(
        (item) => item.questionId === questionId
    );
    return {
        selectedAnswer: answerData,
        isCorrect: typeof validation?.isCorrect === 'boolean'
            ? validation.isCorrect
            : undefined,
    };
};

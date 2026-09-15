import type {
    AnswerReviewValue,
    QuestionAnswerReview,
    ReviewBlankPresentation,
    ReviewCategorizationPresentation,
    ReviewChoicePresentation,
    ReviewErrorCorrectionPresentation,
    ReviewMatchingPresentation,
    ReviewOrderingPresentation,
    ReviewPresentation,
    ReviewTextAnswerPresentation,
    ReviewTrueFalsePresentation,
    ReviewUnderlinePresentation,
    ReviewWordScramblePresentation,
} from '../../../domain/quiz-scoring';

export type StudentReviewOutcome = 'correct' | 'incorrect' | 'skipped' | 'voided';

export const asQuestionRecord = (question: unknown): Record<string, unknown> => (
    question && typeof question === 'object' ? question as Record<string, unknown> : {}
);

export const hasReviewLines = (value: AnswerReviewValue | undefined): value is AnswerReviewValue => (
    Boolean(value && value.lines.length > 0)
);

export const displayValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return 'Chưa trả lời';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (Array.isArray(value)) {
        const values = value
            .filter((item) => item !== null && item !== undefined && typeof item !== 'object')
            .map((item) => String(item));
        return values.length > 0 ? values.join(', ') : 'Đã lưu câu trả lời';
    }
    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        if (Array.isArray(record.optionIds)) return displayValue(record.optionIds);
        if (typeof record.optionId === 'string') return record.optionId;
        if (record.values && typeof record.values === 'object') return displayValue(record.values);
        if (record.ranks && typeof record.ranks === 'object') return displayValue(record.ranks);
        return 'Đã lưu câu trả lời';
    }
    return 'Đã lưu câu trả lời';
};

export const fallbackReviewValue = (
    value: AnswerReviewValue | undefined,
    selectedAnswer: unknown,
): AnswerReviewValue => (
    hasReviewLines(value)
        ? value
        : { kind: 'text', lines: [{ value: displayValue(selectedAnswer) }] }
);

export const reviewPresentationOf = (
    reviewDetail: QuestionAnswerReview | undefined,
): ReviewPresentation | undefined => reviewDetail?.presentation;

export const isTrustedPresentation = (
    presentation: ReviewPresentation | undefined,
): presentation is Exclude<ReviewPresentation, { type: 'UNSUPPORTED' }> => (
    Boolean(presentation && presentation.type !== 'UNSUPPORTED' && presentation.source !== 'legacy-unverified')
);

export const isLegacyOrUnsupported = (presentation: ReviewPresentation | undefined): boolean => (
    presentation?.type === 'UNSUPPORTED' || presentation?.source === 'legacy-unverified'
);

export const choicePresentationOf = (
    presentation: ReviewPresentation | undefined,
): ReviewChoicePresentation | undefined => (
    isTrustedPresentation(presentation)
        && (presentation.type === 'MCQ' || presentation.type === 'IMAGE_QUESTION' || presentation.type === 'MULTIPLE_SELECT')
        ? presentation
        : undefined
);

export const trueFalsePresentationOf = (
    presentation: ReviewPresentation | undefined,
): ReviewTrueFalsePresentation | undefined => (
    isTrustedPresentation(presentation) && presentation.type === 'TRUE_FALSE'
        ? presentation
        : undefined
);

export const matchingPresentationOf = (
    presentation: ReviewPresentation | undefined,
): ReviewMatchingPresentation | undefined => (
    isTrustedPresentation(presentation) && presentation.type === 'MATCHING'
        ? presentation
        : undefined
);

export const blankPresentationOf = (
    presentation: ReviewPresentation | undefined,
): ReviewBlankPresentation | undefined => (
    isTrustedPresentation(presentation) && (presentation.type === 'DRAG_DROP' || presentation.type === 'DROPDOWN')
        ? presentation
        : undefined
);

export const orderingPresentationOf = (
    presentation: ReviewPresentation | undefined,
): ReviewOrderingPresentation | undefined => (
    isTrustedPresentation(presentation) && presentation.type === 'ORDERING'
        ? presentation
        : undefined
);

export const categorizationPresentationOf = (
    presentation: ReviewPresentation | undefined,
): ReviewCategorizationPresentation | undefined => (
    isTrustedPresentation(presentation) && presentation.type === 'CATEGORIZATION'
        ? presentation
        : undefined
);

export const underlinePresentationOf = (
    presentation: ReviewPresentation | undefined,
): ReviewUnderlinePresentation | undefined => (
    isTrustedPresentation(presentation) && presentation.type === 'UNDERLINE'
        ? presentation
        : undefined
);

export const textAnswerPresentationOf = (
    presentation: ReviewPresentation | undefined,
): ReviewTextAnswerPresentation | undefined => (
    isTrustedPresentation(presentation) && (presentation.type === 'SHORT_ANSWER' || presentation.type === 'RIDDLE')
        ? presentation
        : undefined
);

export const wordScramblePresentationOf = (
    presentation: ReviewPresentation | undefined,
): ReviewWordScramblePresentation | undefined => (
    isTrustedPresentation(presentation) && presentation.type === 'WORD_SCRAMBLE'
        ? presentation
        : undefined
);

export const errorCorrectionPresentationOf = (
    presentation: ReviewPresentation | undefined,
): ReviewErrorCorrectionPresentation | undefined => (
    isTrustedPresentation(presentation) && presentation.type === 'ERROR_CORRECTION'
        ? presentation
        : undefined
);

export const answerText = (value: boolean | undefined): string => (
    value === undefined ? 'Chưa trả lời' : value ? 'Đúng' : 'Sai'
);

export const choiceStateLabel = (item: {
    state: 'correct' | 'incorrect' | 'skipped' | 'unknown';
    selected: boolean;
    correct: boolean;
}): string => {
    if (item.state === 'correct') return 'Em chọn · Đúng';
    if (item.state === 'incorrect') return 'Em chọn · Sai';
    if (item.state === 'skipped' && item.correct) return 'Đáp án đúng · Em chưa chọn';
    return 'Chưa có dữ liệu đối chiếu';
};

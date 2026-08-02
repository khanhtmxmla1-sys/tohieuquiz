import {
    gradeQuestion,
    isRawAnswerSkipped,
    normalizeText,
} from '../../domain/quiz-scoring';

export type AnswerStatus = 'correct' | 'wrong' | 'skipped';

export interface ScoringResult {
    status: AnswerStatus;
    isCorrect: boolean;
    correctAnswer: unknown;
    studentAnswer: unknown;
    feedback?: string;
}

/**
 * Kept for compatibility with existing imports. Scoring no longer depends on
 * this helper; the canonical engine resolves option identities.
 */
export const normalizeMCQ = (value: unknown): string => {
    const raw = String(value ?? '').trim();
    const match = raw.match(/^([A-Za-z0-9])[.\)\-\s]?/);
    return match ? match[1].toUpperCase() : raw.toUpperCase();
};

/** Kept for compatibility with existing imports and display formatting. */
export const normalizeShortAnswer = (value: unknown): string => normalizeText(value);

const correctAnswerForDisplay = (question: Record<string, unknown>): unknown => (
    question.correctAnswer
    ?? question.correctAnswers
    ?? question.correctOrder
    ?? question.correctWordIndexes
    ?? question.correctWord
    ?? question.blanks
    ?? question.pairs
);

const legacyOrderingValue = (value: unknown): unknown => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const record = value as Record<string, unknown>;
        return record.id ?? record.value ?? value;
    }
    return value;
};

const legacyBooleanValue = (value: unknown): boolean | null => {
    if (typeof value === 'boolean') return value;
    const normalized = normalizeText(value);
    if (['true', 'đúng', 'dung', 'yes', '1'].includes(normalized)) return true;
    if (['false', 'sai', 'no', '0'].includes(normalized)) return false;
    return null;
};

/**
 * Adapts incomplete snapshots created by old result payloads. This function
 * only repairs data shape; the correctness decision remains in gradeQuestion.
 */
const prepareLegacyReviewInput = (
    rawQuestion: unknown,
    rawAnswer: unknown,
): { question: Record<string, unknown>; answer: unknown } => {
    const source = rawQuestion && typeof rawQuestion === 'object' && !Array.isArray(rawQuestion)
        ? rawQuestion as Record<string, unknown>
        : {};
    const question: Record<string, unknown> = {
        ...source,
        id: String(source.id ?? '__legacy-review-question__'),
    };
    let answer = rawAnswer;

    if (String(question.type || '').toUpperCase() === 'IMAGE_MCQ') {
        question.type = 'IMAGE_QUESTION';
    }

    if (
        String(question.type || '').toUpperCase() === 'MCQ'
        && (!Array.isArray(question.options) || question.options.length < 2)
    ) {
        question.options = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index));
    }

    if (
        String(question.type || '').toUpperCase() === 'ORDERING'
        && (!Array.isArray(question.items) || question.items.length === 0)
        && Array.isArray(question.correctOrder)
    ) {
        const legacyOrder = question.correctOrder.map(legacyOrderingValue);
        question.items = legacyOrder.map(String);
        question.correctOrder = legacyOrder.map((_, index) => index);
        if (Array.isArray(answer)) {
            answer = answer.map((item) => {
                const candidate = legacyOrderingValue(item);
                return legacyOrder.findIndex((correct) => String(correct) === String(candidate));
            });
        }
    }

    if (
        String(question.type || '').toUpperCase() === 'TRUE_FALSE'
        && (!Array.isArray(question.items) || question.items.length === 0)
    ) {
        const correctValue = legacyBooleanValue(question.correctAnswer ?? question.correct_answer);
        const studentValue = legacyBooleanValue(answer);
        if (correctValue !== null && studentValue !== null) {
            question.items = [{
                id: 'item-0',
                statement: question.questionText ?? question.question ?? question.mainQuestion ?? '',
                isCorrect: correctValue,
            }];
            answer = { 'item-0': studentValue };
        }
    }

    return { question, answer };
};

export const checkAnswer = (questionInput: unknown, answerInput: unknown): ScoringResult => {
    const { question, answer } = prepareLegacyReviewInput(questionInput, answerInput);
    const correctAnswer = correctAnswerForDisplay(question);

    if (isRawAnswerSkipped(answer)) {
        return {
            status: 'skipped',
            isCorrect: false,
            studentAnswer: answerInput,
            correctAnswer,
        };
    }

    const grading = gradeQuestion(question, answer);
    return {
        status: grading.isCorrect ? 'correct' : 'wrong',
        isCorrect: grading.isCorrect,
        studentAnswer: answerInput,
        correctAnswer,
        feedback: grading.status === 'invalid' ? grading.issueCode : undefined,
    };
};

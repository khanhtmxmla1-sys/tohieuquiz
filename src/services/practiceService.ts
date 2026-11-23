import { callApi } from './apiAdapter';
import { adaptStudentQuizQuestion } from './quizAccessService';
import { Quiz } from '../types';
import {
    PRACTICE_DELIVERY_VERSION,
    PRACTICE_MAX_SESSION_TOKEN_BYTES,
    PRACTICE_MAX_SELECTED_QUESTIONS,
    isPlainRecord,
    isPracticeSessionEnvelope,
    utf8ByteLength,
} from '../../shared/practice-grading.contract';
import type {
    PracticeGradeRequest as SharedPracticeGradeRequest,
    PracticeGradeResponse,
    PracticeSessionEnvelope,
} from '../../shared/practice-grading.contract';
import type { QuestionAnswerReview, QuestionGradingResult } from '../domain/quiz-scoring';

export type SecurePracticeQuiz = Quiz & { practiceSession: PracticeSessionEnvelope };
export type PracticeGradeRequest = Omit<SharedPracticeGradeRequest, 'questionOrder'> & {
    questionOrder: string[];
};
export type { PracticeGradeResponse, PracticeSessionEnvelope };
type PracticeValidationDetail = QuestionGradingResult;

const hasOwn = (value: object, key: string): boolean => (
    Object.prototype.hasOwnProperty.call(value, key)
);

const isNonEmptyString = (value: unknown): value is string => (
    typeof value === 'string' && value.trim().length > 0
);

const isValidSessionEnvelope = (value: unknown): value is PracticeSessionEnvelope => {
    if (!isPlainRecord(value) || !isPracticeSessionEnvelope(value)) return false;
    if (!isNonEmptyString(value.token)) return false;
    const tokenBytes = utf8ByteLength(value.token);
    if (tokenBytes > PRACTICE_MAX_SESSION_TOKEN_BYTES) return false;
    if (!isNonEmptyString(value.expiresAt)) return false;
    const expiry = Date.parse(value.expiresAt);
    return Number.isFinite(expiry) && expiry > Date.now();
};

const isUniqueQuestionOrder = (value: unknown): value is string[] => (
    Array.isArray(value)
    && value.length > 0
    && value.length <= PRACTICE_MAX_SELECTED_QUESTIONS
    && value.every((id) => isNonEmptyString(id))
    && new Set(value).size === value.length
);

const exactIdCoverage = (
    value: unknown,
    questionOrder: string[],
    allowQuestionOrderMetadata = false,
): value is Record<string, unknown> => {
    if (!isPlainRecord(value)) return false;
    const expected = new Set(questionOrder);
    const keys = Object.keys(value);
    const metadataKeys = allowQuestionOrderMetadata && keys.includes('_questionOrder') ? 1 : 0;
    if (keys.length !== expected.size + metadataKeys) return false;
    if (keys.some((key) => key !== '_questionOrder' && !expected.has(key))) return false;
    if (metadataKeys > 0) {
        const order = value._questionOrder;
        if (!Array.isArray(order) || order.length !== questionOrder.length
            || order.some((id, index) => id !== questionOrder[index])) return false;
    }
    return questionOrder.every((id) => hasOwn(value, id));
};

const isAnswerSubset = (value: unknown, questionOrder: string[]): value is Record<string, unknown> => {
    if (!isPlainRecord(value)) return false;
    const expected = new Set(questionOrder);
    return Object.keys(value).every((key) => expected.has(key));
};

const VALID_GRADING_STATUSES = ['correct', 'wrong', 'skipped', 'invalid', 'voided'] as const;
const VALID_REVIEW_SOURCES = ['submission', 'verified-current', 'legacy-unverified'] as const;
const VALID_REVIEW_VALUE_KINDS = ['empty', 'text', 'list', 'mapping', 'unsupported'] as const;
const VALID_REVIEW_ITEM_STATES = ['correct', 'incorrect', 'skipped', 'unknown'] as const;

const isFiniteInteger = (value: unknown, minimum = 0): value is number => (
    typeof value === 'number'
    && Number.isFinite(value)
    && Number.isInteger(value)
    && value >= minimum
);

const isOptionalString = (value: Record<string, unknown>, key: string): boolean => (
    !hasOwn(value, key) || typeof value[key] === 'string'
);

const isOptionalBoolean = (value: Record<string, unknown>, key: string): boolean => (
    !hasOwn(value, key) || typeof value[key] === 'boolean'
);

const isOptionalInteger = (value: Record<string, unknown>, key: string): boolean => (
    !hasOwn(value, key) || isFiniteInteger(value[key])
);

const isReviewItemBase = (value: unknown): value is Record<string, unknown> => (
    isPlainRecord(value)
    && isNonEmptyString(value.id)
    && isFiniteInteger(value.index)
    && VALID_REVIEW_ITEM_STATES.includes(value.state as never)
);

const hasUniqueReviewItems = (items: unknown[]): boolean => {
    const ids = new Set<string>();
    const indexes = new Set<number>();
    for (const item of items) {
        if (!isReviewItemBase(item)) return false;
        const id = item.id;
        const index = item.index;
        if (typeof id !== 'string' || typeof index !== 'number'
            || ids.has(id) || indexes.has(index)) return false;
        ids.add(id);
        indexes.add(index);
    }
    return true;
};

const isReviewValue = (value: unknown): boolean => {
    if (!isPlainRecord(value) || !VALID_REVIEW_VALUE_KINDS.includes(value.kind as never)
        || !Array.isArray(value.lines) || value.lines.length === 0) return false;
    return value.lines.every((line) => isPlainRecord(line)
        && typeof line.value === 'string'
        && (line.label === undefined || typeof line.label === 'string'));
};

const isReviewPresentation = (value: unknown): boolean => {
    if (!isPlainRecord(value) || value.schemaVersion !== 1
        || !VALID_REVIEW_SOURCES.includes(value.source as never)
        || typeof value.type !== 'string' || !Array.isArray(value.items)) return false;
    const items = value.items;
    if (value.type === 'UNSUPPORTED') {
        return items.length === 0
            && ['insufficient-authoritative-data', 'unsupported-question-type', 'voided-question']
                .includes(String(value.reason));
    }
    if (items.length === 0 || !hasUniqueReviewItems(items)) return false;

    switch (value.type) {
        case 'MCQ':
        case 'IMAGE_QUESTION':
        case 'MULTIPLE_SELECT':
        case 'UNDERLINE':
            return items.every((item) => typeof item.text === 'string'
                && typeof item.selected === 'boolean' && typeof item.correct === 'boolean');
        case 'TRUE_FALSE':
            return items.every((item) => typeof item.statement === 'string'
                && typeof item.correctValue === 'boolean'
                && isOptionalBoolean(item, 'studentValue'));
        case 'MATCHING':
            return items.every((item) => typeof item.leftId === 'string'
                && typeof item.leftText === 'string'
                && typeof item.correctRightId === 'string'
                && typeof item.correctRightText === 'string'
                && isOptionalString(item, 'studentRightId')
                && isOptionalString(item, 'studentRightText'));
        case 'DRAG_DROP':
        case 'DROPDOWN':
            return items.every((item) => typeof item.correctValue === 'string'
                && isOptionalString(item, 'blankToken')
                && isOptionalString(item, 'studentValue'));
        case 'ORDERING':
            return items.every((item) => typeof item.text === 'string'
                && isFiniteInteger(item.correctRank)
                && isOptionalInteger(item, 'studentRank'));
        case 'CATEGORIZATION': {
            if (!Array.isArray(value.categories) || value.categories.length === 0) return false;
            const categoryIds = new Set<string>();
            if (!value.categories.every((category) => {
                if (!isPlainRecord(category) || !isNonEmptyString(category.id)
                    || !isFiniteInteger(category.index) || typeof category.text !== 'string'
                    || categoryIds.has(category.id)) return false;
                categoryIds.add(category.id);
                return true;
            })) return false;
            return items.every((item) => typeof item.text === 'string'
                && typeof item.correctCategoryId === 'string'
                && typeof item.correctCategoryText === 'string'
                && isOptionalString(item, 'studentCategoryId')
                && isOptionalString(item, 'studentCategoryText'));
        }
        case 'SHORT_ANSWER':
        case 'RIDDLE':
            return items.every((item) => Array.isArray(item.correctValues)
                && item.correctValues.length > 0
                && item.correctValues.every((answer) => typeof answer === 'string')
                && isOptionalString(item, 'studentValue'));
        case 'WORD_SCRAMBLE':
            return items.every((item) => typeof item.correctValue === 'string'
                && Array.isArray(item.letters)
                && item.letters.length > 0
                && item.letters.every((letter) => typeof letter === 'string')
                && isOptionalString(item, 'studentValue')
                && (!hasOwn(item, 'studentLetterIndexes')
                    || (Array.isArray(item.studentLetterIndexes)
                        && item.studentLetterIndexes.every((index) => isFiniteInteger(index)))));
        case 'ERROR_CORRECTION':
            return items.every((item) => typeof item.correctWrongWord === 'string'
                && typeof item.correctWord === 'string'
                && isOptionalString(item, 'studentWrongWord')
                && isOptionalString(item, 'studentCorrectWord'));
        default:
            return false;
    }
};

const isSafeReviewDetail = (value: unknown): value is Record<string, unknown> & {
    questionId: string;
    type: string;
    status: (typeof VALID_GRADING_STATUSES)[number];
    isCorrect: boolean;
} => {
    if (!isPlainRecord(value) || !isNonEmptyString(value.questionId)
        || !isNonEmptyString(value.type) || typeof value.isCorrect !== 'boolean'
        || !VALID_GRADING_STATUSES.includes(value.status as never)
        || !isReviewValue(value.studentAnswer) || !isReviewValue(value.correctAnswer)
        || !isReviewPresentation(value.presentation)) return false;
    const presentation = value.presentation as Record<string, unknown>;
    if (presentation.type !== 'UNSUPPORTED' && presentation.type !== value.type) return false;
    return true;
};

const SECURE_PRACTICE_TYPES = new Set([
    'MCQ', 'IMAGE_QUESTION', 'MULTIPLE_SELECT', 'SHORT_ANSWER', 'TRUE_FALSE',
    'MATCHING', 'DRAG_DROP', 'DROPDOWN', 'ORDERING', 'CATEGORIZATION',
    'UNDERLINE', 'WORD_SCRAMBLE', 'RIDDLE', 'ERROR_CORRECTION',
]);

const SECURE_ANSWER_FIELDS = new Set([
    'correct', 'correctAnswer', 'correctAnswers', 'correctOrder', 'correctWord',
    'correctWordIndexes', 'correct_answer', 'correct_word_indexes', 'isCorrect',
    'categoryId', 'correctValue', 'correctValues', 'correctCategoryId',
    'correctRightId', 'correctRightText', 'correctWrongWord',
    'answer', 'answers',
]);

const containsSecureAnswerField = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(containsSecureAnswerField);
    if (!isPlainRecord(value)) return false;
    return Object.entries(value).some(([key, nested]) => (
        SECURE_ANSWER_FIELDS.has(key) || containsSecureAnswerField(nested)
    ));
};

const isSafeSecurePracticeQuestion = (value: unknown): value is Record<string, unknown> => {
    if (!isPlainRecord(value)) return false;
    const id = value.id;
    const type = value.type;
    return isNonEmptyString(id)
        && typeof type === 'string'
        && SECURE_PRACTICE_TYPES.has(type)
        && !containsSecureAnswerField(value);
};

const buildSecurePracticeQuiz = (
    response: Record<string, unknown>,
    practiceSession: PracticeSessionEnvelope,
): SecurePracticeQuiz | null => {
    if (response.isPractice !== true || !isNonEmptyString(response.id)
        || !isNonEmptyString(response.title) || !isNonEmptyString(response.classLevel)
        || response.timeLimit !== 0 || !isNonEmptyString(response.createdAt)
        || !Array.isArray(response.questions) || response.questions.length === 0
        || response.questions.length > PRACTICE_MAX_SELECTED_QUESTIONS) return null;

    const safeQuestions = response.questions.map((question) => {
        if (!isSafeSecurePracticeQuestion(question)) throw new Error('Invalid secure practice question.');
        const adapted = adaptStudentQuizQuestion(question);
        if (!isNonEmptyString(adapted.id) || !isNonEmptyString(adapted.type)
            || !SECURE_PRACTICE_TYPES.has(adapted.type)
            || Object.keys(adapted).some((key) => key.startsWith('correct'))) {
            throw new Error('Invalid secure practice question.');
        }
        return adapted;
    });
    const ids = safeQuestions.map((question) => String(question.id));
    if (new Set(ids).size !== ids.length) return null;

    const safeQuiz: SecurePracticeQuiz = {
        id: response.id,
        title: response.title,
        classLevel: response.classLevel,
        category: typeof response.category === 'string' ? response.category : undefined,
        timeLimit: 0,
        createdAt: response.createdAt,
        isPractice: true,
        questions: safeQuestions,
        practiceSession,
    };
    return safeQuiz;
};

const validateAuthoritativeGrade = (
    value: unknown,
    practiceId: string,
    questionOrder: string[],
): PracticeGradeResponse => {
    if (!isPlainRecord(value) || value.status !== 'success') {
        throw new Error('Invalid authoritative practice response.');
    }
    if (value.practiceId !== practiceId || !isNonEmptyString(value.gradingVersion)) {
        throw new Error('Invalid authoritative practice identity or grading version.');
    }

    const counterValues = ['score', 'correctCount', 'questionCount', 'totalQuestions', 'voidedCount']
        .map((key) => value[key]);
    if (counterValues.some((counter) => typeof counter !== 'number'
        || !Number.isFinite(counter) || counter < 0)) {
        throw new Error('Invalid authoritative practice counters.');
    }
    const [score, correctCount, questionCount, totalQuestions, voidedCount] = counterValues as number[];
    if (!Number.isInteger(correctCount) || !Number.isInteger(questionCount)
        || !Number.isInteger(totalQuestions) || !Number.isInteger(voidedCount)
        || questionCount !== questionOrder.length || voidedCount > questionCount
        || totalQuestions !== questionCount - voidedCount || correctCount > totalQuestions
        || score > 10) {
        throw new Error('Invalid authoritative practice counters.');
    }

    if (!exactIdCoverage(value.answers, questionOrder, true)
        || !Array.isArray(value.validationDetails)
        || !Array.isArray(value.reviewDetails)
        || value.validationDetails.length !== questionOrder.length
        || value.reviewDetails.length !== questionOrder.length) {
        throw new Error('Invalid authoritative practice coverage.');
    }

    const validationDetails: PracticeValidationDetail[] = [];
    const validationIds = new Set<string>();
    let correctDetails = 0;
    let voidedDetails = 0;
    for (const detail of value.validationDetails) {
        if (!isPlainRecord(detail) || !isNonEmptyString(detail.questionId)
            || validationIds.has(detail.questionId) || !questionOrder.includes(detail.questionId)
            || typeof detail.isCorrect !== 'boolean'
            || typeof detail.type !== 'string' || !detail.type.trim()
            || !VALID_GRADING_STATUSES.includes(detail.status as never)) {
            throw new Error('Invalid authoritative validation details.');
        }
        if ((detail.status === 'correct') !== detail.isCorrect) {
            throw new Error('Invalid authoritative validation status.');
        }
        validationIds.add(detail.questionId);
        if (detail.isCorrect) correctDetails += 1;
        if (detail.status === 'voided') voidedDetails += 1;
        validationDetails.push(detail as unknown as PracticeValidationDetail);
    }
    if (validationIds.size !== questionOrder.length || correctDetails !== correctCount
        || voidedDetails !== voidedCount) {
        throw new Error('Invalid authoritative validation counters.');
    }

    const reviewIds = new Set<string>();
    const reviewDetails: Array<Record<string, unknown> & { questionId: string }> = [];
    for (const detail of value.reviewDetails) {
        if (!isSafeReviewDetail(detail)
            || reviewIds.has(detail.questionId) || !questionOrder.includes(detail.questionId)) {
            throw new Error('Invalid authoritative review details.');
        }
        const validation = validationDetails.find((candidate) => candidate.questionId === detail.questionId);
        if (!validation || detail.type !== validation.type || detail.status !== validation.status
            || detail.isCorrect !== validation.isCorrect) {
            throw new Error('Invalid authoritative review status.');
        }
        reviewIds.add(detail.questionId);
        reviewDetails.push(detail as Record<string, unknown> & { questionId: string });
    }
    if (reviewIds.size !== questionOrder.length) {
        throw new Error('Invalid authoritative review coverage.');
    }

    for (const detail of validationDetails) {
        const answer = (value.answers as Record<string, unknown>)[detail.questionId];
        if (!isPlainRecord(answer)) throw new Error('Invalid authoritative answer envelope.');
        if (answer.status !== undefined && answer.status !== detail.status) {
            throw new Error('Invalid authoritative answer status.');
        }
        if (answer.isCorrect !== undefined
            && (typeof answer.isCorrect !== 'boolean' || answer.isCorrect !== detail.isCorrect)) {
            throw new Error('Invalid authoritative answer correctness.');
        }
    }

    const denominator = totalQuestions;
    const expectedScore = denominator === 0
        ? 0
        : Number(((correctCount / denominator) * 10).toFixed(1));
    if (score !== expectedScore) throw new Error('Invalid authoritative practice score.');

    return {
        status: 'success',
        practiceId,
        score,
        correctCount,
        questionCount,
        totalQuestions,
        voidedCount,
        gradingVersion: value.gradingVersion,
        answers: value.answers as Record<string, unknown>,
        validationDetails: validationDetails as unknown as readonly QuestionGradingResult[],
        reviewDetails: reviewDetails as unknown as readonly QuestionAnswerReview[],
    };
};

export const practiceService = {
    /**
     * Fetches the list of all unique topic tags available in the database with their counts
     */
    getTopics: async (): Promise<{ name: string; count: number }[]> => {
        const response = await callApi<{ topics: { name: string; count: number }[] }>(
            'get_practice_topics',
        );
        return response.topics || [];
    },

    /**
     * Fetches a dynamically generated practice quiz for a given topic
     */
    getPracticeQuiz: async (topic: string, limit: number = 10): Promise<Quiz | null> => {
        try {
            const response = await callApi<Quiz & { practiceSession?: unknown }>('get_practice_quiz', {
                topic, limit, delivery: PRACTICE_DELIVERY_VERSION,
            });
            if (!isPlainRecord(response)) return null;

            // Property presence is the security boundary. A malformed secure
            // marker must fail closed rather than be treated as a legacy payload.
            if (hasOwn(response, 'practiceSession')) {
                if (!isValidSessionEnvelope(response.practiceSession)
                    || !Array.isArray(response.questions) || response.questions.length === 0) {
                    return null;
                }
                return buildSecurePracticeQuiz(response, response.practiceSession);
            }

            // Transitional compatibility: old Workers have no secure metadata.
            return response as Quiz;
        } catch (error) {
            console.error('Error fetching practice quiz:', error);
            return null;
        }
    },

    gradePracticeQuiz: async (
        request: PracticeGradeRequest,
        practiceId: string,
    ): Promise<PracticeGradeResponse> => {
        if (!isNonEmptyString(practiceId) || !isNonEmptyString(request.sessionToken)
            || !isUniqueQuestionOrder(request.questionOrder) || !isPlainRecord(request.answers)) {
            throw new Error('Invalid practice submission.');
        }
        if (!isAnswerSubset(request.answers, request.questionOrder)) {
            throw new Error('Invalid practice answer coverage.');
        }
        const response = await callApi<unknown>('grade_practice_quiz', {
            sessionToken: request.sessionToken,
            answers: request.answers,
            questionOrder: request.questionOrder,
        });
        return validateAuthoritativeGrade(response, practiceId, request.questionOrder);
    },
};

export { validateAuthoritativeGrade };


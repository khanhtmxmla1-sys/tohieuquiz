import type { Question, StudentResult } from '../../../../../types';
import type { QuestionAnswerReview } from '../../../../../domain/quiz-scoring';
import { checkAnswer } from '../../../../../utils/question/scoring.util';
import {
    isAnswerSkipped,
    normalizeResultAnswer,
    type NormalizedAnswer,
} from './answerModel';

export type QuestionFilterMode = 'all' | 'correct' | 'wrong';

export type DisplayQuestion = Question & NormalizedAnswer & {
    id: string;
    index: number;
    isCorrect?: boolean;
    reviewDetail?: QuestionAnswerReview;
    [key: string]: any;
};

const mergeTrueFalseItems = (currentItems: unknown, snapshotItems: unknown): unknown => {
    if (!Array.isArray(snapshotItems) || !Array.isArray(currentItems)) return snapshotItems;

    const currentById = new Map(currentItems.map((item: any, index) => [
        item && typeof item === 'object' && item.id != null ? String(item.id) : `__index-${index}`,
        item,
    ]));
    const canFallbackByIndex = currentItems.length === snapshotItems.length;

    return snapshotItems.map((snapshotItem: any, index) => {
        if (!snapshotItem || typeof snapshotItem !== 'object' || 'isCorrect' in snapshotItem) {
            return snapshotItem;
        }
        const currentItem = snapshotItem.id != null
            ? currentById.get(String(snapshotItem.id))
            : undefined;
        const fallbackItem = canFallbackByIndex ? currentItems[index] : undefined;
        const source = currentItem || fallbackItem;
        if (!source || typeof source !== 'object' || !('isCorrect' in source)) return snapshotItem;
        return { ...snapshotItem, isCorrect: source.isCorrect };
    });
};

const mergeHistoricalQuestionForReview = (fromQuiz: any, snapshot: any): any => {
    const merged = { ...(fromQuiz || {}), ...(snapshot || {}) };
    const type = snapshot?.type || fromQuiz?.type;

    if (type === 'TRUE_FALSE' && snapshot?.items !== undefined) {
        merged.items = mergeTrueFalseItems(fromQuiz?.items, snapshot.items);
    }
    if (type === 'UNDERLINE' && merged.correctWordIndexes === undefined && fromQuiz?.correctWordIndexes !== undefined) {
        merged.correctWordIndexes = fromQuiz.correctWordIndexes;
    }

    return merged;
};

const correctnessFromReviewStatus = (reviewDetail?: QuestionAnswerReview): boolean | undefined => {
    if (!reviewDetail) return undefined;
    if (reviewDetail.status === 'correct') return true;
    if (reviewDetail.status === 'wrong' || reviewDetail.status === 'invalid') return false;
    return undefined;
};

export const buildDisplayQuestions = (
    result: StudentResult,
    questions: Question[]
): DisplayQuestion[] => {
    const questionsMap = Object.fromEntries(questions.map((question) => [question.id, question]));
    const reviewMap = new Map((result.reviewDetails || []).map((detail) => [String(detail.questionId), detail]));
    const rawAnswerEntries = Object.entries(result.answers || {});
    const answerEntries = rawAnswerEntries.filter(([key]) => !key.startsWith('_'));
    if (rawAnswerEntries.length === 0) {
        return questions.map((question, index) => ({
            ...question, index, selectedAnswer: undefined,
            isCorrect: undefined, timeSpent: undefined,
        })) as DisplayQuestion[];
    }

    return answerEntries.map(([questionId, answerData], index) => {
        const normalized = normalizeResultAnswer(result, questionId, answerData);
        const fromQuiz = questionsMap[questionId];
        const snapshot = normalized.snapshot;
        const reviewDetail = reviewMap.get(String(questionId));
        const mergedQuestion = mergeHistoricalQuestionForReview(fromQuiz, snapshot);
        const question = {
            ...mergedQuestion, ...normalized,
            id: questionId, index, reviewDetail,
            type: snapshot?.type || fromQuiz?.type || (normalized as any).questionType,
            question: snapshot?.question || snapshot?.mainQuestion
                || (fromQuiz as any)?.question || (fromQuiz as any)?.mainQuestion || '',
            questionRichText: snapshot
                ? snapshot.questionRichText
                : fromQuiz?.questionRichText,
        } as DisplayQuestion;

        let isCorrect = correctnessFromReviewStatus(reviewDetail);
        if (isAnswerSkipped(normalized.selectedAnswer) || reviewDetail?.status === 'skipped' || reviewDetail?.status === 'voided') {
            isCorrect = undefined;
        } else if (!reviewDetail) {
            isCorrect = normalized.isCorrect;
            if (typeof normalized.isCorrect !== 'boolean' && question.type) {
                isCorrect = checkAnswer(question as any, normalized.selectedAnswer).status === 'correct';
            }
        }
        return { ...question, isCorrect };
    });
};

export const filterDisplayQuestions = (
    questions: DisplayQuestion[],
    mode: QuestionFilterMode
): DisplayQuestion[] => {
    if (mode === 'all') return questions;
    return questions.filter((question) => question.isCorrect === (mode === 'correct'));
};

export const getQuestionResultCounts = (questions: DisplayQuestion[]) => ({
    correctCount: questions.filter((question) => question.isCorrect === true).length,
    wrongCount: questions.filter((question) => question.isCorrect === false).length,
});

export const getQuestionTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
        MCQ: 'TN', IMAGE_QUESTION: 'HQ', IMAGE_MCQ: 'HQ', TRUE_FALSE: 'ĐS',
        SHORT_ANSWER: 'ĐB', MATCHING: 'NC', ORDERING: 'SX', DRAG_DROP: 'KT',
        DROPDOWN: 'DD', UNDERLINE: 'GC', CATEGORIZATION: 'PL',
        WORD_SCRAMBLE: 'GC', MULTIPLE_SELECT: 'CN', ERROR_CORRECTION: 'SC', RIDDLE: 'CD',
    };
    return labels[type] || type?.slice(0, 3) || '?';
};

import type { Question, StudentResult } from '../../../../../types';
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
    [key: string]: any;
};

export const buildDisplayQuestions = (
    result: StudentResult,
    questions: Question[]
): DisplayQuestion[] => {
    const questionsMap = Object.fromEntries(questions.map((question) => [question.id, question]));
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
        const question = {
            ...(fromQuiz || {}), ...(snapshot || {}), ...normalized,
            id: questionId, index,
            type: snapshot?.type || fromQuiz?.type || (normalized as any).questionType,
            question: snapshot?.question || snapshot?.mainQuestion
                || (fromQuiz as any)?.question || (fromQuiz as any)?.mainQuestion || '',
        } as DisplayQuestion;

        let isCorrect = normalized.isCorrect;
        if (isAnswerSkipped(normalized.selectedAnswer)) {
            isCorrect = undefined;
        } else if (typeof normalized.isCorrect !== 'boolean' && question.type) {
            isCorrect = checkAnswer(question as any, normalized.selectedAnswer).status === 'correct';
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

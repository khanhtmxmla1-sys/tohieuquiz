import { gradeQuiz } from '../../../domain/quiz-scoring';
import type { Quiz } from '../../../types';

/**
 * Compatibility facade for callers that still consume the historical
 * `calculateStudentScore` response shape. All grading is delegated to the
 * canonical engine; this module contains no question-type scoring switch.
 */
export interface ScoringResult {
    score: number;
    correctCount: number;
    totalItems: number;
    details: Array<{
        questionId: string;
        isCorrect: boolean;
        correctAnswer?: unknown;
    }>;
}

const correctAnswerForDisplay = (question: Record<string, unknown>): unknown => (
    question.correctAnswer
    ?? question.correctAnswers
    ?? question.correctOrder
    ?? question.correctWordIndexes
    ?? question.correctWord
    ?? question.blanks
    ?? question.pairs
);

export const calculateStudentScore = (
    quiz: Quiz,
    answers: Record<string, unknown>,
): ScoringResult => {
    const grading = gradeQuiz(quiz, answers);
    const questionById = new Map(
        quiz.questions.map((question) => [String(question.id), question as unknown as Record<string, unknown>]),
    );

    return {
        score: grading.score,
        correctCount: grading.correctCount,
        totalItems: grading.totalQuestions,
        details: grading.details.map((detail) => ({
            questionId: detail.questionId,
            isCorrect: detail.isCorrect,
            correctAnswer: correctAnswerForDisplay(questionById.get(detail.questionId) || {}),
        })),
    };
};

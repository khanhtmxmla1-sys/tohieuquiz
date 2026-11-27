import type { Question, Quiz, StudentResult } from '../../../types';
import { gradeQuiz } from '../../../domain/quiz-scoring';
import type {
    PracticeGradeResponse,
    PracticeSessionEnvelope,
} from '../../../services/practiceService';

export type SecurePracticeQuiz = Quiz & { practiceSession?: unknown };

export const hasOwnProperty = (value: object, key: string): boolean => (
    Object.prototype.hasOwnProperty.call(value, key)
);

export const isSecurePracticeSession = (value: unknown): value is PracticeSessionEnvelope => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const session = value as Record<string, unknown>;
    if (session.version !== 'server-v1' || typeof session.token !== 'string'
        || !session.token.trim() || typeof session.expiresAt !== 'string') return false;
    const expiry = Date.parse(session.expiresAt);
    return Number.isFinite(expiry);
};

export const isExpiredPracticeSession = (value: PracticeSessionEnvelope): boolean => (
    Date.parse(value.expiresAt) <= Date.now()
);

export const mapPracticeGradeToStudentResult = (
    baseResult: StudentResult,
    grading: PracticeGradeResponse,
    questionOrder: string[],
): StudentResult => ({
    ...baseResult,
    id: grading.practiceId,
    score: grading.score,
    correctCount: grading.correctCount,
    questionCount: grading.questionCount,
    totalQuestions: grading.totalQuestions,
    voidedCount: grading.voidedCount,
    gradingVersion: grading.gradingVersion,
    answers: {
        ...grading.answers,
        _questionOrder: questionOrder,
    },
    validationDetails: [...grading.validationDetails] as StudentResult['validationDetails'],
    reviewDetails: grading.reviewDetails as StudentResult['reviewDetails'],
});

export const buildLegacyPracticeResult = (
    baseResult: StudentResult,
    quiz: Quiz,
    shuffledQuestions: Question[],
    answers: Record<string, any>,
): StudentResult => {
    const grading = gradeQuiz({ ...quiz, questions: shuffledQuestions }, answers);
    const questionById = new Map(shuffledQuestions.map((question) => [String(question.id), question]));
    const validationDetails = grading.details.map((detail) => ({
        questionId: detail.questionId,
        isCorrect: detail.isCorrect,
        status: detail.status,
        issueCode: detail.issueCode,
    }));
    const practiceAnswers = Object.fromEntries(grading.details.map((detail) => {
        const question = questionById.get(detail.questionId);
        return [detail.questionId, {
            selectedAnswer: answers[detail.questionId] ?? null,
            isCorrect: detail.isCorrect,
            status: detail.status,
            gradingVersion: grading.engineVersion,
            questionSnapshot: question ? { ...question } : undefined,
        }];
    }));
    return {
        ...baseResult,
        score: grading.score,
        correctCount: grading.correctCount,
        questionCount: grading.questionCount,
        totalQuestions: grading.totalQuestions,
        voidedCount: grading.voidedCount,
        answers: {
            ...practiceAnswers,
            _questionOrder: shuffledQuestions.map(q => q.id),
        },
        validationDetails,
        gradingVersion: grading.engineVersion,
    };
};

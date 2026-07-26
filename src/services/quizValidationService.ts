/**
 * Quiz Validation Service
 * Server-side answer validation via apiAdapter (uses the canonical Worker API)
 * Prevents students from seeing answers in DevTools
 */

import { callApi } from './apiAdapter';

interface ValidationResult {
    success: boolean;
    score: number;
    correctCount: number;
    total: number;
    details?: {
        questionId: string;
        isCorrect: boolean;
        correctAnswer?: any; // Only returned after submission
    }[];
    error?: string;
}

interface SubmitAnswersPayload {
    quizId: string;
    answers: Record<string, any>; // questionId -> student's answer
    studentName: string;
    studentClass: string;
}

/**
 * Submit answers to server for validation
 * Server will check answers against stored correct answers
 * @returns ValidationResult with score (answers only revealed after submit)
 */
export const validateAnswersOnServer = async (
    payload: SubmitAnswersPayload
): Promise<ValidationResult> => {
    try {
        const data = await callApi<any>('validate_answers', {
            quizId: payload.quizId,
            answers: payload.answers,
            studentName: payload.studentName,
            studentClass: payload.studentClass
        });

        if (data && data.status === 'error') {
            console.error('Validation API Error:', data.message);
            return {
                success: false,
                score: 0,
                correctCount: 0,
                total: 0,
                error: data.message || 'Validation failed'
            };
        }

        return {
            success: true,
            score: data?.score || 0,
            correctCount: data?.correctCount || 0,
            total: data?.total || 0,
            details: data?.details || []
        };

    } catch (error) {
        console.error('Network Error in validation:', error);
        return {
            success: false,
            score: 0,
            correctCount: 0,
            total: 0,
            error: 'Network error during validation'
        };
    }
};

/**
 * Get quiz data WITHOUT correct answers (safe for client)
 * Correct answers are stored only on server
 */
export const getQuizWithoutAnswers = async (quizId: string): Promise<any> => {
    try {
        const data = await callApi<any>('get_quiz_safe', { quizId });

        if (data && data.status === 'error') {
            console.error('Get Quiz Safe Error:', data.message);
            return null;
        }

        return data?.quiz || data || null;

    } catch (error) {
        console.error('Network Error:', error);
        return null;
    }
};

import type { Question, StudentResult } from '../../src/types';

export const studentDetailQuestions: Question[] = [
    {
        id: 'q1', type: 'MCQ', question: 'Hai cộng hai bằng bao nhiêu?',
        options: ['3', '4', '5', '6'], correctAnswer: 'B',
    },
    {
        id: 'q2', type: 'SHORT_ANSWER', question: 'Viết số liền sau số 9',
        correctAnswer: '10',
    },
];

export const studentDetailResult: StudentResult = {
    id: 'result-modal-1',
    studentName: 'Lan',
    studentClass: '2A',
    quizId: 'quiz-modal-1',
    quizTitle: 'Bài kiểm tra mẫu',
    score: 5,
    correctCount: 1,
    totalQuestions: 2,
    timeTaken: 8,
    submittedAt: '2026-07-19T00:00:00.000Z',
    answers: {
        q1: {
            selectedAnswer: 'B', isCorrect: true,
            questionSnapshot: {
                type: 'MCQ', question: 'Hai cộng hai bằng bao nhiêu?',
                options: ['3', '4', '5', '6'], correctAnswer: 'B',
            },
        },
        q2: {
            selectedAnswer: '', isCorrect: true,
            questionSnapshot: {
                type: 'SHORT_ANSWER', question: 'Viết số liền sau số 9',
                correctAnswer: '10',
            },
        },
    },
};

export const weaknessProfileFixture = {
    resultId: 'result-modal-1',
    coveragePercent: 100,
    unclassifiedQuestionCount: 0,
    basedOnResultIds: ['result-modal-1'],
    subjects: [],
};

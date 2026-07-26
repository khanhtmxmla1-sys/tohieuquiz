import { describe, expect, it } from 'vitest';
import type { StudentResult } from '../src/types';
import {
    analyzeQuestionDifficulty,
    selectResultsForQuestionAnalysis,
    type QuestionWithCorrect,
} from '../src/utils/statisticsUtils';

function result(overrides: Partial<StudentResult>): StudentResult {
    return {
        id: 'result-1',
        quizId: 'quiz-1',
        studentName: 'An',
        studentClass: '5A',
        score: 5,
        correctCount: 1,
        totalQuestions: 2,
        timeTaken: 10,
        submittedAt: '2026-07-15T08:00:00.000Z',
        answers: {},
        ...overrides,
    };
}

const questions: QuestionWithCorrect[] = [
    { id: 'q1', question: 'Hai cộng hai bằng mấy?', type: 'MCQ', correctAnswer: 'B' },
    { id: 'q2', question: 'Điền kết quả', type: 'SHORT_ANSWER', correctAnswer: '10' },
];

describe('teacher cohort question analysis', () => {
    it('counts only the latest attempt for each student by default', () => {
        const attempts = [
            result({ id: 'old', submittedAt: '2026-07-14T08:00:00.000Z' }),
            result({ id: 'new', submittedAt: '2026-07-15T08:00:00.000Z' }),
            result({ id: 'other', studentName: 'Bình', submittedAt: '2026-07-14T09:00:00.000Z' }),
        ];

        expect(selectResultsForQuestionAnalysis(attempts, 'latest').map(item => item.id).sort())
            .toEqual(['new', 'other']);
        expect(selectResultsForQuestionAnalysis(attempts, 'all')).toHaveLength(3);
    });

    it('ranks from evaluated answers and treats a skipped question as wrong', () => {
        const analysis = analyzeQuestionDifficulty([
            result({
                id: 'an',
                studentName: 'An',
                answers: {
                    q1: { selectedAnswer: 'A', isCorrect: false, timeSpent: 12 },
                },
            }),
            result({
                id: 'binh',
                studentName: 'Bình',
                answers: {
                    q1: { selectedAnswer: 'B', isCorrect: true, timeSpent: 8 },
                    q2: { selectedAnswer: '9', isCorrect: false },
                },
            }),
            result({
                id: 'unrelated',
                studentName: 'Chi',
                answers: { anotherQuestion: { selectedAnswer: 'X', isCorrect: false } },
            }),
        ], questions);

        expect(analysis[0]).toMatchObject({
            questionNumber: 1,
            correctCount: 1,
            wrongCount: 1,
            evaluatedCount: 2,
            wrongRate: 50,
            priority: 'high',
            avgTimeSpent: 10,
        });
        expect(analysis[0].commonWrongAnswers[0]).toEqual({ answer: 'A', count: 1 });
        expect(analysis[0].affectedStudents).toEqual(['An']);

        expect(analysis[1]).toMatchObject({
            questionNumber: 2,
            correctCount: 0,
            wrongCount: 2,
            skippedCount: 1,
            evaluatedCount: 2,
            wrongRate: 100,
            priority: 'high',
        });
        expect(analysis[1].commonWrongAnswers).toEqual([
            { answer: '9', count: 1 },
            { answer: 'Bỏ trống', count: 1 },
        ]);
    });

    it('keeps unsupported legacy answers out of the denominator', () => {
        const analysis = analyzeQuestionDifficulty([
            result({
                answers: {
                    q1: { selectedAnswer: { legacy: 'value' } },
                },
            }),
        ], [{ id: 'q1', question: 'Legacy', type: 'UNSUPPORTED' }]);

        expect(analysis[0]).toMatchObject({
            correctCount: 0,
            wrongCount: 0,
            unknownCount: 1,
            evaluatedCount: 0,
            wrongRate: 0,
        });
    });
});

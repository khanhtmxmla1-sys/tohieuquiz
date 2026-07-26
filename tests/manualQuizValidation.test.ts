import { describe, expect, it } from 'vitest';
import { QuestionType, type Quiz, type Question } from '../src/types';
import {
    validateManualQuiz,
    type ManualQuizIssue,
} from '../src/features/manual-quiz-workspace/validation/manualQuizValidation';

const question = (type: QuestionType, overrides: Record<string, unknown> = {}): Question => {
    const base = { id: `q-${type}`, type, difficulty: 1, points: 1 } as any;
    const byType: Record<QuestionType, Record<string, unknown>> = {
        [QuestionType.MCQ]: {
            question: 'Chọn đáp án đúng', options: ['Một', 'Hai'], correctAnswer: 'B',
        },
        [QuestionType.TRUE_FALSE]: {
            mainQuestion: 'Đánh dấu đúng sai',
            items: [{ id: 'tf-1', statement: 'Một cộng một bằng hai', isCorrect: true }],
        },
        [QuestionType.SHORT_ANSWER]: {
            question: 'Một cộng một bằng bao nhiêu?', correctAnswer: '2',
        },
        [QuestionType.MATCHING]: {
            question: 'Nối hai cột',
            pairs: [{ left: '1 + 1', right: '2' }, { left: '2 + 2', right: '4' }],
        },
        [QuestionType.MULTIPLE_SELECT]: {
            question: 'Chọn các số chẵn', options: ['1', '2', '4'], correctAnswers: ['B', 'C'],
        },
        [QuestionType.DRAG_DROP]: {
            question: 'Điền từ', text: 'Bầu trời [xanh].', blanks: ['xanh'], distractors: ['đỏ'],
        },
        [QuestionType.ORDERING]: {
            question: 'Sắp xếp', items: ['Một', 'Hai'], correctOrder: [0, 1],
        },
        [QuestionType.IMAGE_QUESTION]: {
            question: 'Nhìn hình và chọn', image: 'https://cdn.example.com/image.png',
            options: ['A', 'B'], correctAnswer: 'A',
        },
        [QuestionType.DROPDOWN]: {
            question: 'Chọn từ', text: 'Một cộng một bằng [ô trống].',
            blanks: [{ id: 'b-1', options: ['1', '2'], correctAnswer: '2' }],
        },
        [QuestionType.UNDERLINE]: {
            question: 'Gạch chân danh từ', sentence: 'Con mèo ngủ.',
            words: ['Con', 'mèo', 'ngủ'], correctWordIndexes: [1],
        },
        [QuestionType.CATEGORIZATION]: {
            question: 'Phân loại', categories: [{ id: 'even', name: 'Số chẵn' }],
            items: [{ id: 'i-1', content: '2', categoryId: 'even' }],
        },
        [QuestionType.WORD_SCRAMBLE]: {
            question: 'Ghép từ', letters: ['H', 'O', 'A'], correctWord: 'HOA',
        },
        [QuestionType.RIDDLE]: {
            question: 'Giải câu đố', riddleLines: ['Giữ nguyên là hoa'],
            correctAnswer: 'hoa', answerType: 'original', answerLabel: 'Đáp án',
        },
        [QuestionType.ERROR_CORRECTION]: {
            question: 'Tìm lỗi', passage: 'Em bé ngoan ngoãn.', wrongWord: 'ngoãn', correctWord: 'ngoan',
        },
        [QuestionType.GEOMETRY]: {
            question: 'Quan sát hình', geometryData: { kind: 'segment', points: ['A', 'B'] },
        },
    };
    return { ...base, ...byType[type], ...overrides } as Question;
};

const quiz = (questions: Question[], overrides: Partial<Quiz> = {}): Quiz => ({
    id: 'quiz-1', title: 'Đề kiểm tra', classLevel: '4A', category: 'toan',
    timeLimit: 20, questions, createdAt: '2026-07-21T08:00:00.000Z',
    ...overrides,
});

const errors = (issues: ManualQuizIssue[]) => issues.filter((issue) => issue.severity === 'error');

const VALID_TYPES = Object.values(QuestionType);

describe('manual quiz validation engine', () => {
    it.each(VALID_TYPES)('accepts a minimally valid %s question', (type) => {
        const issues = validateManualQuiz(quiz([question(type)]), { targetPoints: 1 });
        expect(errors(issues).filter((issue) => issue.questionId)).toEqual([]);
    });

    it('detects empty, duplicate and unreachable MCQ answers', () => {
        const issues = validateManualQuiz(quiz([question(QuestionType.MCQ, {
            options: ['Hai', '  hai ', ''],
            correctAnswer: 'D',
        })]), { targetPoints: 1 });

        expect(issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'MCQ_OPTION_EMPTY', severity: 'error', questionId: 'q-MCQ' }),
            expect.objectContaining({ code: 'MCQ_OPTION_DUPLICATE', severity: 'error', questionId: 'q-MCQ' }),
            expect.objectContaining({ code: 'MCQ_CORRECT_ANSWER_MISSING', severity: 'error', questionId: 'q-MCQ' }),
        ]));
    });

    it('groups math issues by question and field with navigation actions', () => {
        const issues = validateManualQuiz(quiz([question(QuestionType.MCQ, {
            question: 'Tính $\\frac{1}{2',
        })]), { targetPoints: 1 });

        expect(issues).toEqual(expect.arrayContaining([
            expect.objectContaining({
                code: 'MATH_UNCLOSED_DELIMITER',
                severity: 'error',
                questionId: 'q-MCQ',
                field: 'question',
                action: 'go-to-question',
            }),
        ]));
    });

    it('validates title, question count, time, points and unsafe media', () => {
        const issues = validateManualQuiz(quiz([
            question(QuestionType.IMAGE_QUESTION, {
                points: 0,
                image: 'blob:https://example.com/temp',
            }),
        ], { title: '  ', timeLimit: 0 }), { targetPoints: 10 });

        expect(issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'QUIZ_TITLE_REQUIRED', severity: 'error' }),
            expect.objectContaining({ code: 'QUIZ_TIME_INVALID', severity: 'error', action: 'fix-time' }),
            expect.objectContaining({ code: 'QUESTION_POINTS_INVALID', severity: 'error', action: 'fix-points' }),
            expect.objectContaining({ code: 'MEDIA_NOT_PERSISTED', severity: 'error', action: 'retry-media' }),
            expect.objectContaining({ code: 'QUIZ_POINTS_MISMATCH', severity: 'warning', action: 'fix-points' }),
        ]));
    });

    it('returns useful successes for a publish-ready quiz', () => {
        const issues = validateManualQuiz(quiz([
            question(QuestionType.MCQ, { points: 5 }),
            question(QuestionType.SHORT_ANSWER, { id: 'q-short', points: 5 }),
        ]), { targetPoints: 10 });

        expect(errors(issues)).toEqual([]);
        expect(issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'QUIZ_TITLE_READY', severity: 'success' }),
            expect.objectContaining({ code: 'QUIZ_QUESTIONS_READY', severity: 'success' }),
            expect.objectContaining({ code: 'QUIZ_POINTS_READY', severity: 'success' }),
            expect.objectContaining({ code: 'QUIZ_TIME_READY', severity: 'success' }),
        ]));
    });
});

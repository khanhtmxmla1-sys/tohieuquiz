import { describe, expect, it } from 'vitest';
import {
  buildQuestionAnswerReview,
  gradeQuiz,
} from '../src/domain/quiz-scoring';

describe('voided question scoring fairness', () => {
  it('excludes an invalid source question from the score denominator', () => {
    const quiz = {
      questions: [
        { id: 'q1', type: 'MCQ', options: ['1', '2'], correctAnswer: 'B' },
        { id: 'q2', type: 'SHORT_ANSWER', correctAnswer: 'mine' },
        { id: 'broken', type: 'SHORT_ANSWER', correctAnswer: '' },
      ],
    };
    const result = gradeQuiz(quiz, {
      q1: 'B',
      q2: 'mine',
      broken: 'anything',
    });

    expect(result).toMatchObject({
      questionCount: 3,
      totalQuestions: 2,
      voidedCount: 1,
      correctCount: 2,
      score: 10,
    });
    expect(result.details.find((item) => item.questionId === 'broken')).toMatchObject({
      status: 'voided',
      isCorrect: false,
      issueCode: 'MISSING_CORRECT_ANSWER',
    });
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: 'broken', code: 'MISSING_CORRECT_ANSWER' }),
    ]));
  });

  it('keeps an invalid student answer in the denominator', () => {
    const result = gradeQuiz({
      questions: [
        { id: 'q1', type: 'MCQ', options: ['1', '2'], correctAnswer: 'B' },
      ],
    }, {
      q1: 'not-an-option',
    });

    expect(result).toMatchObject({
      questionCount: 1,
      totalQuestions: 1,
      voidedCount: 0,
      correctCount: 0,
      score: 0,
    });
    expect(result.details[0]).toMatchObject({
      status: 'invalid',
      issueCode: 'INVALID_OPTION_SELECTION',
    });
  });

  it('returns zero safely when every question is voided', () => {
    const result = gradeQuiz({
      questions: [
        { id: 'broken', type: 'SHORT_ANSWER', correctAnswer: '' },
      ],
    }, {
      broken: 'answer',
    });

    expect(result).toMatchObject({
      questionCount: 1,
      totalQuestions: 0,
      voidedCount: 1,
      correctCount: 0,
      score: 0,
    });
  });

  it('renders a neutral review for a voided question', () => {
    const review = buildQuestionAnswerReview(
      { id: 'broken', type: 'SHORT_ANSWER', question: 'Điền', correctAnswer: '' },
      'mine',
      { questionId: 'broken', type: 'SHORT_ANSWER', status: 'voided', isCorrect: false },
    );

    expect(review).toMatchObject({
      status: 'voided',
      isCorrect: false,
      studentAnswer: {
        kind: 'unsupported',
        lines: [{ value: 'Câu hỏi không được tính điểm do lỗi dữ liệu' }],
      },
      correctAnswer: {
        kind: 'unsupported',
        lines: [{ value: 'Câu hỏi không được tính điểm do lỗi dữ liệu' }],
      },
    });
  });
});

import { describe, expect, it } from 'vitest';
import { QuestionType, type Question } from '../src/types';
import { validateQuestionForAuthoring } from '../src/features/manual-quiz-workspace/validation/questionValidators';
import {
  prepareQuestionScoringContractForSave,
  QuestionScoringContractValidationError,
} from '../workers/src/services/questionScoringContract';

const base = (type: QuestionType, fields: Record<string, unknown>): Question => ({
  id: `alignment-${type}`,
  type,
  points: 1,
  difficulty: 1,
  ...fields,
} as Question);

const validQuestions: Question[] = [
  base(QuestionType.MCQ, { question: 'Chọn', options: ['Một', 'Hai'], correctAnswer: 'B' }),
  base(QuestionType.IMAGE_QUESTION, {
    question: 'Chọn hình', image: 'https://cdn.example.com/a.png', options: ['Một', 'Hai'], correctAnswer: 'A',
  }),
  base(QuestionType.MULTIPLE_SELECT, {
    question: 'Chọn nhiều', options: ['Một', 'Hai', 'Ba'], correctAnswers: ['A', 'C'],
  }),
  base(QuestionType.SHORT_ANSWER, { question: 'Điền', correctAnswer: 'mine' }),
  base(QuestionType.TRUE_FALSE, {
    mainQuestion: 'Đúng hay sai', items: [{ id: 'a', statement: 'Ý a', isCorrect: true }],
  }),
  base(QuestionType.MATCHING, {
    question: 'Nối', pairs: [{ left: 'A', right: '1' }, { left: 'B', right: '2' }],
  }),
  base(QuestionType.DRAG_DROP, {
    question: 'Điền', text: '[blank_0]', blanks: ['xanh'], distractors: ['đỏ'],
  }),
  base(QuestionType.DROPDOWN, {
    question: 'Chọn', text: '[blank_0]', blanks: [{ id: 'blank_0', options: ['x', 'y'], correctAnswer: 'x' }],
  }),
  base(QuestionType.ORDERING, { question: 'Sắp xếp', items: ['A', 'B'], correctOrder: [0, 1] }),
  base(QuestionType.CATEGORIZATION, {
    question: 'Phân loại', categories: [{ id: 'g', name: 'Nhóm' }], items: [{ id: 'i', content: 'Mục', categoryId: 'g' }],
  }),
  base(QuestionType.UNDERLINE, {
    question: 'Gạch chân', sentence: 'Em học bài', words: ['Em', 'học', 'bài'], correctWordIndexes: [1],
  }),
  base(QuestionType.WORD_SCRAMBLE, { question: 'Ghép chữ', letters: ['H', 'O', 'A'], correctWord: 'HOA' }),
  base(QuestionType.RIDDLE, {
    question: 'Câu đố', riddleLines: ['Giữ nguyên là hoa'], correctAnswer: 'hoa', answerType: 'original', answerLabel: 'Đáp án',
  }),
  base(QuestionType.ERROR_CORRECTION, {
    question: 'Sửa lỗi', passage: 'Bé ngoãn', wrongWord: 'ngoãn', correctWord: 'ngoan',
  }),
];

const authoringErrors = (question: Question) => validateQuestionForAuthoring(question)
  .filter((issue) => issue.severity === 'error');

describe('question authoring and scoring contract alignment', () => {
  it.each(validQuestions)('accepts a question that the Worker can safely prepare: $type', (question) => {
    expect(authoringErrors(question)).toEqual([]);
    expect(() => prepareQuestionScoringContractForSave(question)).not.toThrow();
  });

  it('surfaces a scoring-only duplicate multiple-select answer before publish', () => {
    const question = base(QuestionType.MULTIPLE_SELECT, {
      question: 'Chọn nhiều',
      options: ['Một', 'Hai', 'Ba'],
      correctAnswers: ['A', 'A'],
    });

    expect(authoringErrors(question)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'INVALID_MULTIPLE_SELECT_CONTRACT',
        questionId: question.id,
        severity: 'error',
      }),
    ]));
    expect(() => prepareQuestionScoringContractForSave(question)).toThrow(QuestionScoringContractValidationError);
  });

  it.each([
    base(QuestionType.SHORT_ANSWER, { question: 'Điền', correctAnswer: '' }),
    base(QuestionType.MCQ, { question: 'Chọn', options: ['Một', 'Hai'], correctAnswer: 'D' }),
    base(QuestionType.TRUE_FALSE, { mainQuestion: 'Đúng sai', items: [{ id: 'a', statement: 'Ý a' }] }),
    base(QuestionType.DROPDOWN, {
      question: 'Chọn', text: '[blank_0]', blanks: [{ id: 'blank_0', options: ['x', 'y'], correctAnswer: '' }],
    }),
    base(QuestionType.ORDERING, { question: 'Sắp xếp', items: ['A', 'B'], correctOrder: [0, 0] }),
  ])('blocks invalid $type data in both authoring and Worker save paths', (question) => {
    expect(authoringErrors(question).length).toBeGreaterThan(0);
    expect(() => prepareQuestionScoringContractForSave(question)).toThrow(QuestionScoringContractValidationError);
  });
});

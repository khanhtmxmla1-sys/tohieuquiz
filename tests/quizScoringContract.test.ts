import { describe, expect, it } from 'vitest';
import {
  gradeQuestion,
  gradeQuiz,
  isQuestionAnswered,
} from '../src/domain/quiz-scoring';

const correctCases: Array<{ name: string; question: Record<string, unknown>; answer: unknown }> = [
  {
    name: 'MCQ',
    question: { id: 'mcq', type: 'MCQ', options: ['2', '4', '6'], correctAnswer: 'B' },
    answer: { type: 'MCQ', optionId: 'option-1' },
  },
  {
    name: 'IMAGE_QUESTION',
    question: { id: 'image', type: 'IMAGE_QUESTION', options: ['tròn', 'vuông'], correctAnswer: 'A' },
    answer: { type: 'IMAGE_QUESTION', optionId: 'option-0' },
  },
  {
    name: 'MULTIPLE_SELECT',
    question: { id: 'multi', type: 'MULTIPLE_SELECT', options: ['1', '2', '3', '4'], correctAnswers: ['B', 'D'] },
    answer: { type: 'MULTIPLE_SELECT', optionIds: ['option-3', 'option-1'] },
  },
  {
    name: 'SHORT_ANSWER',
    question: { id: 'short', type: 'SHORT_ANSWER', correctAnswer: 'Hà Nội|Ha Noi' },
    answer: { type: 'SHORT_ANSWER', value: '  HÀ   NỘI ' },
  },
  {
    name: 'TRUE_FALSE',
    question: { id: 'tf', type: 'TRUE_FALSE', items: [{ id: 't1', isCorrect: true }, { id: 't2', isCorrect: false }] },
    answer: { type: 'TRUE_FALSE', values: { t1: true, t2: false } },
  },
  {
    name: 'MATCHING',
    question: { id: 'match', type: 'MATCHING', pairs: [{ left: 'A', right: '1' }, { left: 'B', right: '2' }] },
    answer: { type: 'MATCHING', pairs: { 'left-0': 'right-0', 'left-1': 'right-1' } },
  },
  {
    name: 'DRAG_DROP',
    question: { id: 'drag', type: 'DRAG_DROP', text: '[blank_0] và [blank_1]', blanks: ['xanh', 'đỏ'] },
    answer: { type: 'DRAG_DROP', values: { 'blank-0': 'xanh', 'blank-1': 'đỏ' } },
  },
  {
    name: 'DROPDOWN',
    question: { id: 'drop', type: 'DROPDOWN', text: '[blank_0]', blanks: [{ id: 'blank_0', options: ['x', 'y'], correctAnswer: 'x' }] },
    answer: { type: 'DROPDOWN', values: { blank_0: 'x' } },
  },
  {
    name: 'ORDERING',
    question: { id: 'order', type: 'ORDERING', items: ['B', 'A'], correctOrder: [1, 0] },
    answer: { type: 'ORDERING', ranks: { 'item-0': 2, 'item-1': 1 } },
  },
  {
    name: 'CATEGORIZATION',
    question: { id: 'cat', type: 'CATEGORIZATION', categories: [{ id: 'even' }, { id: 'odd' }], items: [{ id: '2', categoryId: 'even' }, { id: '3', categoryId: 'odd' }] },
    answer: { type: 'CATEGORIZATION', categoriesByItemId: { '2': 'even', '3': 'odd' } },
  },
  {
    name: 'UNDERLINE',
    question: { id: 'under', type: 'UNDERLINE', words: ['Em', 'học', 'bài'], correctWordIndexes: [1, 2] },
    answer: { type: 'UNDERLINE', indexes: [2, 1] },
  },
  {
    name: 'WORD_SCRAMBLE',
    question: { id: 'scramble', type: 'WORD_SCRAMBLE', letters: ['O', 'H', 'A'], correctWord: 'HOA' },
    answer: { type: 'WORD_SCRAMBLE', letterIndexes: [1, 0, 2] },
  },
  {
    name: 'RIDDLE',
    question: { id: 'riddle', type: 'RIDDLE', correctAnswer: 'hoa' },
    answer: { type: 'RIDDLE', value: ' HOA ' },
  },
  {
    name: 'ERROR_CORRECTION',
    question: { id: 'error', type: 'ERROR_CORRECTION', wrongWord: 'ngoãn', correctWord: 'ngoan' },
    answer: { type: 'ERROR_CORRECTION', wrongWord: ' NGOÃN ', correctWord: 'Ngoan' },
  },
];

describe('canonical scoring contract for 14 published types', () => {
  it.each(correctCases)('grades $name correctly', ({ question, answer }) => {
    expect(gradeQuestion(question, answer)).toMatchObject({ status: 'correct', isCorrect: true });
    expect(isQuestionAnswered(question, answer)).toBe(true);
  });

  it.each(correctCases)('marks an empty $name answer skipped', ({ question }) => {
    expect(gradeQuestion(question, undefined)).toMatchObject({ status: 'skipped', isCorrect: false });
    expect(isQuestionAnswered(question, undefined)).toBe(false);
  });

  it('grades an entire quiz with one shared formula', () => {
    const quiz = { questions: correctCases.map(({ question }) => question) };
    const answers = Object.fromEntries(correctCases.map(({ question, answer }) => [String(question.id), answer]));
    const result = gradeQuiz(quiz, answers);
    expect(result).toMatchObject({ engineVersion: '2.0.0', correctCount: 14, totalQuestions: 14, score: 10 });
    expect(result.details).toHaveLength(14);
    expect(result.issues).toEqual([]);
  });

  it('grades dropdown when UI placeholder key differs from stored blank id', () => {
    const question = { id: 'd', type: 'DROPDOWN', text: '[blank_0]', blanks: [{ id: 'blank_0', options: ['x'], correctAnswer: 'x' }] };
    expect(gradeQuestion(question, { 0: 'x' }).isCorrect).toBe(true);
  });

  it('grades matching answers sent as l-N/r-N ids', () => {
    const question = { id: 'm', type: 'MATCHING', pairs: [{ left: 'A', right: '1' }, { left: 'B', right: '2' }] };
    expect(gradeQuestion(question, { 'l-0': 'r-0', 'l-1': 'r-1' }).isCorrect).toBe(true);
  });

  it('grades ordering answers sent as rank object', () => {
    const question = { id: 'o', type: 'ORDERING', items: ['B', 'A'], correctOrder: [1, 0] };
    expect(gradeQuestion(question, { 0: 2, 1: 1 }).isCorrect).toBe(true);
  });

  it('maps multiple-select option labels to stored option content', () => {
    const question = { id: 's', type: 'MULTIPLE_SELECT', options: ['1', '2', '3', '4'], correctAnswers: ['2', '4'] };
    expect(gradeQuestion(question, ['B', 'D']).isCorrect).toBe(true);
  });

  it('does not treat a partial structured answer as complete', () => {
    const question = correctCases.find((item) => item.name === 'TRUE_FALSE')!.question;
    expect(isQuestionAnswered(question, { t1: true })).toBe(false);
  });

  it('rejects unsupported auto-grading contracts explicitly', () => {
    expect(gradeQuestion({ id: 'g', type: 'GEOMETRY', geometryData: {} }, '42')).toMatchObject({
      status: 'invalid',
      issueCode: 'QUESTION_NOT_AUTO_GRADABLE',
    });
  });
});

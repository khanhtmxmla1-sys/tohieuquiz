import { describe, expect, it } from 'vitest';
import { buildQuestionAnswerReview } from '../src/domain/quiz-scoring';

const cases: Array<{
  name: string;
  question: Record<string, unknown>;
  answer: unknown;
  studentText: string;
  correctText: string;
}> = [
  { name: 'MCQ', question: { id: 'mcq', type: 'MCQ', options: ['2', '4'], correctAnswer: 'B' }, answer: { type: 'MCQ', optionId: 'option-1' }, studentText: '4', correctText: '4' },
  { name: 'IMAGE_QUESTION', question: { id: 'image', type: 'IMAGE_QUESTION', options: ['Tròn', 'Vuông'], correctAnswer: 'A' }, answer: { type: 'IMAGE_QUESTION', optionId: 'option-0' }, studentText: 'Tròn', correctText: 'Tròn' },
  { name: 'MULTIPLE_SELECT', question: { id: 'multi', type: 'MULTIPLE_SELECT', options: ['1', '2', '3'], correctAnswers: ['A', 'C'] }, answer: { type: 'MULTIPLE_SELECT', optionIds: ['option-0', 'option-2'] }, studentText: '1', correctText: '3' },
  { name: 'SHORT_ANSWER', question: { id: 'short', type: 'SHORT_ANSWER', correctAnswer: 'Hà Nội' }, answer: { type: 'SHORT_ANSWER', value: 'Hà Nội' }, studentText: 'Hà Nội', correctText: 'Hà Nội' },
  { name: 'TRUE_FALSE', question: { id: 'tf', type: 'TRUE_FALSE', items: [{ id: 't1', statement: 'Mặt trời mọc phía Đông', isCorrect: true }] }, answer: { type: 'TRUE_FALSE', values: { t1: true } }, studentText: 'Đúng', correctText: 'Mặt trời mọc phía Đông' },
  { name: 'MATCHING', question: { id: 'matching', type: 'MATCHING', pairs: [{ left: 'Một', right: '1' }] }, answer: { type: 'MATCHING', pairs: { 'left-0': 'right-0' } }, studentText: 'Một', correctText: '1' },
  { name: 'DRAG_DROP', question: { id: 'drag', type: 'DRAG_DROP', text: '[1]', blanks: [{ id: 'b1', correctAnswer: '24' }] }, answer: { type: 'DRAG_DROP', values: { b1: '24' } }, studentText: '24', correctText: 'Chỗ trống 1' },
  { name: 'DROPDOWN', question: { id: 'drop', type: 'DROPDOWN', text: '[1]', blanks: [{ id: 'b1', options: ['x', 'y'], correctAnswer: 'x' }] }, answer: { type: 'DROPDOWN', values: { b1: 'x' } }, studentText: 'x', correctText: 'Chỗ trống 1' },
  { name: 'ORDERING', question: { id: 'order', type: 'ORDERING', items: ['B', 'A'], correctOrder: [1, 0] }, answer: { type: 'ORDERING', ranks: { 'item-0': 2, 'item-1': 1 } }, studentText: 'A', correctText: 'B' },
  { name: 'CATEGORIZATION', question: { id: 'cat', type: 'CATEGORIZATION', categories: [{ id: 'even', name: 'Chẵn' }], items: [{ id: '2', content: '2', categoryId: 'even' }] }, answer: { type: 'CATEGORIZATION', categoriesByItemId: { '2': 'even' } }, studentText: 'Chẵn', correctText: '2' },
  { name: 'UNDERLINE', question: { id: 'under', type: 'UNDERLINE', words: ['Em', 'học'], correctWordIndexes: [1] }, answer: { type: 'UNDERLINE', indexes: [1] }, studentText: 'học', correctText: 'học' },
  { name: 'WORD_SCRAMBLE', question: { id: 'scramble', type: 'WORD_SCRAMBLE', letters: ['O', 'H', 'A'], correctWord: 'HOA' }, answer: { type: 'WORD_SCRAMBLE', letterIndexes: [1, 0, 2] }, studentText: 'HOA', correctText: 'HOA' },
  { name: 'RIDDLE', question: { id: 'riddle', type: 'RIDDLE', correctAnswer: 'Hoa phượng' }, answer: { type: 'RIDDLE', value: 'Hoa phượng' }, studentText: 'Hoa phượng', correctText: 'Hoa phượng' },
  { name: 'ERROR_CORRECTION', question: { id: 'error', type: 'ERROR_CORRECTION', wrongWord: 'ngoãn', correctWord: 'ngoan' }, answer: { type: 'ERROR_CORRECTION', wrongWord: 'ngoãn', correctWord: 'ngoan' }, studentText: 'ngoãn', correctText: 'ngoan' },
];

const reviewText = (value: { lines: Array<{ label?: string; value: string }> }): string => (
  value.lines.map((line) => `${line.label || ''} ${line.value}`).join(' ')
);

describe('answer review model', () => {
  it.each(cases)('renders $name without leaking technical object text', ({ question, answer, studentText, correctText }) => {
    const review = buildQuestionAnswerReview(question, answer, {
      questionId: String(question.id),
      type: String(question.type),
      status: 'correct',
      isCorrect: true,
    });
    const student = reviewText(review.studentAnswer);
    const correct = reviewText(review.correctAnswer);

    expect(student).toContain(studentText);
    expect(correct).toContain(correctText);
    expect(`${student} ${correct}`).not.toMatch(/\[object Object\]|gradingVersion|questionSnapshot|isCorrect/);
  });

  it('renders a skipped drag-drop answer as empty while preserving the correct blank values', () => {
    const review = buildQuestionAnswerReview({
      id: 'drag-skipped',
      type: 'DRAG_DROP',
      text: '[1] và [2]',
      blanks: [
        { id: 'b1', correctAnswer: '24' },
        { id: 'b2', correctAnswer: '6' },
      ],
    }, {
      selectedAnswer: {
        isCorrect: false,
        status: 'skipped',
        gradingVersion: '2.0.0',
        questionSnapshot: {},
      },
    }, {
      questionId: 'drag-skipped',
      type: 'DRAG_DROP',
      status: 'skipped',
      isCorrect: false,
    });

    expect(review.studentAnswer).toEqual({ kind: 'empty', lines: [{ value: 'Chưa trả lời' }] });
    expect(reviewText(review.correctAnswer)).toContain('Chỗ trống 1 24');
    expect(reviewText(review.correctAnswer)).toContain('Chỗ trống 2 6');
  });
});

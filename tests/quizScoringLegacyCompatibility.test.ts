import { describe, expect, it } from 'vitest';
import { gradeQuestion, normalizeAnswerForQuestion } from '../src/domain/quiz-scoring';

describe('legacy scoring compatibility', () => {
  it.each([
    ['A', true],
    ['A. hai', true],
    ['hai', true],
    ['0', true],
    ['B', false],
  ])('maps legacy MCQ answer %j', (answer, expected) => {
    const question = { id: 'q', type: 'MCQ', options: ['hai', 'ba'], correctAnswer: 'A' };
    expect(gradeQuestion(question, answer).isCorrect).toBe(expected);
  });

  it.each([
    [['A', 'C']],
    [['2', '4']],
    ['["A","C"]'],
    ['A|C'],
  ])('accepts legacy multiple-select shape %j', (answer) => {
    const question = { id: 'q', type: 'MULTIPLE_SELECT', options: ['2', '3', '4'], correctAnswer: '["2","4"]' };
    expect(gradeQuestion(question, answer).isCorrect).toBe(true);
  });

  it('unwraps stored result answer and ignores client correctness metadata', () => {
    const question = { id: 'q', type: 'MCQ', options: ['yes', 'no'], correctAnswer: 'A' };
    expect(gradeQuestion(question, { selectedAnswer: 'B', isCorrect: true, questionSnapshot: { correctAnswer: 'B' } })).toMatchObject({
      status: 'wrong',
      isCorrect: false,
    });
  });

  it('accepts matching content maps only when content is unambiguous', () => {
    const question = { id: 'q', type: 'MATCHING', pairs: [{ left: 'A', right: '1' }, { left: 'B', right: '2' }] };
    expect(gradeQuestion(question, { A: '1', B: '2', selectedLeft: 'A' }).isCorrect).toBe(true);
  });

  it('returns invalid for ambiguous matching content maps', () => {
    const question = { id: 'q', type: 'MATCHING', pairs: [{ left: 'same', right: '1' }, { left: 'same', right: '2' }] };
    expect(gradeQuestion(question, { same: '1' })).toMatchObject({ status: 'invalid', issueCode: 'AMBIGUOUS_LEGACY_MATCHING_CONTENT' });
  });

  it('accepts drag-drop arrays and occurrence-index objects', () => {
    const question = { id: 'q', type: 'DRAG_DROP', text: '[a] [b]', blanks: ['x', 'y'] };
    expect(gradeQuestion(question, ['x', 'y']).isCorrect).toBe(true);
    expect(gradeQuestion(question, { 0: 'x', 1: 'y' }).isCorrect).toBe(true);
  });

  it('normalizes ordering arrays and rank maps to the same answer', () => {
    const question = { id: 'q', type: 'ORDERING', items: ['B', 'A'], correctOrder: [1, 0] };
    expect(gradeQuestion(question, [1, 0]).isCorrect).toBe(true);
    expect(gradeQuestion(question, { 0: 2, 1: 1 }).isCorrect).toBe(true);
  });

  it('removes matching UI metadata during normalization', () => {
    const question = { id: 'q', type: 'MATCHING', pairs: [{ left: 'A', right: '1' }] };
    const normalized = normalizeAnswerForQuestion(question, { 'l-0': 'r-0', selectedLeft: 'l-0', __shuffledIds: ['r-0'] });
    expect(normalized).toMatchObject({ ok: true, answer: { type: 'MATCHING', pairs: { 'left-0': 'right-0' } } });
  });
});

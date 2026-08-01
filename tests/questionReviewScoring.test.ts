import { describe, expect, it } from 'vitest';
import { checkAnswer } from '../src/utils/question/scoring.util';

describe('question review scoring facade', () => {
  it('regrades dropdown answers that use occurrence indexes', () => {
    const question = {
      id: 'drop', type: 'DROPDOWN', text: '[blank_0]',
      blanks: [{ id: 'blank_0', options: ['x', 'y'], correctAnswer: 'x' }],
    };
    expect(checkAnswer(question, { 0: 'x' })).toMatchObject({ status: 'correct', isCorrect: true });
  });

  it('regrades canonical categorization by item and category IDs', () => {
    const question = {
      id: 'cat', type: 'CATEGORIZATION', categories: [{ id: 'noun' }, { id: 'verb' }],
      items: [{ id: 'book', categoryId: 'noun' }, { id: 'read', categoryId: 'verb' }],
    };
    expect(checkAnswer(question, { book: 'noun', read: 'verb' }).isCorrect).toBe(true);
  });

  it('regrades error correction objects', () => {
    const question = { id: 'error', type: 'ERROR_CORRECTION', wrongWord: 'ngoãn', correctWord: 'ngoan' };
    expect(checkAnswer(question, { wrongWord: 'NGOÃN', correctWord: 'Ngoan' }).isCorrect).toBe(true);
  });

  it('preserves skipped status for empty answers', () => {
    const question = { id: 'q', type: 'MCQ', options: ['đúng', 'sai'], correctAnswer: 'A' };
    expect(checkAnswer(question, '')).toMatchObject({ status: 'skipped', isCorrect: false });
  });

  it('does not trust nested client isCorrect metadata', () => {
    const question = { id: 'q', type: 'MCQ', options: ['đúng', 'sai'], correctAnswer: 'A' };
    expect(checkAnswer(question, { selectedAnswer: 'B', isCorrect: true })).toMatchObject({ status: 'wrong', isCorrect: false });
  });
});

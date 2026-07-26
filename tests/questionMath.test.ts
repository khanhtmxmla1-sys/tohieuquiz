import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import {
  normalizeQuestionMath,
  validateQuestionMath,
} from '../src/utils/questionMath';

describe('question-wide math validation', () => {
  it('checks question text, options, true/false statements and matching pairs', () => {
    const question = {
      id: 'q-1',
      type: QuestionType.MATCHING,
      question: 'Nối các biểu thức $x^2$',
      pairs: [
        { left: '$\\frac{1}{2}', right: '\\sqrt{4}' },
      ],
    } as any;

    const issues = validateQuestionMath(question);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'pairs[0].left', code: 'unclosed-delimiter' }),
      ]),
    );
  });

  it('normalizes every math-bearing field rather than only the question title', () => {
    const question = {
      id: 'q-2',
      type: QuestionType.TRUE_FALSE,
      mainQuestion: 'Xét \\frac{1}{2}',
      items: [{ id: 'a', statement: '\\sqrt{9} = 3', isCorrect: true }],
      explanation: 'Vì \\frac{3}{3} = 1',
    } as any;

    const normalized = normalizeQuestionMath(question) as any;
    expect(normalized.mainQuestion).toBe('Xét $\\frac{1}{2}$');
    expect(normalized.items[0].statement).toBe('$\\sqrt{9}$ = 3');
    expect(normalized.explanation).toBe('Vì $\\frac{3}{3}$ = 1');
  });
});

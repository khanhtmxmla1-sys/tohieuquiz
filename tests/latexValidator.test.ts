import { describe, expect, it } from 'vitest';
import {
  validateBlankMapping,
  validateLatexSyntax,
  validateQuestionLatex,
} from '../src/lib/ai/validators/latexValidator';

describe('AI LaTeX validation', () => {
  it('does not confuse the optional root degree with an answer placeholder', () => {
    expect(() => validateBlankMapping('Tính \\sqrt[3]{8}', [])).not.toThrow();
  });

  it('validates nested option, statement and matching text fields', () => {
    expect(() => validateQuestionLatex({
      question: 'Chọn đáp án',
      options: ['Đúng', '$\\frac{1}{2'],
    })).toThrow(/options\[1\]/);

    expect(() => validateQuestionLatex({
      pairs: [{ left: '\\sqrt{4}', right: '$x_{1$' }],
    })).toThrow(/pairs\[0\]\.right/);
  });

  it('rejects malformed raw TeX even without dollar delimiters', () => {
    expect(() => validateLatexSyntax('Tính \\frac{1}{2')).toThrow(/Invalid LaTeX syntax/);
  });
});
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { loadCommittedMath5Dataset } from '../scripts/question-bank/validate-math5-dataset';

const normalizeNumericNotation = (value: string): string => value
  .replace(/\.(?=\d{3}(?:\D|$))/g, '')
  .replace(/,/g, '.');

const normalizeExpression = (value: string): string => normalizeNumericNotation(value)
  .replace(/×/g, '*')
  .replace(/:/g, '/')
  .replace(/\s+/g, '');

const evaluateFlatExpression = (source: string): number | null => {
  const fractionDivision = source.match(/^\s*(\d+)\/(\d+)\s*:\s*(\d+)\/(\d+)\s*$/);
  if (fractionDivision) {
    return (Number(fractionDivision[1]) / Number(fractionDivision[2]))
      / (Number(fractionDivision[3]) / Number(fractionDivision[4]));
  }
  const expression = normalizeExpression(source);
  if (!/^\d+(?:\.\d+)?(?:[+\-*/]\d+(?:\.\d+)?)+$/.test(expression)) return null;
  const tokens = expression.match(/\d+(?:\.\d+)?|[+\-*/]/g);
  if (!tokens) return null;
  const values: Array<number | string> = tokens.map((token) => /^[+\-*/]$/.test(token) ? token : Number(token));

  for (let index = 1; index < values.length - 1;) {
    const operator = values[index];
    if (operator !== '*' && operator !== '/') {
      index += 2;
      continue;
    }
    const left = values[index - 1] as number;
    const right = values[index + 1] as number;
    values.splice(index - 1, 3, operator === '*' ? left * right : left / right);
    index = Math.max(1, index - 2);
  }

  let result = values[0] as number;
  for (let index = 1; index < values.length; index += 2) {
    const operator = values[index] as string;
    const right = values[index + 1] as number;
    result = operator === '+' ? result + right : result - right;
  }
  return result;
};

const extractExpression = (text: string): string | null => {
  const trimmed = text.trim().replace(/[.?]$/, '');
  for (const prefix of ['Tính giá trị biểu thức ', 'Tính ']) {
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  }
  const match = trimmed.match(/^(.+?) bằng bao nhiêu$/);
  return match?.[1] || null;
};

const parseAnswer = (value: string): number | null => {
  const normalized = normalizeNumericNotation(value.trim());
  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) return Number(normalized);
  const fraction = normalized.match(/^(-?\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  return null;
};

const selectedAnswer = (question: Record<string, unknown>): string | null => {
  if (question.type === 'SHORT_ANSWER') return String(question.correctAnswer || '');
  if (question.type === 'MCQ') {
    const answer = String(question.correctAnswer || '');
    const options = question.options as string[];
    return options[answer.charCodeAt(0) - 65] || null;
  }
  return null;
};

describe('Math 5 direct arithmetic answer audit', () => {
  it('recalculates every parseable direct expression and matches the stored answer', () => {
    const audited: string[] = [];
    const mismatches: Array<{ id: string; expression: string; expected: number; actual: number }> = [];

    for (const item of loadCommittedMath5Dataset().items) {
      const question = item.questionData as unknown as Record<string, unknown>;
      if (question.type !== 'MCQ' && question.type !== 'SHORT_ANSWER') continue;
      const text = String(question.question || '');
      const expression = extractExpression(text);
      if (!expression || expression.includes('(') || expression.includes(')')) continue;
      const expected = evaluateFlatExpression(expression);
      const answer = selectedAnswer(question);
      const actual = answer === null ? null : parseAnswer(answer);
      if (expected === null || actual === null) continue;
      audited.push(item.id);
      if (Math.abs(expected - actual) > 1e-9) mismatches.push({ id: item.id, expression, expected, actual });
    }

    expect(audited.length).toBeGreaterThanOrEqual(45);
    expect(mismatches).toEqual([]);
  });
});

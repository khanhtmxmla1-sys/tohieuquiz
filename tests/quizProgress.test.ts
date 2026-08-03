import { describe, expect, it } from 'vitest';
import { normalizeProgressQuestionType } from '../src/domain/quiz-progress';

describe('normalizeProgressQuestionType', () => {
  it.each([
    ['MCQ', 'MCQ'],
    ['MULTIPLE_CHOICE', 'MCQ'],
    ['IMAGE', 'IMAGE_QUESTION'],
    ['IMAGE_MCQ', 'IMAGE_QUESTION'],
    ['MATH_INPUT', 'MATH_INPUT'],
    ['geometry', 'GEOMETRY'],
  ])('maps %s to %s', (input, expected) => {
    expect(normalizeProgressQuestionType({ type: input })).toBe(expected);
  });

  it('reads questionType and normalizes hyphens', () => {
    expect(normalizeProgressQuestionType({ questionType: 'word-scramble' })).toBe('WORD_SCRAMBLE');
  });

  it('returns UNKNOWN instead of throwing', () => {
    expect(normalizeProgressQuestionType({ type: 'NEW_TYPE' })).toBe('UNKNOWN');
    expect(normalizeProgressQuestionType(null)).toBe('UNKNOWN');
  });
});

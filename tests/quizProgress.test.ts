import { describe, expect, it } from 'vitest';
import { getQuestionProgress, normalizeProgressQuestionType } from '../src/domain/quiz-progress';

describe('normalizeProgressQuestionType', () => {
  it.each([
    ['MCQ', 'MCQ'],
    ['MULTIPLE_CHOICE', 'MCQ'],
    ['IMAGE', 'IMAGE_QUESTION'],
    ['IMAGE_MCQ', 'IMAGE_QUESTION'],
    ['FILL_IN_THE_BLANK', 'DROPDOWN'],
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

describe('getQuestionProgress simple answers', () => {
  it('marks short answer complete without correctAnswer in student-safe DTO', () => {
    expect(getQuestionProgress(
      { id: 'q12', type: 'SHORT_ANSWER', question: 'The eraser is ____.' },
      'mine',
    )).toEqual({
      state: 'complete',
      hasInteraction: true,
      completedParts: 1,
      requiredParts: 1,
    });
  });

  it('returns empty after the answer is cleared', () => {
    expect(getQuestionProgress(
      { id: 'q12', type: 'SHORT_ANSWER' },
      '   ',
    )).toEqual({
      state: 'empty',
      hasInteraction: false,
      completedParts: 0,
      requiredParts: 1,
    });
  });

  it.each([
    [{ id: 'mcq', type: 'MCQ', options: ['Một', 'Hai'] }, 'B'],
    [{ id: 'mcq-canonical', type: 'MCQ', options: ['Một', 'Hai'] }, { type: 'MCQ', optionId: 'option-1' }],
    [{ id: 'image', type: 'IMAGE_QUESTION', options: ['Một', 'Hai'] }, 0],
    [{ id: 'riddle', type: 'RIDDLE' }, { type: 'RIDDLE', value: 'hoa' }],
    [{ id: 'geometry', type: 'GEOMETRY' }, '42'],
    [{ id: 'unknown', type: 'NEW_TYPE' }, 'something'],
  ])('marks a scalar or single-choice answer complete for %o', (question, answer) => {
    expect(getQuestionProgress(question, answer)).toMatchObject({
      state: 'complete',
      hasInteraction: true,
      completedParts: 1,
      requiredParts: 1,
    });
  });

  it.each([
    [['A'], 'legacy array'],
    [{ type: 'MULTIPLE_SELECT', optionIds: ['option-0'] }, 'canonical object'],
  ])('marks multiple select complete for %s', (answer) => {
    expect(getQuestionProgress(
      { id: 'multi', type: 'MULTIPLE_SELECT', options: ['A', 'B'] },
      answer,
    ).state).toBe('complete');
  });

  it('marks underline complete when at least one word is selected', () => {
    expect(getQuestionProgress(
      { id: 'underline', type: 'UNDERLINE', words: ['Em', 'học'] },
      { type: 'UNDERLINE', indexes: [1] },
    ).state).toBe('complete');
  });

  it('unwraps stored result answer envelopes', () => {
    expect(getQuestionProgress(
      { id: 'stored', type: 'SHORT_ANSWER' },
      { selectedAnswer: 'mine', isCorrect: false, status: 'wrong' },
    ).state).toBe('complete');
  });
});

describe('getQuestionProgress structured answers', () => {
  const trueFalse = {
    id: 'tf',
    type: 'TRUE_FALSE',
    items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  };

  it('tracks true/false from empty through partial to complete', () => {
    expect(getQuestionProgress(trueFalse, {})).toMatchObject({
      state: 'empty',
      completedParts: 0,
      requiredParts: 3,
    });
    expect(getQuestionProgress(trueFalse, { a: true })).toMatchObject({
      state: 'partial',
      completedParts: 1,
      requiredParts: 3,
    });
    expect(getQuestionProgress(trueFalse, { a: true, b: false, c: true })).toMatchObject({
      state: 'complete',
      completedParts: 3,
      requiredParts: 3,
    });
  });

  const matching = {
    id: 'm',
    type: 'MATCHING',
    pairs: [],
    leftItems: [{ id: 'l-0' }, { id: 'l-1' }],
    rightItems: [{ id: 'r-0' }, { id: 'r-1' }],
  };

  it('does not count matching UI metadata as an answer', () => {
    expect(getQuestionProgress(matching, { __shuffledIds: ['r-1', 'r-0'] })).toMatchObject({
      state: 'empty',
      completedParts: 0,
      requiredParts: 2,
    });
  });

  it('tracks matching pairs from partial to complete', () => {
    expect(getQuestionProgress(matching, {
      'l-0': 'r-0',
      __shuffledIds: ['r-1', 'r-0'],
    })).toMatchObject({ state: 'partial', completedParts: 1, requiredParts: 2 });
    expect(getQuestionProgress(matching, {
      'l-0': 'r-0',
      'l-1': 'r-1',
    })).toMatchObject({ state: 'complete', completedParts: 2, requiredParts: 2 });
  });

  it('does not mark matching complete when right targets are duplicated', () => {
    expect(getQuestionProgress(matching, {
      'l-0': 'r-0',
      'l-1': 'r-0',
    })).toMatchObject({ state: 'partial', completedParts: 1, requiredParts: 2 });
  });

  it.each(['DROPDOWN', 'DRAG_DROP'])('tracks %s blanks by declared IDs', (type) => {
    const question = { id: type, type, blanks: [{ id: 'b1' }, { id: 'b2' }] };
    expect(getQuestionProgress(question, {})).toMatchObject({
      state: 'empty', completedParts: 0, requiredParts: 2,
    });
    expect(getQuestionProgress(question, { b1: 'x' })).toMatchObject({
      state: 'partial', completedParts: 1, requiredParts: 2,
    });
    expect(getQuestionProgress(question, { b1: 'x', b2: 'y' })).toMatchObject({
      state: 'complete', completedParts: 2, requiredParts: 2,
    });
  });

  it('supports array answers and string blank fallback', () => {
    expect(getQuestionProgress(
      { id: 'drag', type: 'DRAG_DROP', blanks: ['x', 'y'] },
      ['x'],
    )).toMatchObject({ state: 'partial', completedParts: 1, requiredParts: 2 });
  });
});

describe('getQuestionProgress advanced answers', () => {
  const ordering = {
    id: 'ordering',
    type: 'ORDERING',
    items: ['B', 'A'],
  };

  it('requires unique complete ordering ranks', () => {
    expect(getQuestionProgress(ordering, { ranks: {} })).toMatchObject({
      state: 'empty', completedParts: 0, requiredParts: 2,
    });
    expect(getQuestionProgress(ordering, { ranks: { 'item-0': 1 } })).toMatchObject({
      state: 'partial', completedParts: 1, requiredParts: 2,
    });
    expect(getQuestionProgress(ordering, { ranks: { 'item-0': 1, 'item-1': 2 } })).toMatchObject({
      state: 'complete', completedParts: 2, requiredParts: 2,
    });
    expect(getQuestionProgress(ordering, { ranks: { 'item-0': 1, 'item-1': 1 } })).toMatchObject({
      state: 'partial', completedParts: 1, requiredParts: 2,
    });
  });

  const categorization = {
    id: 'categorization',
    type: 'CATEGORIZATION',
    items: [{ id: 'a' }, { id: 'b' }],
  };

  it('tracks categorization assignments', () => {
    expect(getQuestionProgress(categorization, { a: 'group-1' })).toMatchObject({
      state: 'partial', completedParts: 1, requiredParts: 2,
    });
    expect(getQuestionProgress(categorization, {
      categoriesByItemId: { a: 'group-1', b: 'group-2' },
    })).toMatchObject({ state: 'complete', completedParts: 2, requiredParts: 2 });
  });

  const errorCorrection = { id: 'error', type: 'ERROR_CORRECTION' };

  it('requires both error-correction fields', () => {
    expect(getQuestionProgress(errorCorrection, { wrongWord: 'ngoãn' })).toMatchObject({
      state: 'partial', completedParts: 1, requiredParts: 2,
    });
    expect(getQuestionProgress(errorCorrection, {
      wrongWord: 'ngoãn', correctWord: 'ngoan',
    })).toMatchObject({ state: 'complete', completedParts: 2, requiredParts: 2 });
  });

  it('tracks both fields of a math fraction', () => {
    const fraction = { id: 'fraction', type: 'MATH_INPUT', mathType: 'fraction' };
    expect(getQuestionProgress(fraction, { numerator: '1', denominator: '' })).toMatchObject({
      state: 'partial', completedParts: 1, requiredParts: 2,
    });
    expect(getQuestionProgress(fraction, { numerator: '1', denominator: '2' })).toMatchObject({
      state: 'complete', completedParts: 2, requiredParts: 2,
    });
  });

  it('requires all letters for word scramble', () => {
    const scramble = { id: 'scramble', type: 'WORD_SCRAMBLE', letters: ['H', 'O', 'A'] };
    expect(getQuestionProgress(scramble, [0, 1])).toMatchObject({
      state: 'partial', completedParts: 2, requiredParts: 3,
    });
    expect(getQuestionProgress(scramble, {
      type: 'WORD_SCRAMBLE', letterIndexes: [0, 1, 2],
    })).toMatchObject({ state: 'complete', completedParts: 3, requiredParts: 3 });
  });
});

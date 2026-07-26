import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import {
  AI_SELECTABLE_QUESTION_TYPES,
  EXPERIMENTAL_LEGACY_QUESTION_TYPES,
  MANUAL_ONLY_QUESTION_TYPES,
  getQuestionTypeAvailability,
} from '../src/services/ai/question-contracts/questionTypeAvailability';

describe('AI question type availability', () => {
  it('classifies every QuestionType exactly once', () => {
    const groups = [
      AI_SELECTABLE_QUESTION_TYPES,
      MANUAL_ONLY_QUESTION_TYPES,
      EXPERIMENTAL_LEGACY_QUESTION_TYPES,
    ];
    const flattened = groups.flat();

    expect(new Set(flattened).size).toBe(flattened.length);
    expect(new Set(flattened)).toEqual(new Set(Object.values(QuestionType)));
  });

  it('keeps exactly thirteen AI-selectable types in the approved order', () => {
    expect(AI_SELECTABLE_QUESTION_TYPES).toEqual([
      QuestionType.MCQ,
      QuestionType.TRUE_FALSE,
      QuestionType.SHORT_ANSWER,
      QuestionType.MATCHING,
      QuestionType.MULTIPLE_SELECT,
      QuestionType.DRAG_DROP,
      QuestionType.ORDERING,
      QuestionType.IMAGE_QUESTION,
      QuestionType.DROPDOWN,
      QuestionType.UNDERLINE,
      QuestionType.CATEGORIZATION,
      QuestionType.WORD_SCRAMBLE,
      QuestionType.RIDDLE,
    ]);
  });

  it('keeps manual and legacy types outside the AI contract', () => {
    expect(MANUAL_ONLY_QUESTION_TYPES).toEqual([QuestionType.ERROR_CORRECTION]);
    expect(EXPERIMENTAL_LEGACY_QUESTION_TYPES).toEqual([QuestionType.GEOMETRY]);
    expect(getQuestionTypeAvailability(QuestionType.ERROR_CORRECTION)).toBe('manualOnly');
    expect(getQuestionTypeAvailability(QuestionType.GEOMETRY)).toBe('experimentalLegacy');
  });
});

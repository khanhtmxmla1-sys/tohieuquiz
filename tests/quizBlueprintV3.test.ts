import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import {
  buildQuestionBlueprintSlots,
  validateQuizBlueprintV3,
  type QuizBlueprintV3,
} from '../src/features/quiz-generator/domain/quizBlueprint';

const inputForTenQuestions = {
  totalQuestions: 10,
  typeAllocations: [
    { type: QuestionType.MCQ, count: 4 },
    { type: QuestionType.TRUE_FALSE, count: 2 },
    { type: QuestionType.SHORT_ANSWER, count: 2 },
    { type: QuestionType.MATCHING, count: 2 },
  ],
  difficultyLevels: { level1: 3, level2: 5, level3: 2 },
  objective: 'Phân số lớp 4',
  subject: 'math' as const,
  skillCode: 'phan_so',
};

const countBy = <T extends string | number>(values: T[]): Record<string, number> => values.reduce(
  (result, value) => {
    const key = String(value);
    result[key] = (result[key] ?? 0) + 1;
    return result;
  },
  {} as Record<string, number>,
);

describe('quiz blueprint V3 slots', () => {
  it('creates one unique ordered slot for each requested question', () => {
    const slots = buildQuestionBlueprintSlots(inputForTenQuestions);

    expect(slots).toHaveLength(10);
    expect(slots.map((slot) => slot.slotId)).toEqual([
      'slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5',
      'slot-6', 'slot-7', 'slot-8', 'slot-9', 'slot-10',
    ]);
    expect(slots.map((slot) => slot.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(slots.map((slot) => slot.slotId)).size).toBe(10);
  });

  it('matches exact type and difficulty totals deterministically', () => {
    const first = buildQuestionBlueprintSlots(inputForTenQuestions);
    const second = buildQuestionBlueprintSlots(inputForTenQuestions);

    expect(first).toEqual(second);
    expect(countBy(first.map((slot) => slot.type))).toEqual({
      MCQ: 4,
      TRUE_FALSE: 2,
      SHORT_ANSWER: 2,
      MATCHING: 2,
    });
    expect(countBy(first.map((slot) => slot.difficulty))).toEqual({ 1: 3, 2: 5, 3: 2 });
    expect(first.every((slot) => slot.subject === 'math' && slot.skillCode === 'phan_so')).toBe(true);
  });

  it('requires an image for image-question slots', () => {
    const slots = buildQuestionBlueprintSlots({
      totalQuestions: 1,
      typeAllocations: [{ type: QuestionType.IMAGE_QUESTION, count: 1 }],
      difficultyLevels: { level1: 1, level2: 0, level3: 0 },
      objective: 'Nhận biết hình vuông',
    });

    expect(slots[0].imagePolicy).toBe('required');
  });

  it('rejects manual-only and legacy types', () => {
    expect(() => buildQuestionBlueprintSlots({
      totalQuestions: 1,
      typeAllocations: [{ type: QuestionType.ERROR_CORRECTION, count: 1 }],
      difficultyLevels: { level1: 1, level2: 0, level3: 0 },
      objective: 'Sửa lỗi',
    })).toThrow('không thuộc 13 dạng AI');
  });

  it('validates slot identity, totals and immutable fields', () => {
    const slots = buildQuestionBlueprintSlots(inputForTenQuestions);
    const blueprint: QuizBlueprintV3 = {
      version: 3,
      intent: 'PRACTICE',
      sourceMode: 'TOPIC',
      topic: 'Phân số',
      classLevel: '4',
      totalQuestions: 10,
      slots,
    };

    expect(validateQuizBlueprintV3(blueprint)).toEqual([]);
    expect(validateQuizBlueprintV3({
      ...blueprint,
      slots: slots.map((slot, index) => index === 1 ? { ...slot, slotId: 'slot-1' } : slot),
    })).toContain('Mỗi slot phải có một slotId duy nhất.');
    expect(validateQuizBlueprintV3({
      ...blueprint,
      slots: slots.map((slot, index) => index === 0 ? { ...slot, difficulty: 4 as 1 } : slot),
    })).toContain('Độ khó của slot chỉ được là 1, 2 hoặc 3.');
  });
});

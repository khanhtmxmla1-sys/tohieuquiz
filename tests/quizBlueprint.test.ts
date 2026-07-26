import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import {
  buildBalancedTypeAllocations,
  validateQuizBlueprint,
  type QuizBlueprint,
} from '../src/features/quiz-generator/domain/quizBlueprint';

describe('quiz blueprint', () => {
  it('distributes ten questions across four types without changing the total', () => {
    const result = buildBalancedTypeAllocations([
      QuestionType.MCQ,
      QuestionType.TRUE_FALSE,
      QuestionType.SHORT_ANSWER,
      QuestionType.MATCHING,
    ], 10);

    expect(result.map((item) => item.count)).toEqual([3, 3, 2, 2]);
    expect(result.reduce((sum, item) => sum + item.count, 0)).toBe(10);
  });

  it('preserves the first occurrence order and removes duplicate types', () => {
    expect(buildBalancedTypeAllocations([
      QuestionType.MCQ,
      QuestionType.TRUE_FALSE,
      QuestionType.MCQ,
    ], 5)).toEqual([
      { type: QuestionType.MCQ, count: 3 },
      { type: QuestionType.TRUE_FALSE, count: 2 },
    ]);
  });

  it('rejects mismatched type and difficulty totals', () => {
    const blueprint: QuizBlueprint = {
      intent: 'EXAM',
      sourceMode: 'TOPIC',
      totalQuestions: 10,
      typeAllocations: [{ type: QuestionType.MCQ, count: 9 }],
      difficultyLevels: { level1: 3, level2: 5, level3: 2 },
    };

    expect(validateQuizBlueprint(blueprint)).toContain('Tổng số câu theo dạng phải bằng 10.');
  });

  it('rejects totals outside the supported range', () => {
    const blueprint: QuizBlueprint = {
      intent: 'PRACTICE',
      sourceMode: 'DOCUMENT',
      totalQuestions: 41,
      typeAllocations: [{ type: QuestionType.MCQ, count: 41 }],
      difficultyLevels: { level1: 10, level2: 20, level3: 11 },
    };

    expect(validateQuizBlueprint(blueprint)).toContain('Tổng số câu phải từ 1 đến 40.');
  });
});

import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import {
  MCQ_CONTRACT,
  MULTIPLE_SELECT_CONTRACT,
  TRUE_FALSE_CONTRACT,
} from '../src/services/ai/question-contracts/choiceQuestionContracts';

const slotFor = (type: QuestionType.MCQ | QuestionType.TRUE_FALSE | QuestionType.MULTIPLE_SELECT) => ({
  slotId: 'slot-1',
  ordinal: 1,
  type,
  difficulty: 2 as const,
  objective: 'Kiểm tra kiến thức',
  imagePolicy: 'optional' as const,
});

describe('choice question contracts', () => {
  it('accepts every valid fixture', () => {
    for (const contract of [MCQ_CONTRACT, TRUE_FALSE_CONTRACT, MULTIPLE_SELECT_CONTRACT]) {
      expect(contract.schema.safeParse(contract.validFixture).success, contract.type).toBe(true);
    }
  });

  it('rejects MCQ options containing answer prefixes', () => {
    const result = MCQ_CONTRACT.schema.safeParse({
      ...MCQ_CONTRACT.validFixture,
      options: ['A. 2', '3', '4', '5'],
    });
    expect(result.success).toBe(false);
  });

  it('requires at least one true and one false statement', () => {
    const question = {
      ...TRUE_FALSE_CONTRACT.validFixture,
      items: TRUE_FALSE_CONTRACT.validFixture.items.map((item) => ({ ...item, isCorrect: true })),
    };
    const issues = TRUE_FALSE_CONTRACT.validateSemantics(question, slotFor(QuestionType.TRUE_FALSE));
    expect(issues.some((issue) => issue.code === 'TRUE_FALSE_BALANCE_REQUIRED')).toBe(true);
  });

  it('requires two or three unique multiple-select answers', () => {
    expect(MULTIPLE_SELECT_CONTRACT.schema.safeParse({
      ...MULTIPLE_SELECT_CONTRACT.validFixture,
      correctAnswers: ['A'],
    }).success).toBe(false);
    expect(MULTIPLE_SELECT_CONTRACT.schema.safeParse({
      ...MULTIPLE_SELECT_CONTRACT.validFixture,
      correctAnswers: ['A', 'A'],
    }).success).toBe(false);
  });
});

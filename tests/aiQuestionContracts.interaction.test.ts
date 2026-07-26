import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import {
  CATEGORIZATION_CONTRACT,
  MATCHING_CONTRACT,
  ORDERING_CONTRACT,
} from '../src/services/ai/question-contracts/interactionQuestionContracts';

const slotFor = (type: QuestionType.MATCHING | QuestionType.ORDERING | QuestionType.CATEGORIZATION) => ({
  slotId: 'slot-1',
  ordinal: 1,
  type,
  difficulty: 2 as const,
  objective: 'Tương tác với dữ liệu',
  imagePolicy: 'optional' as const,
});

describe('interaction question contracts', () => {
  it('rejects duplicate matching sides', () => {
    expect(MATCHING_CONTRACT.schema.safeParse({
      ...MATCHING_CONTRACT.validFixture,
      pairs: [
        { left: '1 + 1', right: '2' },
        { left: '1 + 1', right: '3' },
        { left: '2 + 2', right: '4' },
      ],
    }).success).toBe(false);
  });

  it('requires ordering to use a full zero-based permutation', () => {
    expect(ORDERING_CONTRACT.schema.safeParse({
      ...ORDERING_CONTRACT.validFixture,
      correctOrder: [0, 0, 2],
    }).success).toBe(false);
  });

  it('requires every category to receive at least one item', () => {
    const question = {
      ...CATEGORIZATION_CONTRACT.validFixture,
      categories: [{ id: 'chan', name: 'Số chẵn' }, { id: 'le', name: 'Số lẻ' }],
      items: [
        { id: 'i-1', content: '2', categoryId: 'chan' },
        { id: 'i-2', content: '4', categoryId: 'chan' },
        { id: 'i-3', content: '6', categoryId: 'chan' },
        { id: 'i-4', content: '8', categoryId: 'chan' },
      ],
    };
    const issues = CATEGORIZATION_CONTRACT.validateSemantics(
      question,
      slotFor(QuestionType.CATEGORIZATION),
    );
    expect(issues.some((issue) => issue.code === 'CATEGORIZATION_EMPTY_GROUP')).toBe(true);
  });
});

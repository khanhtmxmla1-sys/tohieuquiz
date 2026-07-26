import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import { AI_SELECTABLE_QUESTION_TYPES } from '../src/services/ai/question-contracts/questionTypeAvailability';
import {
  AI_QUESTION_CONTRACTS,
  AI_QUESTION_TYPE_DESCRIPTORS,
  getAiQuestionContract,
  getSelectedContractPromptFragments,
} from '../src/services/ai/question-contracts/questionContractRegistry';

describe('AI question contract registry', () => {
  it('contains one complete contract for every AI-selectable type', () => {
    expect([...AI_QUESTION_CONTRACTS.keys()]).toEqual(AI_SELECTABLE_QUESTION_TYPES);
    expect(AI_QUESTION_TYPE_DESCRIPTORS).toHaveLength(13);

    for (const type of AI_SELECTABLE_QUESTION_TYPES) {
      const contract = getAiQuestionContract(type);
      expect(contract.schema.safeParse(contract.validFixture).success, type).toBe(true);
      expect(contract.promptFragment({
        classLevel: '4',
        intent: 'PRACTICE',
        sourceMode: 'TOPIC',
        hasImageLibrary: true,
      })).toContain(`[CONTRACT: ${type}]`);
    }
  });

  it('rejects manual-only and experimental types', () => {
    expect(() => getAiQuestionContract(QuestionType.ERROR_CORRECTION)).toThrow();
    expect(() => getAiQuestionContract(QuestionType.GEOMETRY)).toThrow();
  });

  it('returns only selected prompt fragments and removes duplicate types', () => {
    const fragments = getSelectedContractPromptFragments([
      QuestionType.MCQ,
      QuestionType.MATCHING,
      QuestionType.MCQ,
    ], {
      classLevel: '4',
      intent: 'EXAM',
      sourceMode: 'TOPIC',
      hasImageLibrary: false,
    });
    expect(fragments).toHaveLength(2);
    expect(fragments.join('\n')).toContain('[CONTRACT: MCQ]');
    expect(fragments.join('\n')).toContain('[CONTRACT: MATCHING]');
    expect(fragments.join('\n')).not.toContain('[CONTRACT: RIDDLE]');
  });

  it('rejects placeholder images in the final image contract', () => {
    const contract = getAiQuestionContract(QuestionType.IMAGE_QUESTION);
    const issues = contract.validateSemantics({
      ...contract.validFixture,
      image: 'https://placehold.co/600x400',
    }, {
      slotId: 'slot-1',
      ordinal: 1,
      type: QuestionType.IMAGE_QUESTION,
      difficulty: 2,
      objective: 'Quan sát hình',
      imagePolicy: 'required',
    });
    expect(issues.some((issue) => issue.code === 'IMAGE_PLACEHOLDER_FORBIDDEN')).toBe(true);
  });
});

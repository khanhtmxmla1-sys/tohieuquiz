import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import {
  buildQuizSlotRepairPrompt,
  createQuizSlotRepairPlan,
  mergeRepairedSlots,
} from '../src/services/ai/quizRepair';
import type {
  GeneratedQuestionV3,
  GeneratedQuizV3,
} from '../src/services/ai/question-contracts/questionContract.types';
import { getAiQuestionContract } from '../src/services/ai/question-contracts/questionContractRegistry';
import type {
  QuizSlotAuditCode,
  QuizSlotAuditIssue,
} from '../src/services/ai/quizAudit';
import {
  makeBlueprintV3Fixture,
  makeGeneratedQuizV3Fixture,
} from './helpers/aiBlueprintV3Fixtures';

const makeIssue = (
  code: QuizSlotAuditCode,
  slotIds: string[],
): QuizSlotAuditIssue => ({
  code,
  slotIds,
  message: `${code}: ${slotIds.join(', ')}`,
  repairable: true,
});

const blueprint = makeBlueprintV3Fixture();
const original = makeGeneratedQuizV3Fixture(blueprint);
const replacementSlot = blueprint.slots.find((slot) => slot.slotId === 'slot-3')!;
const repaired: GeneratedQuizV3 = {
  promptVersion: 'ai-blueprint-v3',
  blueprintVersion: 3,
  title: 'Phần sửa',
  questions: [{
    ...getAiQuestionContract(replacementSlot.type).validFixture,
    slotId: replacementSlot.slotId,
    type: replacementSlot.type,
    difficulty: replacementSlot.difficulty,
    explanation: 'Lời giải thay thế hợp lệ.',
  }] as GeneratedQuestionV3[],
};

describe('V3 targeted slot repair', () => {
  it('requests only unique failing slot ids in blueprint order', () => {
    const plan = createQuizSlotRepairPlan([
      makeIssue('SLOT_TYPE_MISMATCH', ['slot-3']),
      makeIssue('MISSING_SLOT', ['slot-1']),
      makeIssue('MATH_FORMAT_INVALID', ['slot-3']),
    ], blueprint);

    expect(plan).toEqual({ slotIds: ['slot-1', 'slot-3'], requestedCount: 2 });
  });

  it('builds a prompt containing only failing slot contracts', () => {
    const issues = [makeIssue('SLOT_TYPE_MISMATCH', ['slot-3'])];
    const prompt = buildQuizSlotRepairPrompt({ blueprint, quiz: original, issues });

    expect(prompt).toContain('"slotId":"slot-3"');
    expect(prompt).toContain(`[CONTRACT: ${replacementSlot.type}]`);
    expect(prompt).not.toContain('"slotId":"slot-1","type"');
    expect(prompt).not.toContain(JSON.stringify(original.questions));
  });

  it('merges by slot id and preserves valid object references', () => {
    const merged = mergeRepairedSlots(
      original,
      repaired,
      { slotIds: ['slot-3'], requestedCount: 1 },
      blueprint,
    );

    expect(merged.questions.find((question) => question.slotId === 'slot-1')).toBe(
      original.questions.find((question) => question.slotId === 'slot-1'),
    );
    expect(merged.questions.find((question) => question.slotId === 'slot-3')).toBe(
      repaired.questions[0],
    );
    expect(merged.questions.map((question) => question.slotId)).toEqual(
      blueprint.slots.map((slot) => slot.slotId),
    );
  });

  it('rejects missing, extra or immutable-field-changing repaired slots', () => {
    expect(() => mergeRepairedSlots(
      original,
      { ...repaired, questions: [] },
      { slotIds: ['slot-3'], requestedCount: 1 },
      blueprint,
    )).toThrow('Thiếu slot sửa');

    expect(() => mergeRepairedSlots(
      original,
      { ...repaired, questions: [...repaired.questions, original.questions[0]] },
      { slotIds: ['slot-3'], requestedCount: 1 },
      blueprint,
    )).toThrow('slot không được yêu cầu');

    expect(() => mergeRepairedSlots(
      original,
      {
        ...repaired,
        questions: [{ ...repaired.questions[0], type: QuestionType.MCQ }],
      },
      { slotIds: ['slot-3'], requestedCount: 1 },
      blueprint,
    )).toThrow('không khớp type hoặc difficulty');
  });
});

import { QuestionType } from '../../src/types';
import {
  buildQuestionBlueprintSlots,
  type QuizBlueprintV3,
} from '../../src/features/quiz-generator/domain/quizBlueprint';
import type {
  GeneratedQuestionV3,
  GeneratedQuizV3,
} from '../../src/services/ai/question-contracts/questionContract.types';
import { getAiQuestionContract } from '../../src/services/ai/question-contracts/questionContractRegistry';

export const makeBlueprintV3Fixture = (
  overrides: Partial<QuizBlueprintV3> = {},
): QuizBlueprintV3 => {
  const slots = buildQuestionBlueprintSlots({
    totalQuestions: 4,
    typeAllocations: [
      { type: QuestionType.MCQ, count: 2 },
      { type: QuestionType.MATCHING, count: 1 },
      { type: QuestionType.SHORT_ANSWER, count: 1 },
    ],
    difficultyLevels: { level1: 1, level2: 2, level3: 1 },
    objective: 'Phân số lớp 4',
    subject: 'math',
    skillCode: 'phan_so',
  });

  return {
    version: 3,
    intent: 'PRACTICE',
    sourceMode: 'TOPIC',
    topic: 'Phân số',
    classLevel: '4',
    totalQuestions: slots.length,
    slots,
    ...overrides,
  };
};

export const makeGeneratedQuizV3Fixture = (
  blueprint: QuizBlueprintV3 = makeBlueprintV3Fixture(),
): GeneratedQuizV3 => ({
  promptVersion: 'ai-blueprint-v3',
  blueprintVersion: 3,
  title: 'Đề fixture V3',
  questions: blueprint.slots.map((slot) => {
    const fixture = { ...getAiQuestionContract(slot.type).validFixture } as Record<string, unknown>;
    const variantLabel = String.fromCharCode(64 + slot.ordinal);
    if (typeof fixture.question === 'string') {
      fixture.question = `${fixture.question} (biến thể ${variantLabel})`;
    } else if (typeof fixture.mainQuestion === 'string') {
      fixture.mainQuestion = `${fixture.mainQuestion} (biến thể ${variantLabel})`;
    }
    return {
      ...fixture,
      slotId: slot.slotId,
      type: slot.type,
      difficulty: slot.difficulty,
      explanation: `Lời giải fixture hợp lệ cho slot ${slot.ordinal}.`,
      subject: slot.subject,
      skillCode: slot.skillCode,
      subskillCode: slot.subskillCode,
    } as GeneratedQuestionV3;
  }),
});

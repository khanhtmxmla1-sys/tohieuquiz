import { describe, expect, it } from 'vitest';
import { QuestionType } from '../src/types';
import { validateAndFixQuiz } from '../src/services/ai/utils/jsonRepair';
import { normalizeGeneratedQuizV3Compatibility } from '../src/services/ai/schemas/generatedQuizV3Normalizer';
import { mapGeneratedQuizV3ToDomain } from '../src/services/ai/quizDomainAdapter';
import { getAiQuestionContract } from '../src/services/ai/question-contracts/questionContractRegistry';
import type { GeneratedQuestionV3 } from '../src/services/ai/question-contracts/questionContract.types';

const legacyExplanation = 'Lời giải do nhà cung cấp tự trả về.';

describe('AI generated explanation policy', () => {
  it('strips explanation from normalized V2 provider output', () => {
    const normalized = validateAndFixQuiz({
      title: 'Đề V2',
      questions: [{
        type: QuestionType.MCQ,
        question: '1 + 1 = ?',
        options: ['1', '2'],
        correctAnswer: 'B',
        difficultyLevel: 1,
        explanation: legacyExplanation,
      }],
    }) as { questions: Array<Record<string, unknown>> };

    expect(normalized.questions[0]).not.toHaveProperty('explanation');
  });

  it('strips explanation from normalized V3 provider output', () => {
    const normalized = normalizeGeneratedQuizV3Compatibility({
      promptVersion: 'ai-blueprint-v3',
      blueprintVersion: 3,
      title: 'Đề V3',
      questions: [{
        ...getAiQuestionContract(QuestionType.MCQ).validFixture,
        slotId: 'slot-1',
        type: QuestionType.MCQ,
        difficulty: 1,
        explanation: legacyExplanation,
      }],
    }, {
      allowV2DifficultyAlias: true,
      expectedPromptVersion: 'ai-blueprint-v3',
    }) as { questions: Array<Record<string, unknown>> };

    expect(normalized.questions[0]).not.toHaveProperty('explanation');
  });

  it('does not leak explanation through V3 domain mapping', () => {
    const question = {
      ...getAiQuestionContract(QuestionType.MCQ).validFixture,
      slotId: 'slot-1',
      type: QuestionType.MCQ,
      difficulty: 1,
      explanation: legacyExplanation,
    } as GeneratedQuestionV3;

    const mapped = mapGeneratedQuizV3ToDomain({
      promptVersion: 'ai-blueprint-v3',
      blueprintVersion: 3,
      title: 'Đề V3',
      questions: [question],
    });

    expect(mapped.questions[0]).not.toHaveProperty('explanation');
  });
});

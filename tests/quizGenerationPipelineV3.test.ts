import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionType } from '../src/types';
import type { QuizGenerationOptions } from '../src/services/geminiService';
import type {
  GeneratedQuestionV3,
  GeneratedQuizV3,
} from '../src/services/ai/question-contracts/questionContract.types';
import { getAiQuestionContract } from '../src/services/ai/question-contracts/questionContractRegistry';
import { buildQuestionBlueprintSlots } from '../src/features/quiz-generator/domain/quizBlueprint';
import {
  makeBlueprintV3Fixture,
  makeGeneratedQuizV3Fixture,
} from './helpers/aiBlueprintV3Fixtures';

const mocks = vi.hoisted(() => ({
  generateWithOpenAIResilient: vi.fn(),
  generateWithGemini: vi.fn(),
  generateWithPerplexity: vi.fn(),
  requestWorkerAiText: vi.fn(),
}));

vi.mock('../src/services/ai/providers/openaiProvider', () => ({
  generateWithOpenAIResilient: mocks.generateWithOpenAIResilient,
}));
vi.mock('../src/services/ai/providers/geminiProvider', () => ({
  generateWithGemini: mocks.generateWithGemini,
}));
vi.mock('../src/services/ai/providers/perplexityProvider', () => ({
  generateWithPerplexity: mocks.generateWithPerplexity,
}));
vi.mock('../src/services/ai/workerAiClient', () => ({
  requestWorkerAiText: mocks.requestWorkerAiText,
}));
vi.mock('../src/services/imageGenerationService', () => ({
  generateImage: vi.fn(),
  checkImageServiceAvailability: vi.fn().mockResolvedValue(false),
}));

import { generateQuiz } from '../src/services/geminiService';

const blueprint = makeBlueprintV3Fixture();
const validQuiz = makeGeneratedQuizV3Fixture(blueprint);
const slot3 = blueprint.slots.find((slot) => slot.slotId === 'slot-3')!;
const wrongType = slot3.type === QuestionType.MCQ ? QuestionType.MATCHING : QuestionType.MCQ;

const options: QuizGenerationOptions = {
  title: 'Đề V3',
  questionCount: blueprint.totalQuestions,
  questionTypes: [...new Set(blueprint.slots.map((slot) => slot.type))],
  difficultyLevels: {
    level1: blueprint.slots.filter((slot) => slot.difficulty === 1).length,
    level2: blueprint.slots.filter((slot) => slot.difficulty === 2).length,
    level3: blueprint.slots.filter((slot) => slot.difficulty === 3).length,
  },
  promptVersion: 'ai-blueprint-v3',
  blueprintV3: blueprint,
};

const execution = {
  action: { actionId: 'ai-v3-1234567890abcdef', workflow: 'QUIZ_CREATE' as const },
  stage: 'GENERATE' as const,
};

const quizWithOneWrongSlot: GeneratedQuizV3 = {
  ...validQuiz,
  questions: validQuiz.questions.map((question) => question.slotId !== slot3.slotId
    ? question
    : ({
      ...getAiQuestionContract(wrongType).validFixture,
      slotId: slot3.slotId,
      type: wrongType,
      difficulty: slot3.difficulty,
      explanation: 'Câu cố ý sai type.',
      subject: slot3.subject,
      skillCode: slot3.skillCode,
    } as GeneratedQuestionV3)),
};

const invalidReviewerQuiz: GeneratedQuizV3 = {
  ...validQuiz,
  questions: validQuiz.questions.map((question, index) => index === 0
    ? ({ ...question, type: wrongType } as GeneratedQuestionV3)
    : question),
};

describe('quiz generation V3 quality pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateWithOpenAIResilient.mockResolvedValue(quizWithOneWrongSlot);
    mocks.requestWorkerAiText.mockImplementation(async (_body, requestOptions) => {
      const stage = requestOptions?.action?.stage;
      if (stage === 'REPAIR') {
        return JSON.stringify({
          promptVersion: 'ai-blueprint-v3',
          blueprintVersion: 3,
          title: 'Phần sửa',
          questions: [validQuiz.questions.find((question) => question.slotId === slot3.slotId)],
        });
      }
      if (stage === 'REVIEW') return JSON.stringify(invalidReviewerQuiz);
      throw new Error(`Unexpected stage ${String(stage)}`);
    });
  });

  it('repairs one wrong slot, ignores an invalid reviewer and maps to domain', async () => {
    const result = await generateQuiz(
      blueprint.topic,
      blueprint.classLevel,
      '',
      undefined,
      options,
      undefined,
      'openai',
      undefined,
      execution,
    );

    const repairCalls = mocks.requestWorkerAiText.mock.calls.filter(
      (call) => call[1]?.action?.stage === 'REPAIR',
    );
    expect(repairCalls).toHaveLength(1);
    expect(repairCalls[0][0].messages[1].content).toContain('slot-3');
    expect(mocks.requestWorkerAiText.mock.calls.map((call) => call[1]?.action?.stage)).toEqual([
      'REPAIR',
      'REVIEW',
    ]);
    expect(result.questions).toHaveLength(blueprint.slots.length);
    expect(result.questions[0].type).toBe(validQuiz.questions[0].type);
    expect(result.questions[0].id).toBe('slot-1');
    expect(result.questions[0].difficulty).toBe(blueprint.slots[0].difficulty);
    expect(result.questions[0].skillCode).toBe('phan_so');
    expect((result.questions[0] as any).slotId).toBeUndefined();
  });

  it('passes the capability-aware V3 system instruction to the provider', async () => {
    await generateQuiz(
      blueprint.topic,
      blueprint.classLevel,
      '',
      undefined,
      options,
      undefined,
      'openai',
      undefined,
      execution,
    );

    expect(mocks.generateWithOpenAIResilient.mock.calls[0][7]).toContain('[SYSTEM ai-blueprint-v3]');
  });

  it('does not use repair or review for a valid single-question regeneration', async () => {
    const slots = buildQuestionBlueprintSlots({
      totalQuestions: 1,
      typeAllocations: [{ type: QuestionType.MATCHING, count: 1 }],
      difficultyLevels: { level1: 0, level2: 1, level3: 0 },
      objective: 'Nối phân số với cách đọc',
      subject: 'math',
      skillCode: 'phan_so',
    });
    const singleBlueprint = makeBlueprintV3Fixture({
      totalQuestions: 1,
      slots,
    });
    const singleQuiz = makeGeneratedQuizV3Fixture(singleBlueprint);
    mocks.generateWithOpenAIResilient.mockResolvedValue(singleQuiz);

    const result = await generateQuiz(
      singleBlueprint.topic,
      singleBlueprint.classLevel,
      '',
      undefined,
      {
        title: 'Sinh lại một câu',
        questionCount: 1,
        questionTypes: [QuestionType.MATCHING],
        difficultyLevels: { level1: 0, level2: 1, level3: 0 },
        promptVersion: 'ai-blueprint-v3',
        blueprintV3: singleBlueprint,
      },
      undefined,
      'openai',
      undefined,
      {
        action: { actionId: 'ai-v3-regenerate-123456', workflow: 'QUESTION_REGENERATE' },
        stage: 'REGENERATE',
      },
    );

    expect(result.questions).toHaveLength(1);
    expect(mocks.requestWorkerAiText).not.toHaveBeenCalled();
  });
});

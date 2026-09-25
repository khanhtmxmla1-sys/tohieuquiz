import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizGenerationOptions } from '../src/services/geminiService';
import type { GeneratedQuestionV3, GeneratedQuizV3 } from '../src/services/ai/question-contracts/questionContract.types';
import { getAiQuestionContract } from '../src/services/ai/question-contracts/questionContractRegistry';
import { QuestionType } from '../src/types';
import { makeBlueprintV3Fixture, makeGeneratedQuizV3Fixture } from './helpers/aiBlueprintV3Fixtures';

const mocks = vi.hoisted(() => ({
  generateWithOpenAIResilient: vi.fn(),
  generateWithGemini: vi.fn(),
  generateWithPerplexity: vi.fn(),
  requestWorkerAiText: vi.fn(),
  generateImage: vi.fn(),
  checkImageServiceAvailability: vi.fn(),
  showError: vi.fn(),
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
  generateImage: mocks.generateImage,
  checkImageServiceAvailability: mocks.checkImageServiceAvailability,
}));

const quotaState = vi.hoisted(() => ({ hasAiQuota: true }));

vi.mock('../src/features/quiz-generator/hooks/useTeacherAiQuota', () => ({
  useTeacherAiQuota: () => ({
    aiUsageCount: 0,
    aiUsageRemaining: quotaState.hasAiQuota ? 5 : 0,
    hasAiQuota: quotaState.hasAiQuota,
    dailyAiLimit: 5,
    refresh: vi.fn(async () => undefined),
  }),
}));

vi.mock('../src/utils/toast', () => ({
  showError: mocks.showError,
}));

import { generateQuiz } from '../src/services/geminiService';
import { useQuizGeneration } from '../src/features/quiz-generator/hooks/useQuizGeneration';

const blueprint = makeBlueprintV3Fixture();
const validQuiz = makeGeneratedQuizV3Fixture(blueprint);
const slot3 = blueprint.slots.find((slot) => slot.slotId === 'slot-3')!;
const wrongType = slot3.type === QuestionType.MCQ ? QuestionType.MATCHING : QuestionType.MCQ;

const invalidDraft: GeneratedQuizV3 = {
  ...validQuiz,
  questions: validQuiz.questions.map((question) => question.slotId !== slot3.slotId
    ? question
    : ({
      ...getAiQuestionContract(wrongType).validFixture,
      slotId: slot3.slotId,
      type: wrongType,
      difficulty: slot3.difficulty,
      diagramPolicy: slot3.diagramPolicy,
      explanation: 'Câu cần sửa.',
      subject: slot3.subject,
      skillCode: slot3.skillCode,
    } as GeneratedQuestionV3)),
};

const options: QuizGenerationOptions = {
  title: 'Đề BYOK',
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

beforeEach(() => {
  vi.clearAllMocks();
  quotaState.hasAiQuota = true;
  mocks.generateWithGemini.mockResolvedValue(invalidDraft);
  mocks.generateWithOpenAIResilient.mockResolvedValue(validQuiz);
  mocks.checkImageServiceAvailability.mockResolvedValue(false);
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
    if (stage === 'REVIEW') return JSON.stringify(validQuiz);
    throw new Error(`Unexpected stage ${String(stage)}`);
  });
});

describe('personal AI quiz generation source binding', () => {
  it('keeps Gemini personal source across generate, repair and review', async () => {
    await generateQuiz(
      blueprint.topic,
      blueprint.classLevel,
      '',
      undefined,
      options,
      undefined,
      'gemini-personal',
      undefined,
      {
        action: {
          actionId: 'ai-byok-gemini-1234567890',
          workflow: 'QUIZ_CREATE',
          source: 'gemini-personal',
        },
        stage: 'GENERATE',
      },
    );

    expect(mocks.generateWithGemini).toHaveBeenCalledOnce();
    expect(mocks.generateWithGemini.mock.calls[0][5]).toMatchObject({
      action: { source: 'gemini-personal' },
      stage: 'GENERATE',
    });
    expect(mocks.requestWorkerAiText.mock.calls.map((call) => ({
      stage: call[1]?.action?.stage,
      source: call[1]?.source,
    }))).toEqual([
      { stage: 'REPAIR', source: 'gemini-personal' },
      { stage: 'REVIEW', source: 'gemini-personal' },
    ]);
  });

  it('uses the OpenAI-compatible text pipeline for DeepSeek personal without falling back to images', async () => {
    await generateQuiz(
      blueprint.topic,
      blueprint.classLevel,
      '',
      undefined,
      options,
      undefined,
      'deepseek-personal',
      undefined,
      {
        action: {
          actionId: 'ai-byok-deepseek-123456789',
          workflow: 'QUESTION_REGENERATE',
          source: 'deepseek-personal',
        },
        stage: 'REGENERATE',
      },
    );

    expect(mocks.generateWithOpenAIResilient).toHaveBeenCalledOnce();
    expect(mocks.generateWithOpenAIResilient.mock.calls[0][6]).toMatchObject({
      action: { source: 'deepseek-personal' },
      stage: 'REGENERATE',
    });
    expect(mocks.generateImage).not.toHaveBeenCalled();
    expect(mocks.checkImageServiceAvailability).not.toHaveBeenCalled();
  });
});

const makeCredentials = (overrides: Record<string, unknown> = {}) => ({
  enabled: true,
  capabilities: { text: true, documents: false, images: false, ocr: false, webSearch: false, imageGeneration: false },
  summaries: {
    gemini: { provider: 'gemini', configured: true, last4: '1234', version: 1, verifiedAt: null, updatedAt: null },
    deepseek: { provider: 'deepseek', configured: true, last4: '5678', version: 1, verifiedAt: null, updatedAt: null },
  },
  loading: false, error: null, save: vi.fn(), test: vi.fn(), remove: vi.fn(), refetch: vi.fn(),
  ...overrides,
});

const makeGuardForm = () => ({
  quizMode: 'exam', setQuizMode: vi.fn(), quizIntent: 'EXAM', setQuizIntent: vi.fn(),
  uploadedFile: null as File | null, topic: 'Phân số', classLevel: '4',
  selectedTypes: { [QuestionType.MCQ]: true },
  questionTypeAllocations: [{ type: QuestionType.MCQ, count: 1 }],
  difficultyLevels: { level1: 1, level2: 0, level3: 0 },
  category: 'toan', content: 'Nội dung', aiProvider: 'gemini-personal', imageLibrary: [] as any[],
  quizTitle: 'Đề', promptProfile: { useThongTu27: true, learnerMode: 'default' }, customPrompt: '',
  manualTimeLimit: 15, requireCode: false, accessCode: '', showOnHome: false, tags: [] as string[],
  autoGenerateSvg: false, ocrDocument: null, selectedOcrPageNumbers: [] as number[],
  clearOcrDocument: vi.fn(), applyOcrDocument: vi.fn(),
  setAiDetectedCategory: vi.fn(), setAiDetectedLesson: vi.fn(), setAiSuggestedTags: vi.fn(),
  setGeneratedQuiz: vi.fn(), generatedQuiz: null,
});

const runGuardedGenerate = async (form: ReturnType<typeof makeGuardForm>, credentials: any) => {
  const { result } = renderHook(() => useQuizGeneration({
    form: form as never, editingQuiz: null, isTeacherAccount: true, username: 'teacher-a', teacherName: 'Cô A',
    aiQuizV2Enabled: true, aiBlueprintV3Enabled: false, aiSvgDiagramsEnabled: false, aiCredentials: credentials,
  }));
  await act(async () => { await result.current.handleGenerate(); });
};

describe('personal AI generation guards', () => {
  it('blocks disabled feature, missing key, PDF, images and exhausted quota before any AI call', async () => {
    const scenarios: Array<{ form: any; credentials: any; quota: boolean; message: RegExp }> = [];
    scenarios.push({ form: makeGuardForm(), credentials: makeCredentials({ enabled: false }), quota: true, message: /chưa được bật/i });
    const missingKey = makeCredentials();
    missingKey.summaries.gemini = { ...missingKey.summaries.gemini, configured: false, version: 0, last4: null };
    scenarios.push({ form: makeGuardForm(), credentials: missingKey, quota: true, message: /chưa lưu API key Gemini/i });
    const pdfForm = makeGuardForm();
    pdfForm.quizMode = 'pdf';
    pdfForm.uploadedFile = new File(['pdf'], 'nguon.pdf', { type: 'application/pdf' });
    scenarios.push({ form: pdfForm, credentials: makeCredentials(), quota: true, message: /chưa hỗ trợ PDF/i });
    const imageForm = makeGuardForm();
    imageForm.selectedTypes = { [QuestionType.IMAGE_QUESTION]: true };
    scenarios.push({ form: imageForm, credentials: makeCredentials(), quota: true, message: /hình ảnh/i });
    const quotaForm = makeGuardForm();
    quotaForm.aiProvider = 'llm-mux';
    scenarios.push({ form: quotaForm, credentials: makeCredentials(), quota: false, message: /hạn mức/i });

    for (const scenario of scenarios) {
      vi.clearAllMocks();
      quotaState.hasAiQuota = scenario.quota;
      await runGuardedGenerate(scenario.form, scenario.credentials);
      expect(mocks.showError).toHaveBeenCalledWith(expect.stringMatching(scenario.message));
      expect(mocks.generateWithGemini).not.toHaveBeenCalled();
      expect(mocks.generateWithOpenAIResilient).not.toHaveBeenCalled();
      expect(mocks.requestWorkerAiText).not.toHaveBeenCalled();
    }
  });
});

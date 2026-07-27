/**
 * Public facade for AI-powered quiz generation.
 * Provider credentials remain server-side in Cloudflare Worker secrets.
 */

import { REVIEWER_INSTRUCTION } from '../config/constants';
import { generateImage, checkImageServiceAvailability } from './imageGenerationService';
import { QuestionType } from '../types';
import { parseAndRepairJSON, validateAndFixQuiz } from './ai/utils/jsonRepair';
import { buildPrompt } from './ai/prompts/quizPromptBuilder';
import { buildGeneratorSystemPrompt } from './ai/prompts/systemPromptBuilder';
import {
  buildReviewerSystemPromptV3,
  buildReviewerUserPromptV3,
} from './ai/prompts/reviewerPromptBuilder';
import { generateWithGemini } from './ai/providers/geminiProvider';
import { generateWithOpenAIResilient } from './ai/providers/openaiProvider';
import { generateWithPerplexity } from './ai/providers/perplexityProvider';
import { requestWorkerAiText } from './ai/workerAiClient';
import type { QuizAiExecutionContext } from './ai/aiAction';
import type {
  QuizBlueprint,
  QuizBlueprintV3,
} from '../features/quiz-generator/domain/quizBlueprint';
import {
  auditGeneratedQuiz,
  auditGeneratedQuizV3,
} from './ai/quizAudit';
import {
  buildQuizRepairPrompt,
  buildQuizSchemaRepairPrompt,
  buildQuizSlotRepairPrompt,
  createQuizRepairPlan,
  createQuizSlotRepairPlan,
  mergeRepairedQuestions,
  mergeRepairedSlots,
  QuizGenerationValidationError,
} from './ai/quizRepair';
import {
  GeneratedQuizSchema,
  parseGeneratedQuiz,
  parseGeneratedQuizV3,
  type GeneratedQuizPayload,
} from './ai/schemas/quizGenerationSchema';
import {
  GeneratedQuizSchemaError,
  toGeneratedQuizSchemaIssues,
} from './ai/quizGenerationErrors';
import { normalizeGeneratedQuizV3Compatibility } from './ai/schemas/generatedQuizV3Normalizer';
import type { GeneratedQuizV3 } from './ai/question-contracts/questionContract.types';
import { mapGeneratedQuizV3ToDomain } from './ai/quizDomainAdapter';

export type AIProvider = 'gemini' | 'perplexity' | 'openai' | 'llm-mux' | 'localhost' | 'native-ocr';
export type LearnerPromptMode = 'default' | 'gifted' | 'remedial';
export type QuizGenerationStep = 'generating' | 'reviewing' | 'repairing' | 'completed';

export interface PromptProfileOptions {
  useThongTu27: boolean;
  learnerMode: LearnerPromptMode;
}

export const AI_CORE_SUBJECT_IDS = [
  'toan',
  'tieng-viet',
  'tieng-anh',
  'tu-nhien-xa-hoi',
  'tin-hoc',
] as const;

export interface QuizGenerationOptions {
  title: string;
  blueprint?: QuizBlueprint;
  blueprintV3?: QuizBlueprintV3;
  promptVersion?: 'ai-blueprint-v3';
  questionCount: number;
  questionTypes: QuestionType[];
  difficultyLevels?: { level1: number; level2: number; level3: number };
  promptProfile?: PromptProfileOptions;
  imageLibrary?: Array<{ id: string; name: string; data?: string }>;
  customPrompt?: string;
  isPdfMode?: boolean;
}

const toWorkerOptions = (execution?: QuizAiExecutionContext) => execution ? {
  action: {
    ...execution.action,
    stage: execution.stage,
    ...(execution.diagnostics ?? {}),
  },
  signal: execution.signal,
} : undefined;

export const validateQuizWithAI = async (
  quizJson: unknown,
  _apiKey: string = '',
  execution?: QuizAiExecutionContext,
): Promise<unknown> => {
  try {
    const text = await requestWorkerAiText({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: REVIEWER_INSTRUCTION },
        {
          role: 'user',
          content: `Hãy soát lại và sửa JSON đề thi sau. Chỉ trả về JSON hợp lệ:\n${JSON.stringify(quizJson)}`,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }, toWorkerOptions(execution));
    return validateAndFixQuiz(parseAndRepairJSON(text));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown reviewer error';
    console.warn(`[AI Validation Chain] Reviewer unavailable; using validated draft. ${message}`);
    return validateAndFixQuiz(quizJson);
  }
};

const parseDraftWithOneSchemaRepair = async (
  result: unknown,
  execution: QuizAiExecutionContext | undefined,
  onStepChange?: (step: QuizGenerationStep) => void,
): Promise<GeneratedQuizPayload> => {
  const normalized = validateAndFixQuiz(result);
  const initial = GeneratedQuizSchema.safeParse(normalized);
  if (initial.success) return initial.data;

  const initialIssues = toGeneratedQuizSchemaIssues(initial.error.issues);
  if (execution?.action.workflow !== 'QUIZ_CREATE') {
    throw new GeneratedQuizSchemaError(initialIssues);
  }

  onStepChange?.('repairing');
  const repairedText = await requestWorkerAiText({
    model: 'gemini-2.5-flash',
    messages: [
      {
        role: 'system',
        content: 'Bạn sửa cấu trúc JSON đề thi. Chỉ trả về JSON object hợp lệ.',
      },
      {
        role: 'user',
        content: buildQuizSchemaRepairPrompt({ quiz: normalized, issues: initialIssues }),
      },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  }, toWorkerOptions({ ...execution, stage: 'REPAIR' }));

  const repairedRaw = validateAndFixQuiz(parseAndRepairJSON(repairedText));
  const repaired = GeneratedQuizSchema.safeParse(repairedRaw);
  if (!repaired.success) {
    throw new GeneratedQuizSchemaError(
      toGeneratedQuizSchemaIssues(repaired.error.issues),
    );
  }
  return repaired.data;
};

const runDeterministicQualityPipeline = async (
  result: unknown,
  blueprint: QuizBlueprint,
  execution: QuizAiExecutionContext | undefined,
  onStepChange?: (step: QuizGenerationStep) => void,
): Promise<GeneratedQuizPayload> => {
  const parsedDraft = await parseDraftWithOneSchemaRepair(
    result,
    execution,
    onStepChange,
  );
  let finalQuiz = parsedDraft;
  let issues = auditGeneratedQuiz(finalQuiz, blueprint);

  if (issues.some((issue) => !issue.repairable)) {
    throw new QuizGenerationValidationError(issues);
  }

  const canUseAuxiliaryStages = execution?.action.workflow === 'QUIZ_CREATE';
  if (issues.length > 0) {
    if (!canUseAuxiliaryStages) {
      throw new QuizGenerationValidationError(issues);
    }

    const repairInput = { blueprint, quiz: finalQuiz, issues };
    const repairPlan = createQuizRepairPlan(repairInput);
    let repairedQuiz: GeneratedQuizPayload;

    if (repairPlan.requestedCount > 0) {
      onStepChange?.('repairing');
      const repairedText = await requestWorkerAiText({
        model: 'gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Bạn sửa đúng các câu bị lỗi trong đề. Chỉ trả về JSON hợp lệ.',
          },
          {
            role: 'user',
            content: buildQuizRepairPrompt(repairInput),
          },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }, toWorkerOptions({ ...execution, stage: 'REPAIR' }));
      repairedQuiz = parseGeneratedQuiz(
        validateAndFixQuiz(parseAndRepairJSON(repairedText)),
      );
    } else {
      repairedQuiz = { ...finalQuiz, questions: [] };
    }

    finalQuiz = mergeRepairedQuestions(finalQuiz, repairedQuiz, issues);
    issues = auditGeneratedQuiz(finalQuiz, blueprint);
    if (issues.length > 0) {
      throw new QuizGenerationValidationError(issues);
    }
  }

  if (canUseAuxiliaryStages) {
    onStepChange?.('reviewing');
    try {
      const reviewedRaw = await validateQuizWithAI(
        finalQuiz,
        '',
        { ...execution, stage: 'REVIEW' },
      );
      const reviewedQuiz = parseGeneratedQuiz(reviewedRaw);
      if (auditGeneratedQuiz(reviewedQuiz, blueprint).length === 0) {
        finalQuiz = reviewedQuiz;
      }
    } catch (error) {
      console.warn('[AI Validation Chain] Reviewer output was ignored.', error);
    }
  }

  return finalQuiz;
};

const parseGeneratedQuizV3Compatibility = (raw: unknown): GeneratedQuizV3 => parseGeneratedQuizV3(
  normalizeGeneratedQuizV3Compatibility(raw, {
    allowV2DifficultyAlias: true,
    expectedPromptVersion: 'ai-blueprint-v3',
  }),
);

const runV3QualityPipeline = async (
  result: unknown,
  blueprint: QuizBlueprintV3,
  execution: QuizAiExecutionContext | undefined,
  onStepChange?: (step: QuizGenerationStep) => void,
): Promise<GeneratedQuizV3> => {
  let finalQuiz = parseGeneratedQuizV3Compatibility(result);
  let issues = auditGeneratedQuizV3(finalQuiz, blueprint);

  if (issues.some((issue) => !issue.repairable)) {
    throw new QuizGenerationValidationError(issues);
  }

  const canUseAuxiliaryStages = execution?.action.workflow === 'QUIZ_CREATE';
  if (issues.length > 0) {
    if (!canUseAuxiliaryStages) {
      throw new QuizGenerationValidationError(issues);
    }

    const repairPlan = createQuizSlotRepairPlan(issues, blueprint);
    if (repairPlan.requestedCount === 0) {
      throw new QuizGenerationValidationError(issues);
    }

    onStepChange?.('repairing');
    const repairedText = await requestWorkerAiText({
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'Bạn sửa đúng các slot bị lỗi. Chỉ trả về JSON V3 hợp lệ và giữ nguyên slotId, type, difficulty.',
        },
        {
          role: 'user',
          content: buildQuizSlotRepairPrompt({ blueprint, quiz: finalQuiz, issues }),
        },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }, toWorkerOptions({ ...execution, stage: 'REPAIR' }));
    const repairedQuiz = parseGeneratedQuizV3Compatibility(parseAndRepairJSON(repairedText));
    finalQuiz = mergeRepairedSlots(finalQuiz, repairedQuiz, repairPlan, blueprint);
    issues = auditGeneratedQuizV3(finalQuiz, blueprint);
    if (issues.length > 0) {
      throw new QuizGenerationValidationError(issues);
    }
  }

  if (canUseAuxiliaryStages) {
    onStepChange?.('reviewing');
    try {
      const reviewedText = await requestWorkerAiText({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: buildReviewerSystemPromptV3() },
          { role: 'user', content: buildReviewerUserPromptV3({ blueprint, quiz: finalQuiz }) },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }, toWorkerOptions({ ...execution, stage: 'REVIEW' }));
      const reviewedQuiz = parseGeneratedQuizV3Compatibility(parseAndRepairJSON(reviewedText));
      if (auditGeneratedQuizV3(reviewedQuiz, blueprint).length === 0) {
        finalQuiz = reviewedQuiz;
      }
    } catch (error) {
      console.warn('[AI Validation Chain V3] Reviewer output was ignored.', error);
    }
  }

  return finalQuiz;
};

const getProviderCapabilities = (provider: AIProvider) => ({
  provider,
  supportsRetrievalContext: provider === 'perplexity',
  supportsImages: provider !== 'perplexity' && provider !== 'native-ocr',
});

const resolveGeneratedImages = async (result: unknown): Promise<unknown> => {
  if (!result || typeof result !== 'object') return result;
  const resultObject = result as Record<string, unknown>;
  if (!Array.isArray(resultObject.questions)) return result;

  const imageQuestions = (resultObject.questions as Record<string, unknown>[]).filter(
    (question) => question.type === 'IMAGE_QUESTION'
      && typeof question.image === 'string'
      && question.image.startsWith('IMAGE_PROMPT:'),
  );

  if (imageQuestions.length === 0) return resultObject;
  const imageServiceAvailable = await checkImageServiceAvailability();
  for (const question of resultObject.questions as Record<string, unknown>[]) {
    if (question.type !== 'IMAGE_QUESTION'
      || typeof question.image !== 'string'
      || !question.image.startsWith('IMAGE_PROMPT:')) continue;

    const prompt = question.image.replace('IMAGE_PROMPT:', '').trim();
    if (imageServiceAvailable) {
      const generated = await generateImage(prompt);
      question.image = generated.success && generated.data
        ? generated.data
        : `https://placehold.co/600x400?text=${encodeURIComponent(prompt.slice(0, 20))}`;
    } else {
      question.image = `https://placehold.co/600x400?text=${encodeURIComponent(prompt.slice(0, 20))}`;
    }
  }
  return resultObject;
};

export const generateQuiz = async (
  topic: string,
  classLevel: string,
  content: string,
  file?: File | null,
  options?: QuizGenerationOptions,
  _customApiKey?: string,
  provider: AIProvider = 'llm-mux',
  onStepChange?: (step: QuizGenerationStep) => void,
  execution?: QuizAiExecutionContext,
): Promise<any> => {
  onStepChange?.('generating');
  const promptText = buildPrompt(topic, classLevel, content, options);
  const useV3 = options?.promptVersion === 'ai-blueprint-v3' && Boolean(options.blueprintV3);
  const systemInstruction = useV3
    ? buildGeneratorSystemPrompt(getProviderCapabilities(provider), 'ai-blueprint-v3')
    : undefined;
  const requestExecution = useV3 && options?.blueprintV3 && execution
    ? {
      ...execution,
      diagnostics: {
        promptVersion: 'ai-blueprint-v3' as const,
        blueprintVersion: 3 as const,
        slotCount: options.blueprintV3.totalQuestions,
      },
    }
    : execution;
  const requestedCount = options?.blueprintV3?.totalQuestions
    ?? options?.blueprint?.totalQuestions
    ?? options?.questionCount
    ?? 10;
  let result: unknown;

  if (provider === 'perplexity') {
    result = await generateWithPerplexity(promptText, '', requestExecution, systemInstruction);
  } else if (provider === 'openai') {
    result = await generateWithOpenAIResilient(
      promptText,
      '',
      file,
      options?.imageLibrary,
      'openai',
      onStepChange,
      requestExecution,
      systemInstruction,
    );
  } else if (provider === 'llm-mux' || provider === 'localhost') {
    result = await generateWithOpenAIResilient(
      promptText,
      '',
      file,
      options?.imageLibrary,
      'mux',
      onStepChange,
      requestExecution,
      systemInstruction,
    );
  } else {
    result = await generateWithGemini(
      promptText,
      '',
      file,
      options?.imageLibrary,
      onStepChange,
      requestExecution,
      systemInstruction,
    );
  }

  if (useV3 && options?.blueprintV3) {
    const finalQuizV3 = await runV3QualityPipeline(
      result,
      options.blueprintV3,
      requestExecution,
      onStepChange,
    );
    result = mapGeneratedQuizV3ToDomain(finalQuizV3);
  } else if (options?.blueprint) {
    result = await runDeterministicQualityPipeline(
      result,
      options.blueprint,
      execution,
      onStepChange,
    );
  } else if (result && typeof result === 'object') {
    const legacyResult = result as Record<string, unknown>;
    if (Array.isArray(legacyResult.questions) && legacyResult.questions.length > requestedCount) {
      legacyResult.questions = legacyResult.questions.slice(0, requestedCount);
    }
  }

  result = await resolveGeneratedImages(result);
  onStepChange?.('completed');
  return result;
};

export { extractTextFromPdf } from './ai/extractTextFromPdf';

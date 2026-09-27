import type {
  ServerQuizAiSource,
  ServerQuizBlueprintV3,
} from '../../../../shared/quiz-generation.contract';
import type { QuizBlueprintV3 } from '../../../../src/features/quiz-generator/domain/quizBlueprint';
import type { GeneratedQuizV3 } from '../../../../src/services/ai/question-contracts/questionContract.types';
import {
  auditGeneratedQuizV3,
  type QuizSlotAuditIssue,
} from '../../../../src/services/ai/quizAudit';
import {
  buildQuizSchemaRepairPrompt,
  buildQuizSlotRepairPrompt,
  createQuizSlotRepairPlan,
  mergeRepairedSlots,
  QuizGenerationValidationError,
} from '../../../../src/services/ai/quizRepair';
import {
  buildReviewerSystemPromptV3,
  buildReviewerUserPromptV3,
} from '../../../../src/services/ai/prompts/reviewerPromptBuilder';
import { parseGeneratedQuizV3 } from '../../../../src/services/ai/schemas/quizGenerationSchema';
import type { Env } from '../../types';
import {
  executeQuizAiStage,
  type QuizAiStageResult,
} from './providerTransport';

type StaffRole = 'teacher' | 'admin';

type ExecuteStage = (
  env: Env,
  owner: { username: string; role: StaffRole },
  input: Parameters<typeof executeQuizAiStage>[2],
) => Promise<QuizAiStageResult>;

type AuditQuiz = (
  quiz: GeneratedQuizV3,
  blueprint: QuizBlueprintV3,
) => QuizSlotAuditIssue[];

type ParseQuiz = (raw: unknown) => GeneratedQuizV3;

export interface ServerQuizQualityPipelineDependencies {
  executeStage?: ExecuteStage;
  audit?: AuditQuiz;
  parse?: ParseQuiz;
}

export interface ServerQuizQualityPipelineInput {
  env: Env;
  owner: { username: string; role: StaffRole };
  actionId: string;
  source: ServerQuizAiSource;
  blueprint: ServerQuizBlueprintV3;
  draftText: string;
  rules: {
    system: string;
    user: string;
  };
  signal?: AbortSignal;
}

const asQualityBlueprint = (blueprint: ServerQuizBlueprintV3): QuizBlueprintV3 => (
  blueprint as unknown as QuizBlueprintV3
);

const parseStrictQuizText = (
  text: string,
  parse: ParseQuiz,
): GeneratedQuizV3 => parse(JSON.parse(text));

const parseRawJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

type SchemaIssueLike = {
  path: unknown[];
  code: string;
  message: string;
};

const isSchemaError = (error: unknown): error is { issues: SchemaIssueLike[] } => (
  typeof error === 'object'
  && error !== null
  && Array.isArray((error as { issues?: unknown }).issues)
  && (error as { issues: unknown[] }).issues.every((issue) => (
    typeof issue === 'object'
    && issue !== null
    && Array.isArray((issue as { path?: unknown }).path)
    && typeof (issue as { code?: unknown }).code === 'string'
    && typeof (issue as { message?: unknown }).message === 'string'
  ))
);

const schemaIssuesForRepair = (error: { issues: SchemaIssueLike[] }) => error.issues.map((issue) => ({
  path: issue.path.filter(
    (part): part is string | number => typeof part === 'string' || typeof part === 'number',
  ),
  code: issue.code,
  message: issue.message,
}));

const validationError = (issues: QuizSlotAuditIssue[]): QuizGenerationValidationError => (
  new QuizGenerationValidationError(issues)
);

const isAbortError = (error: unknown): boolean => (
  typeof error === 'object'
  && error !== null
  && 'name' in error
  && String((error as { name?: unknown }).name) === 'AbortError'
);

const throwIfAborted = (signal?: AbortSignal): void => {
  if (!signal?.aborted) return;
  const error = new Error('Aborted');
  error.name = 'AbortError';
  throw error;
};

export async function runServerQuizQualityPipeline(
  input: ServerQuizQualityPipelineInput,
  dependencies: ServerQuizQualityPipelineDependencies = {},
): Promise<GeneratedQuizV3> {
  const executeStage = dependencies.executeStage ?? executeQuizAiStage;
  const audit = dependencies.audit ?? auditGeneratedQuizV3;
  const parse = dependencies.parse ?? parseGeneratedQuizV3;
  const blueprint = asQualityBlueprint(input.blueprint);

  throwIfAborted(input.signal);
  let repairUsed = false;
  let finalQuiz: GeneratedQuizV3;
  try {
    finalQuiz = parseStrictQuizText(input.draftText, parse);
  } catch (error) {
    if (!(error instanceof SyntaxError) && !isSchemaError(error)) {
      throw error;
    }

    const schemaIssues = isSchemaError(error)
      ? schemaIssuesForRepair(error)
      : [{
        path: [],
        code: 'invalid_json',
        message: 'Bản nháp không phải JSON hợp lệ.',
      }];
    const repaired = await executeStage(input.env, input.owner, {
      actionId: input.actionId,
      source: input.source,
      stage: 'REPAIR',
      systemPrompt: [
        'Bạn sửa cấu trúc JSON của một đề tiểu học.',
        'Chỉ trả về một JSON object V3 hợp lệ, không dùng markdown hoặc lời dẫn.',
        'Không đổi nội dung đúng nếu không cần thiết và không xuất suy luận nội bộ.',
      ].join('\\n'),
      userPrompt: buildQuizSchemaRepairPrompt({
        quiz: parseRawJson(input.draftText),
        issues: schemaIssues,
      }),
      responseFormat: { type: 'json_object' },
      maxTokens: 8192,
      temperature: 0.2,
      signal: input.signal,
    });
    repairUsed = true;
    finalQuiz = parseStrictQuizText(repaired.text, parse);
  }

  let issues = audit(finalQuiz, blueprint);

  if (issues.some((issue) => !issue.repairable)) {
    throw validationError(issues);
  }

  if (issues.length > 0) {
    if (repairUsed) {
      throw validationError(issues);
    }
    const repairPlan = createQuizSlotRepairPlan(issues, blueprint);
    if (repairPlan.requestedCount === 0) {
      throw validationError(issues);
    }

    const repaired = await executeStage(input.env, input.owner, {
      actionId: input.actionId,
      source: input.source,
      stage: 'REPAIR',
      systemPrompt: [
        'Bạn sửa đúng các slot bị lỗi của đề tiểu học.',
        'Chỉ trả về JSON V3 hợp lệ.',
        'Giữ nguyên slotId, type, difficulty và diagramPolicy.',
        'Không xuất suy luận nội bộ.',
      ].join('\n'),
      userPrompt: buildQuizSlotRepairPrompt({
        blueprint,
        quiz: finalQuiz,
        issues,
      }),
      responseFormat: { type: 'json_object' },
      maxTokens: 8192,
      temperature: 0.2,
      signal: input.signal,
    });

    const repairedQuiz = parseStrictQuizText(repaired.text, parse);
    finalQuiz = mergeRepairedSlots(finalQuiz, repairedQuiz, repairPlan, blueprint);
    issues = audit(finalQuiz, blueprint);
    if (issues.length > 0) {
      throw validationError(issues);
    }
  }

  throwIfAborted(input.signal);
  try {
    const reviewed = await executeStage(input.env, input.owner, {
      actionId: input.actionId,
      source: input.source,
      stage: 'REVIEW',
      systemPrompt: buildReviewerSystemPromptV3(),
      userPrompt: buildReviewerUserPromptV3({
        blueprint,
        quiz: finalQuiz,
      }),
      responseFormat: { type: 'json_object' },
      maxTokens: 8192,
      temperature: 0.1,
      signal: input.signal,
    });

    const reviewedQuiz = parseStrictQuizText(reviewed.text, parse);
    if (audit(reviewedQuiz, blueprint).length === 0) {
      finalQuiz = reviewedQuiz;
    }
  } catch (error) {
    if (isAbortError(error) || input.signal?.aborted) {
      throw error;
    }
    // REVIEW is deliberately best-effort. A validated draft remains authoritative.
  }

  throwIfAborted(input.signal);
  const finalIssues = audit(finalQuiz, blueprint);
  if (finalIssues.length > 0) {
    throw validationError(finalIssues);
  }

  return finalQuiz;
}

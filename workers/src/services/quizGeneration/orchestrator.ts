import type {
  ServerGeneratedQuizV3,
  ServerQuizAiSource,
  ServerQuizGenerationErrorCode,
  ServerQuizGenerationRequest,
  ServerQuizGenerationResponse,
} from '../../../../shared/quiz-generation.contract';
import { QuizGenerationValidationError } from '../../../../src/services/ai/quizRepair';
import type { Env } from '../../types';
import {
  AiQuotaError,
  claimServerQuizAction,
  failServerQuizAction,
  reserveAiAction,
  succeedServerQuizAction,
  type AiActionBinding,
  type ServerQuizActionDiagnostics,
} from '../teacherAiQuotaLedger';
import { getAiDefaultSource } from '../aiCredentials/repository';
import {
  AiCredentialServiceError,
  resolvePersonalAiCredential,
} from '../aiCredentials/service';
import { buildServerBlueprint } from './blueprint';
import {
  executeQuizAiStage,
  type QuizAiStageInput,
  type QuizAiStageResult,
  type QuizProviderTransportDependencies,
} from './providerTransport';
import {
  QuizProviderStageError,
  type QuizProviderTransientDiagnostic,
} from './retryPolicy';
import {
  runServerQuizQualityPipeline,
  type ServerQuizQualityPipelineInput,
} from './qualityPipeline';
import { getUnsupportedQuizCapabilities } from './request';
import { buildServerQuizRules } from './rules/quizRuleEngine';

type StaffRole = 'teacher' | 'admin';
type ResolvedPersonalCredential = Awaited<ReturnType<typeof resolvePersonalAiCredential>>;

const ORCHESTRATOR_VERSION = 'server-quiz-v1' as const;
const ORCHESTRATION_TIMEOUT_MS = 240_000;
const STAGE_TIMEOUT_MS: Record<QuizAiStageInput['stage'], number> = {
  GENERATE: 120_000,
  REPAIR: 60_000,
  REVIEW: 45_000,
};

export class ServerQuizOrchestratorError extends Error {
  constructor(public readonly code: ServerQuizGenerationErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ServerQuizOrchestratorError';
  }
}

export interface ServerQuizOrchestratorDependencies {
  resolveDefaultSource?: typeof getAiDefaultSource;
  resolvePersonalCredential?: typeof resolvePersonalAiCredential;
  executeStage?: typeof executeQuizAiStage;
  runQualityPipeline?: typeof runServerQuizQualityPipeline;
}

interface ProviderRunStats {
  attempts: number;
  lastTransientError?: QuizProviderTransientDiagnostic;
}

const createAbortError = (): Error => {
  try {
    return new DOMException('Aborted', 'AbortError');
  } catch {
    const error = new Error('Aborted');
    error.name = 'AbortError';
    return error;
  }
};

const isAbortError = (error: unknown): boolean => (
  typeof error === 'object'
  && error !== null
  && 'name' in error
  && String((error as { name?: unknown }).name) === 'AbortError'
);

const withLinkedTimeoutSignal = async <T>(
  parentSignal: AbortSignal,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> => {
  if (parentSignal.aborted) throw createAbortError();
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(parentSignal.reason);
  parentSignal.addEventListener('abort', abortFromParent, { once: true });
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timeoutId);
    parentSignal.removeEventListener('abort', abortFromParent);
  }
};

const failureCodeOf = (error: unknown): ServerQuizGenerationErrorCode => {
  if (error instanceof ServerQuizOrchestratorError) return error.code;
  if (error instanceof QuizProviderStageError) {
    if (error.code === 'AI_CAPABILITY_UNSUPPORTED') return 'QUIZ_CAPABILITY_UNSUPPORTED';
    if (error.code === 'AI_PROVIDER_REQUEST_REJECTED') return 'QUIZ_GENERATION_INVALID';
    return error.code;
  }
  if (error instanceof AiCredentialServiceError) {
    if (error.code === 'AI_KEY_MISSING') return 'AI_KEY_MISSING';
    return 'QUIZ_SOURCE_UNAVAILABLE';
  }
  if (error instanceof AiQuotaError) return error.code;
  if (error instanceof QuizGenerationValidationError) return 'QUIZ_GENERATION_INVALID';
  if (isAbortError(error)) return 'QUIZ_GENERATION_TIMEOUT';
  if (error instanceof SyntaxError) return 'AI_PROVIDER_RESPONSE_INVALID';
  return 'QUIZ_GENERATION_INVALID';
};

const publicErrorFor = (error: unknown): Error => {
  if (
    error instanceof AiQuotaError
    || error instanceof AiCredentialServiceError
    || error instanceof QuizProviderStageError
    || error instanceof ServerQuizOrchestratorError
  ) {
    return error;
  }
  return new ServerQuizOrchestratorError(failureCodeOf(error));
};

const diagnosticsFrom = (
  stats: ProviderRunStats,
  directError?: QuizProviderStageError,
): ServerQuizActionDiagnostics => {
  const last = directError
    ? {
      code: directError.code,
      phase: directError.phase,
      upstreamStatus: directError.upstreamStatus,
    }
    : stats.lastTransientError;
  return {
    providerAttempts: stats.attempts + (directError?.attempts ?? 0),
    lastProviderErrorCode: last?.code,
    lastProviderStatus: last?.upstreamStatus,
    lastProviderPhase: last?.phase,
  };
};

export async function generateQuizOnServer(
  input: {
    env: Env;
    owner: { username: string; role: StaffRole };
    request: ServerQuizGenerationRequest;
    signal?: AbortSignal;
  },
  dependencies: ServerQuizOrchestratorDependencies = {},
): Promise<ServerQuizGenerationResponse> {
  const resolveDefaultSource = dependencies.resolveDefaultSource ?? getAiDefaultSource;
  const resolveCredential = dependencies.resolvePersonalCredential ?? resolvePersonalAiCredential;
  const baseExecuteStage = dependencies.executeStage ?? executeQuizAiStage;
  const qualityPipeline = dependencies.runQualityPipeline ?? runServerQuizQualityPipeline;

  const source: ServerQuizAiSource = input.request.source
    ?? await resolveDefaultSource(input.env.DB, input.owner.username);

  if (getUnsupportedQuizCapabilities(input.request, source).length > 0) {
    throw new ServerQuizOrchestratorError('QUIZ_CAPABILITY_UNSUPPORTED');
  }

  let personalCredential: ResolvedPersonalCredential | null = null;
  if (source !== 'system') {
    personalCredential = await resolveCredential(input.env, {
      owner: input.owner.username,
      role: input.owner.role,
      source,
    });
  }

  const binding: AiActionBinding = personalCredential
    ? {
      source,
      credentialVersion: personalCredential.version,
      model: personalCredential.model,
    }
    : {
      source: 'system',
      credentialVersion: null,
      model: null,
    };

  await reserveAiAction(input.env.DB, {
    actionId: input.request.actionId,
    username: input.owner.username,
    role: input.owner.role,
    workflow: 'QUIZ_CREATE',
    binding,
  });
  await claimServerQuizAction(
    input.env.DB,
    input.request.actionId,
    input.owner.username,
  );

  let claimed = true;
  const stats: ProviderRunStats = { attempts: 0 };
  const orchestrationController = new AbortController();
  const abortFromCaller = () => orchestrationController.abort(input.signal?.reason);
  if (input.signal?.aborted) {
    abortFromCaller();
  } else {
    input.signal?.addEventListener('abort', abortFromCaller, { once: true });
  }
  const orchestrationTimeout = setTimeout(
    () => orchestrationController.abort(),
    ORCHESTRATION_TIMEOUT_MS,
  );

  const fixedCredentialResolver: QuizProviderTransportDependencies['resolvePersonalCredential']
    = personalCredential
      ? async () => personalCredential!
      : undefined;

  const executeTrackedStage = async (
    env: Env,
    owner: { username: string; role: StaffRole },
    stageInput: QuizAiStageInput,
  ): Promise<QuizAiStageResult> => withLinkedTimeoutSignal(
    orchestrationController.signal,
    STAGE_TIMEOUT_MS[stageInput.stage],
    async (stageSignal) => {
      const result = await baseExecuteStage(
        env,
        owner,
        { ...stageInput, signal: stageSignal },
        fixedCredentialResolver
          ? { resolvePersonalCredential: fixedCredentialResolver }
          : undefined,
      );
      stats.attempts += result.attempts;
      if (result.lastTransientError) {
        stats.lastTransientError = result.lastTransientError;
      }
      return result;
    },
  );

  try {
    const blueprint = buildServerBlueprint(input.request);
    const rules = buildServerQuizRules({
      topic: input.request.topic,
      classLevel: input.request.classLevel,
      title: input.request.title,
      content: input.request.content ?? '',
      blueprint,
      promptProfile: input.request.promptProfile,
      customPrompt: input.request.customPrompt,
      diagramMode: input.request.diagramMode,
    });

    const draft = await executeTrackedStage(input.env, input.owner, {
      actionId: input.request.actionId,
      source,
      stage: 'GENERATE',
      systemPrompt: rules.system,
      userPrompt: rules.user,
      responseFormat: { type: 'json_object' },
      maxTokens: 8192,
      temperature: 0.4,
      signal: orchestrationController.signal,
    });

    const qualityInput: ServerQuizQualityPipelineInput = {
      env: input.env,
      owner: input.owner,
      actionId: input.request.actionId,
      source,
      blueprint,
      draftText: draft.text,
      rules,
      signal: orchestrationController.signal,
    };
    const finalQuiz = await qualityPipeline(qualityInput, {
      executeStage: executeTrackedStage,
    });

    await succeedServerQuizAction(
      input.env.DB,
      input.request.actionId,
      input.owner.username,
      diagnosticsFrom(stats),
    );
    claimed = false;

    return {
      status: 'success',
      actionId: input.request.actionId,
      source,
      promptVersion: 'ai-blueprint-v3',
      blueprintVersion: 3,
      orchestratorVersion: ORCHESTRATOR_VERSION,
      quiz: finalQuiz as unknown as ServerGeneratedQuizV3,
    };
  } catch (error) {
    const directProviderError = error instanceof QuizProviderStageError ? error : undefined;
    if (claimed) {
      try {
        await failServerQuizAction(
          input.env.DB,
          input.request.actionId,
          input.owner.username,
          failureCodeOf(error),
          diagnosticsFrom(stats, directProviderError),
        );
      } catch {
        console.error('[Server Quiz] Failed to finalize failed action');
      }
      claimed = false;
    }
    throw publicErrorFor(error);
  } finally {
    clearTimeout(orchestrationTimeout);
    input.signal?.removeEventListener('abort', abortFromCaller);
  }
}

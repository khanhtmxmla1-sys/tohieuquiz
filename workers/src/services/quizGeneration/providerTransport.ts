import type { ServerQuizAiSource } from '../../../../shared/quiz-generation.contract';
import type { Env } from '../../types';
import {
  AiPersonalDispatchError,
  dispatchPersonalAi,
} from '../aiCredentials/dispatch';
import { resolvePersonalAiCredential } from '../aiCredentials/service';
import {
  QuizProviderStageError,
  retryTransientProviderOperation,
  type QuizProviderName,
  type QuizProviderTransientDiagnostic,
  type RetrySleep,
} from './retryPolicy';

const SYSTEM_QUIZ_MODEL = 'gemini-2.5-flash';
const MAX_SYSTEM_RESPONSE_BYTES = 2 * 1024 * 1024;

type StaffRole = 'teacher' | 'admin';

export interface QuizAiStageInput {
  actionId: string;
  source: ServerQuizAiSource;
  stage: 'GENERATE' | 'REPAIR' | 'REVIEW';
  systemPrompt: string;
  userPrompt: string;
  responseFormat: { type: 'json_object' };
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
}

export interface QuizAiStageResult {
  text: string;
  provider: QuizProviderName;
  model: string;
  attempts: number;
  credentialVersion?: number;
  lastTransientError?: QuizProviderTransientDiagnostic;
}

export interface QuizProviderTransportDependencies {
  resolvePersonalCredential?: typeof resolvePersonalAiCredential;
  dispatchPersonal?: typeof dispatchPersonalAi;
  sleep?: RetrySleep;
}

const readBoundedText = async (response: Response): Promise<string> => {
  if (!response.body) return response.text();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_SYSTEM_RESPONSE_BYTES) {
      try { await reader.cancel(); } catch { /* no-op */ }
      throw new QuizProviderStageError('AI_PROVIDER_RESPONSE_INVALID', {
        provider: 'system-gateway',
        phase: 'response-size',
      });
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
};

const extractOpenAiText = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
  const choices = (payload as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) return '';

  const first = choices[0];
  if (!first || typeof first !== 'object' || Array.isArray(first)) return '';
  const message = (first as Record<string, unknown>).message;
  if (!message || typeof message !== 'object' || Array.isArray(message)) return '';

  const content = (message as Record<string, unknown>).content;
  return typeof content === 'string' ? content : '';
};

const hasOpenAiLengthFinishReason = (payload: unknown): boolean => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const choices = (payload as Record<string, unknown>).choices;
  if (!Array.isArray(choices)) return false;
  return choices.some((choice) => (
    Boolean(choice)
    && typeof choice === 'object'
    && !Array.isArray(choice)
    && String((choice as Record<string, unknown>).finish_reason || '').trim().toLowerCase() === 'length'
  ));
};

const systemCodeForStatus = (status: number): QuizProviderStageError['code'] => {
  if (status === 429) return 'AI_PROVIDER_QUOTA';
  if (status === 408 || status === 504) return 'AI_PROVIDER_TIMEOUT';
  if (status === 400 || status === 404) return 'AI_PROVIDER_REQUEST_REJECTED';
  return 'AI_PROVIDER_UNAVAILABLE';
};

const executeSystemGatewayOnce = async (
  env: Env,
  input: QuizAiStageInput,
): Promise<string> => {
  if (!env.AI_GATEWAY || !env.CLIPROXY_API || !env.CLIPROXY_TOKEN) {
    throw new QuizProviderStageError('AI_PROVIDER_UNAVAILABLE', {
      provider: 'system-gateway',
      phase: 'validation',
    });
  }
  if (input.signal?.aborted) {
    const error = new Error('Aborted');
    error.name = 'AbortError';
    throw error;
  }

  let response: Response;
  try {
    response = await env.AI_GATEWAY.fetch(
      `${env.CLIPROXY_API.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.CLIPROXY_TOKEN}`,
        },
        body: JSON.stringify({
          model: SYSTEM_QUIZ_MODEL,
          messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.userPrompt },
          ],
          temperature: input.temperature,
          max_tokens: input.maxTokens,
          response_format: input.responseFormat,
          stream: false,
        }),
        signal: input.signal,
      },
    );
  } catch (error) {
    if (input.signal?.aborted) throw error;
    throw new QuizProviderStageError('AI_PROVIDER_UNAVAILABLE', {
      provider: 'system-gateway',
      phase: 'network',
    });
  }

  if (!response.ok) {
    try { await response.body?.cancel(); } catch { /* no-op */ }
    throw new QuizProviderStageError(systemCodeForStatus(response.status), {
      provider: 'system-gateway',
      phase: 'upstream',
      upstreamStatus: response.status,
    });
  }

  const raw = await readBoundedText(response);
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new QuizProviderStageError('AI_PROVIDER_RESPONSE_INVALID', {
      provider: 'system-gateway',
      phase: 'response-json',
    });
  }

  if (hasOpenAiLengthFinishReason(payload)) {
    throw new QuizProviderStageError('AI_PROVIDER_OUTPUT_TRUNCATED', {
      provider: 'system-gateway',
      phase: 'response-content',
    });
  }

  const text = extractOpenAiText(payload);
  if (!text) {
    throw new QuizProviderStageError('AI_PROVIDER_RESPONSE_INVALID', {
      provider: 'system-gateway',
      phase: 'response-content',
    });
  }
  return text;
};

const mapPersonalDispatchError = (
  error: AiPersonalDispatchError,
  provider: 'gemini' | 'deepseek',
): QuizProviderStageError => new QuizProviderStageError(error.code, {
  provider,
  phase: error.phase,
  upstreamStatus: error.upstreamStatus,
});

export async function executeQuizAiStage(
  env: Env,
  owner: { username: string; role: StaffRole },
  input: QuizAiStageInput,
  dependencies: QuizProviderTransportDependencies = {},
): Promise<QuizAiStageResult> {
  const sleep = dependencies.sleep;

  if (input.source === 'system') {
    const retried = await retryTransientProviderOperation(
      () => executeSystemGatewayOnce(env, input),
      { signal: input.signal, sleep },
    );
    return {
      text: retried.value,
      provider: 'system-gateway',
      model: SYSTEM_QUIZ_MODEL,
      attempts: retried.attempts,
      lastTransientError: retried.lastTransientError,
    };
  }

  const resolveCredential = dependencies.resolvePersonalCredential ?? resolvePersonalAiCredential;
  const dispatch = dependencies.dispatchPersonal ?? dispatchPersonalAi;
  const credential = await resolveCredential(env, {
    owner: owner.username,
    role: owner.role,
    source: input.source,
  });

  const retried = await retryTransientProviderOperation(
    async () => {
      try {
        const result = await dispatch({
          provider: credential.provider,
          key: credential.apiKey,
          model: credential.model,
          messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.userPrompt },
          ],
          temperature: input.temperature,
          maxTokens: input.maxTokens,
          responseFormat: input.responseFormat,
          signal: input.signal,
        });
        return result.text;
      } catch (error) {
        if (error instanceof AiPersonalDispatchError) {
          throw mapPersonalDispatchError(error, credential.provider);
        }
        throw error;
      }
    },
    { signal: input.signal, sleep },
  );

  return {
    text: retried.value,
    provider: credential.provider,
    model: credential.model,
    attempts: retried.attempts,
    credentialVersion: credential.version,
    lastTransientError: retried.lastTransientError,
  };
}

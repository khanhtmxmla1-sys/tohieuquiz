import type { PersonalAiProvider } from '../../../../shared/teacher-ai-credentials.contract';
import {
  PERSONAL_AI_PROVIDER_ENDPOINTS,
  PERSONAL_AI_PROVIDER_MODELS,
} from './providerClient';

export type AiPersonalDispatchCode =
  | 'AI_KEY_INVALID'
  | 'AI_PROVIDER_QUOTA'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_PROVIDER_TIMEOUT'
  | 'AI_CAPABILITY_UNSUPPORTED';

export class AiPersonalDispatchError extends Error {
  constructor(public readonly code: AiPersonalDispatchCode) {
    const messages: Record<AiPersonalDispatchCode, string> = {
      AI_KEY_INVALID: 'API key không hợp lệ.',
      AI_PROVIDER_QUOTA: 'Nhà cung cấp AI đang giới hạn hoặc đã hết hạn mức.',
      AI_PROVIDER_UNAVAILABLE: 'Nhà cung cấp AI tạm thời không khả dụng.',
      AI_PROVIDER_TIMEOUT: 'Nhà cung cấp AI phản hồi quá thời gian.',
      AI_CAPABILITY_UNSUPPORTED: 'Nguồn AI cá nhân V1 chỉ hỗ trợ yêu cầu văn bản tương thích.',
    };
    super(messages[code]);
    this.name = 'AiPersonalDispatchError';
  }
}

const MAX_REQUEST_TEXT_BYTES = 256 * 1024;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_TOKENS = 8192;

type TextMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const mapStatus = (status: number): AiPersonalDispatchCode => {
  if (status === 401) return 'AI_KEY_INVALID';
  if (status === 429) return 'AI_PROVIDER_QUOTA';
  if (status === 408 || status === 504) return 'AI_PROVIDER_TIMEOUT';
  return 'AI_PROVIDER_UNAVAILABLE';
};

const normalizeMessages = (messages: unknown): TextMessage[] => {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) {
    throw new AiPersonalDispatchError('AI_CAPABILITY_UNSUPPORTED');
  }

  const normalized: TextMessage[] = [];
  for (const raw of messages) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new AiPersonalDispatchError('AI_CAPABILITY_UNSUPPORTED');
    }
    const record = raw as Record<string, unknown>;
    if (!['system', 'user', 'assistant'].includes(String(record.role))) {
      throw new AiPersonalDispatchError('AI_CAPABILITY_UNSUPPORTED');
    }

    let content = '';
    if (typeof record.content === 'string') {
      content = record.content;
    } else if (Array.isArray(record.content)) {
      const textParts: string[] = [];
      for (const part of record.content) {
        if (
          !part
          || typeof part !== 'object'
          || Array.isArray(part)
          || (part as Record<string, unknown>).type !== 'text'
          || typeof (part as Record<string, unknown>).text !== 'string'
        ) {
          throw new AiPersonalDispatchError('AI_CAPABILITY_UNSUPPORTED');
        }
        textParts.push(String((part as Record<string, unknown>).text));
      }
      content = textParts.join('\n');
    } else {
      throw new AiPersonalDispatchError('AI_CAPABILITY_UNSUPPORTED');
    }

    normalized.push({
      role: record.role as TextMessage['role'],
      content,
    });
  }

  const byteLength = new TextEncoder().encode(JSON.stringify(normalized)).byteLength;
  if (byteLength > MAX_REQUEST_TEXT_BYTES) {
    throw new AiPersonalDispatchError('AI_CAPABILITY_UNSUPPORTED');
  }
  return normalized;
};

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
    if (total > MAX_RESPONSE_BYTES) {
      try { await reader.cancel(); } catch { /* no-op */ }
      throw new AiPersonalDispatchError('AI_PROVIDER_UNAVAILABLE');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
};

export async function dispatchPersonalAi(input: {
  provider: PersonalAiProvider;
  key: string;
  model: string;
  messages: unknown;
  temperature?: unknown;
  maxTokens?: unknown;
  responseFormat?: unknown;
  signal?: AbortSignal;
}): Promise<{ text: string }> {
  if (input.model !== PERSONAL_AI_PROVIDER_MODELS[input.provider]) {
    throw new AiPersonalDispatchError('AI_CAPABILITY_UNSUPPORTED');
  }

  const messages = normalizeMessages(input.messages);
  const temperature = input.temperature === undefined
    ? 0.4
    : Number(input.temperature);
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new AiPersonalDispatchError('AI_CAPABILITY_UNSUPPORTED');
  }

  const maxTokens = input.maxTokens === undefined
    ? MAX_OUTPUT_TOKENS
    : Number(input.maxTokens);
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > MAX_OUTPUT_TOKENS) {
    throw new AiPersonalDispatchError('AI_CAPABILITY_UNSUPPORTED');
  }

  let responseFormat: { type: 'json_object' | 'text' } | undefined;
  if (input.responseFormat !== undefined) {
    if (
      !input.responseFormat
      || typeof input.responseFormat !== 'object'
      || Array.isArray(input.responseFormat)
    ) {
      throw new AiPersonalDispatchError('AI_CAPABILITY_UNSUPPORTED');
    }
    const type = String((input.responseFormat as Record<string, unknown>).type || '');
    if (type !== 'json_object' && type !== 'text') {
      throw new AiPersonalDispatchError('AI_CAPABILITY_UNSUPPORTED');
    }
    responseFormat = { type };
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(input.signal?.reason);
  if (input.signal?.aborted) {
    abortFromCaller();
  } else {
    input.signal?.addEventListener('abort', abortFromCaller, { once: true });
  }
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 120_000);

  try {
    const response = await fetch(PERSONAL_AI_PROVIDER_ENDPOINTS[input.provider], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.key}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(responseFormat ? { response_format: responseFormat } : {}),
        stream: false,
      }),
      redirect: 'manual',
      signal: controller.signal,
    });

    if (!response.ok) {
      try { await response.body?.cancel(); } catch { /* no-op */ }
      throw new AiPersonalDispatchError(mapStatus(response.status));
    }

    const raw = await readBoundedText(response);
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new AiPersonalDispatchError('AI_PROVIDER_UNAVAILABLE');
    }
    const choices = (
      payload
      && typeof payload === 'object'
      && !Array.isArray(payload)
      && Array.isArray((payload as Record<string, unknown>).choices)
    ) ? (payload as { choices: unknown[] }).choices : [];
    const first = choices[0];
    const message = (
      first
      && typeof first === 'object'
      && !Array.isArray(first)
      && (first as Record<string, unknown>).message
      && typeof (first as Record<string, unknown>).message === 'object'
      && !Array.isArray((first as Record<string, unknown>).message)
    ) ? (first as { message: Record<string, unknown> }).message : null;
    const text = typeof message?.content === 'string' ? message.content : '';
    if (!text) throw new AiPersonalDispatchError('AI_PROVIDER_UNAVAILABLE');
    return { text };
  } catch (error) {
    if (error instanceof AiPersonalDispatchError) throw error;
    const name = typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name?: unknown }).name)
      : '';
    if (name === 'AbortError') {
      throw new AiPersonalDispatchError(timedOut ? 'AI_PROVIDER_TIMEOUT' : 'AI_PROVIDER_UNAVAILABLE');
    }
    throw new AiPersonalDispatchError('AI_PROVIDER_UNAVAILABLE');
  } finally {
    clearTimeout(timeoutId);
    input.signal?.removeEventListener('abort', abortFromCaller);
  }
}

import type { PersonalAiProvider } from '../../../../shared/teacher-ai-credentials.contract';

export type AiCredentialProviderCode =
  | 'AI_KEY_INVALID'
  | 'AI_PROVIDER_QUOTA'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_PROVIDER_TIMEOUT';

export class AiCredentialProviderError extends Error {
  constructor(public readonly code: AiCredentialProviderCode) {
    const messages: Record<AiCredentialProviderCode, string> = {
      AI_KEY_INVALID: 'API key không hợp lệ.',
      AI_PROVIDER_QUOTA: 'Nhà cung cấp AI đang giới hạn hoặc đã hết hạn mức.',
      AI_PROVIDER_UNAVAILABLE: 'Nhà cung cấp AI tạm thời không khả dụng.',
      AI_PROVIDER_TIMEOUT: 'Nhà cung cấp AI phản hồi quá thời gian.',
    };
    super(messages[code]);
    this.name = 'AiCredentialProviderError';
  }
}

export const PERSONAL_AI_PROVIDER_ENDPOINTS: Record<PersonalAiProvider, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
};

export const PERSONAL_AI_PROVIDER_MODELS: Record<PersonalAiProvider, string> = {
  gemini: 'gemini-3.8-flash',
  deepseek: 'deepseek-flash',
};

const mapStatus = (status: number): AiCredentialProviderCode => {
  if (status === 401) return 'AI_KEY_INVALID';
  if (status === 429) return 'AI_PROVIDER_QUOTA';
  if (status === 408 || status === 504) return 'AI_PROVIDER_TIMEOUT';
  return 'AI_PROVIDER_UNAVAILABLE';
};

export async function testProviderCredential(
  provider: PersonalAiProvider,
  apiKey: string,
  signal?: AbortSignal,
): Promise<void> {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) {
    abortFromCaller();
  } else {
    signal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15_000);

  try {
    const response = await fetch(PERSONAL_AI_PROVIDER_ENDPOINTS[provider], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: PERSONAL_AI_PROVIDER_MODELS[provider],
        messages: [{ role: 'user', content: 'Reply with OK.' }],
        max_tokens: 16,
        stream: false,
      }),
      redirect: 'error',
      signal: controller.signal,
    });

    if (!response.ok) {
      try { await response.body?.cancel(); } catch { /* no-op */ }
      throw new AiCredentialProviderError(mapStatus(response.status));
    }
    try { await response.body?.cancel(); } catch { /* no-op */ }
  } catch (error) {
    if (error instanceof AiCredentialProviderError) throw error;
    const name = typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name?: unknown }).name)
      : '';
    if (name === 'AbortError') {
      throw new AiCredentialProviderError(timedOut ? 'AI_PROVIDER_TIMEOUT' : 'AI_PROVIDER_UNAVAILABLE');
    }
    throw new AiCredentialProviderError('AI_PROVIDER_UNAVAILABLE');
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

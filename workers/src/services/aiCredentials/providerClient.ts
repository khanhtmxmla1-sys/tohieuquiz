import type { PersonalAiProvider } from '../../../../shared/teacher-ai-credentials.contract';

export type AiCredentialProviderCode =
  | 'AI_KEY_INVALID'
  | 'AI_PROVIDER_ACCOUNT_REQUIRED'
  | 'AI_PROVIDER_QUOTA'
  | 'AI_PROVIDER_REQUEST_REJECTED'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_PROVIDER_TIMEOUT';

export class AiCredentialProviderError extends Error {
  constructor(public readonly code: AiCredentialProviderCode) {
    const messages: Record<AiCredentialProviderCode, string> = {
      AI_KEY_INVALID: 'API key không hợp lệ.',
      AI_PROVIDER_ACCOUNT_REQUIRED: 'Tài khoản hoặc dự án AI chưa đủ quyền, chưa bật thanh toán, hoặc không còn số dư.',
      AI_PROVIDER_QUOTA: 'Nhà cung cấp AI đang giới hạn hoặc đã hết hạn mức.',
      AI_PROVIDER_REQUEST_REJECTED: 'Nhà cung cấp AI từ chối yêu cầu kiểm tra. Vui lòng liên hệ quản trị viên.',
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

const MAX_PROVIDER_ERROR_BYTES = 16 * 1024;

const readProviderErrorTokens = async (response: Response): Promise<Set<string>> => {
  const tokens = new Set<string>();
  if (!response.body) return tokens;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PROVIDER_ERROR_BYTES) {
        try { await reader.cancel(); } catch { /* no-op */ }
        return tokens;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    return tokens;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return tokens;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return tokens;
  const error = (payload as Record<string, unknown>).error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) return tokens;
  const record = error as Record<string, unknown>;

  const addToken = (value: unknown) => {
    if (typeof value !== 'string' && typeof value !== 'number') return;
    const normalized = String(value).trim().toUpperCase();
    if (normalized && normalized.length <= 128) tokens.add(normalized);
  };
  addToken(record.code);
  addToken(record.status);
  addToken(record.type);
  if (Array.isArray(record.details)) {
    for (const detail of record.details.slice(0, 16)) {
      if (!detail || typeof detail !== 'object' || Array.isArray(detail)) continue;
      const detailRecord = detail as Record<string, unknown>;
      addToken(detailRecord.code);
      addToken(detailRecord.reason);
      addToken(detailRecord.status);
      addToken(detailRecord.type);
    }
  }
  return tokens;
};

const hasAnyToken = (tokens: Set<string>, expected: readonly string[]): boolean => (
  expected.some((token) => tokens.has(token))
);

const mapProviderError = async (response: Response): Promise<AiCredentialProviderCode> => {
  const { status } = response;
  const tokens = await readProviderErrorTokens(response);

  if (
    status === 401
    || hasAnyToken(tokens, ['API_KEY_INVALID', 'AUTHENTICATION', 'INVALID_API_KEY', 'UNAUTHORIZED'])
  ) return 'AI_KEY_INVALID';
  if (status === 429) return 'AI_PROVIDER_QUOTA';
  if (status === 408 || status === 504) return 'AI_PROVIDER_TIMEOUT';
  if (
    status === 402
    || status === 403
    || hasAnyToken(tokens, [
      'FAILED_PRECONDITION',
      'PERMISSION_DENIED',
      'PAYMENT_REQUIRED',
      'INSUFFICIENT_BALANCE',
      'BILLING_DISABLED',
      'BILLING_NOT_ENABLED',
    ])
  ) return 'AI_PROVIDER_ACCOUNT_REQUIRED';
  if (
    status === 400
    || status === 404
    || hasAnyToken(tokens, ['INVALID_REQUEST', 'MODEL_NOT_FOUND', 'NOT_FOUND', 'PARAMETER_UNKNOWN'])
  ) return 'AI_PROVIDER_REQUEST_REJECTED';

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
      redirect: 'manual',
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      try { await response.body?.cancel(); } catch { /* no-op */ }
      throw new AiCredentialProviderError('AI_PROVIDER_REQUEST_REJECTED');
    }
    if (!response.ok) {
      throw new AiCredentialProviderError(await mapProviderError(response));
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

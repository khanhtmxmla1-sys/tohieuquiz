import type {
  AiCredentialSummary,
  PersonalAiProvider,
  QuizAiSource,
  SaveAiCredentialInput,
  SaveAiPreferenceInput,
} from '../../../shared/teacher-ai-credentials.contract';
import { getWorkersApiBaseUrl } from '../api/config';

export interface AiCredentialCapabilities {
  text: boolean;
  documents: boolean;
  images: boolean;
  ocr: boolean;
  webSearch: boolean;
  imageGeneration: boolean;
}

export interface AiCredentialState {
  enabled: boolean;
  defaultSource: QuizAiSource;
  capabilities: AiCredentialCapabilities;
  credentials: AiCredentialSummary[];
}

export interface AiPreferenceState {
  defaultSource: QuizAiSource;
}

export class AiCredentialClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AiCredentialClientError';
  }
}

const request = async <T>(
  path: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<T> => {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener('abort', abortFromCaller, { once: true });

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15_000);

  try {
    const response = await fetch(`${getWorkersApiBaseUrl()}${path}`, {
      ...init,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
      const code = typeof payload?.code === 'string' ? payload.code : 'AI_CREDENTIAL_REQUEST_FAILED';
      const message = typeof payload?.message === 'string'
        ? payload.message
        : 'Không thể xử lý cài đặt API key AI lúc này.';
      throw new AiCredentialClientError(code, message);
    }
    return payload as T;
  } catch (error) {
    const name = typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name?: unknown }).name)
      : '';
    if (name === 'AbortError') {
      throw new AiCredentialClientError(
        timedOut ? 'AI_PROVIDER_TIMEOUT' : 'AI_REQUEST_CANCELLED',
        timedOut ? 'Yêu cầu quá thời gian. Vui lòng thử lại.' : 'Đã hủy yêu cầu.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
};

export const fetchAiCredentialState = (signal?: AbortSignal): Promise<AiCredentialState> => (
  request<AiCredentialState>(
    '/api/account/ai-credentials',
    { method: 'GET' },
    signal,
  )
);

export const saveAiCredential = async (
  provider: PersonalAiProvider,
  input: SaveAiCredentialInput,
  signal?: AbortSignal,
): Promise<AiCredentialSummary> => {
  const result = await request<{ credential: AiCredentialSummary }>(
    `/api/account/ai-credentials/${provider}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
    signal,
  );
  return result.credential;
};

export const testAiCredential = async (
  provider: PersonalAiProvider,
  signal?: AbortSignal,
): Promise<AiCredentialSummary> => {
  const result = await request<{ credential: AiCredentialSummary }>(
    `/api/account/ai-credentials/${provider}/test`,
    { method: 'POST' },
    signal,
  );
  return result.credential;
};

export const deleteAiCredential = async (
  provider: PersonalAiProvider,
  expectedVersion: number,
  signal?: AbortSignal,
): Promise<void> => {
  await request<unknown>(
    `/api/account/ai-credentials/${provider}`,
    {
      method: 'DELETE',
      headers: { 'If-Match': String(expectedVersion) },
    },
    signal,
  );
};

export const saveAiPreference = (
  input: SaveAiPreferenceInput,
  signal?: AbortSignal,
): Promise<AiPreferenceState> => request<AiPreferenceState>(
  '/api/account/ai-credentials/preferences',
  {
    method: 'PUT',
    body: JSON.stringify(input),
  },
  signal,
);

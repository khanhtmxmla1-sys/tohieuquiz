import type {
  ServerQuizGenerationErrorCode,
  ServerQuizGenerationRequest,
  ServerQuizGenerationResponse,
} from '../../../shared/quiz-generation.contract';
import { getWorkersApiBaseUrl } from '../api/config';
import { SERVER_QUIZ_GENERATION_API_PATH } from './endpointConfig';

export interface ServerQuizGenerationRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export class ServerQuizGenerationError extends Error {
  constructor(
    public readonly code: ServerQuizGenerationErrorCode | string,
    public readonly status?: number,
    message?: string,
  ) {
    super(message || code);
    this.name = 'ServerQuizGenerationError';
  }
}

const errorCode = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'QUIZ_GENERATION_INVALID';
  }
  const code = (payload as Record<string, unknown>).code;
  return typeof code === 'string' && code.trim()
    ? code.trim()
    : 'QUIZ_GENERATION_INVALID';
};

const errorMessage = (payload: unknown, code: string): string => {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const message = (payload as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return code === 'QUIZ_GENERATION_TIMEOUT'
    ? 'Quá trình tạo đề vượt quá thời gian cho phép.'
    : 'Không thể tạo đề lúc này.';
};

const isAbortError = (error: unknown): boolean => (
  typeof error === 'object'
  && error !== null
  && 'name' in error
  && String((error as { name?: unknown }).name) === 'AbortError'
);

export async function requestServerQuizGeneration(
  request: ServerQuizGenerationRequest,
  options: ServerQuizGenerationRequestOptions = {},
): Promise<ServerQuizGenerationResponse> {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(options.signal?.reason);

  if (options.signal?.aborted) {
    abortFromCaller();
  } else {
    options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.max(1, options.timeoutMs ?? 240_000));

  try {
    const response = await fetch(
      `${getWorkersApiBaseUrl()}${SERVER_QUIZ_GENERATION_API_PATH}`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      },
    );

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const code = errorCode(payload);
      throw new ServerQuizGenerationError(
        code,
        response.status,
        errorMessage(payload, code),
      );
    }

    if (
      !payload
      || typeof payload !== 'object'
      || Array.isArray(payload)
      || (payload as Record<string, unknown>).status !== 'success'
    ) {
      throw new ServerQuizGenerationError(
        'QUIZ_GENERATION_INVALID',
        response.status,
        'Phản hồi tạo đề từ máy chủ không hợp lệ.',
      );
    }

    return payload as ServerQuizGenerationResponse;
  } catch (error) {
    if (error instanceof ServerQuizGenerationError) throw error;
    if (isAbortError(error)) {
      throw new ServerQuizGenerationError(
        timedOut ? 'QUIZ_GENERATION_TIMEOUT' : 'QUIZ_REQUEST_INVALID',
        timedOut ? 504 : 499,
        timedOut
          ? 'Quá trình tạo đề vượt quá thời gian cho phép.'
          : 'Đã hủy yêu cầu tạo đề.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}

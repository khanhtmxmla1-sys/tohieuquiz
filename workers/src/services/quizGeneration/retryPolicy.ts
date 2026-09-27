export type QuizProviderStageCode =
  | 'AI_KEY_INVALID'
  | 'AI_PROVIDER_ACCOUNT_REQUIRED'
  | 'AI_PROVIDER_QUOTA'
  | 'AI_PROVIDER_REQUEST_REJECTED'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_PROVIDER_TIMEOUT'
  | 'AI_PROVIDER_RESPONSE_INVALID'
  | 'AI_CAPABILITY_UNSUPPORTED';

export type QuizProviderName = 'system-gateway' | 'gemini' | 'deepseek';
export type QuizProviderFailurePhase =
  | 'validation'
  | 'redirect'
  | 'upstream'
  | 'network'
  | 'timeout'
  | 'response-size'
  | 'response-json'
  | 'response-content';

export interface QuizProviderDiagnostic {
  provider: QuizProviderName;
  phase?: QuizProviderFailurePhase;
  upstreamStatus?: number;
}

const ERROR_MESSAGES: Record<QuizProviderStageCode, string> = {
  AI_KEY_INVALID: 'API key không hợp lệ.',
  AI_PROVIDER_ACCOUNT_REQUIRED: 'Tài khoản hoặc dự án AI chưa đủ quyền hoặc chưa sẵn sàng.',
  AI_PROVIDER_QUOTA: 'Nhà cung cấp AI đang giới hạn hoặc đã hết hạn mức.',
  AI_PROVIDER_REQUEST_REJECTED: 'Nhà cung cấp AI từ chối yêu cầu tạo đề.',
  AI_PROVIDER_UNAVAILABLE: 'Nhà cung cấp AI tạm thời không khả dụng.',
  AI_PROVIDER_TIMEOUT: 'Nhà cung cấp AI phản hồi quá thời gian.',
  AI_PROVIDER_RESPONSE_INVALID: 'Nhà cung cấp AI trả về kết quả không hợp lệ.',
  AI_CAPABILITY_UNSUPPORTED: 'Nguồn AI không hỗ trợ yêu cầu này.',
};

export class QuizProviderStageError extends Error {
  readonly provider: QuizProviderName;
  readonly phase?: QuizProviderFailurePhase;
  readonly upstreamStatus?: number;
  attempts = 1;

  constructor(
    public readonly code: QuizProviderStageCode,
    diagnostic: QuizProviderDiagnostic,
  ) {
    super(ERROR_MESSAGES[code]);
    this.name = 'QuizProviderStageError';
    this.provider = diagnostic.provider;
    this.phase = diagnostic.phase;
    this.upstreamStatus = diagnostic.upstreamStatus;
  }
}

export interface QuizProviderTransientDiagnostic {
  code: QuizProviderStageCode;
  phase?: QuizProviderFailurePhase;
  upstreamStatus?: number;
}

export type RetrySleep = (delayMs: number, signal?: AbortSignal) => Promise<void>;

const RETRY_DELAYS_MS = [500, 1500] as const;
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

const createAbortError = (): Error => {
  try {
    return new DOMException('Aborted', 'AbortError');
  } catch {
    const error = new Error('Aborted');
    error.name = 'AbortError';
    return error;
  }
};

const defaultSleep: RetrySleep = (delayMs, signal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) {
    reject(createAbortError());
    return;
  }

  function onAbort() {
    clearTimeout(timeoutId);
    reject(createAbortError());
  }

  const timeoutId = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort);
    resolve();
  }, delayMs);
  signal?.addEventListener('abort', onAbort, { once: true });
});

export function isRetryableQuizProviderError(error: unknown): error is QuizProviderStageError {
  if (!(error instanceof QuizProviderStageError)) return false;
  if (error.phase === 'network') return true;
  return error.upstreamStatus !== undefined && RETRYABLE_STATUSES.has(error.upstreamStatus);
}

export async function retryTransientProviderOperation<T>(
  operation: (attempt: number) => Promise<T>,
  options: {
    signal?: AbortSignal;
    sleep?: RetrySleep;
  } = {},
): Promise<{
  value: T;
  attempts: number;
  lastTransientError?: QuizProviderTransientDiagnostic;
}> {
  const sleep = options.sleep ?? defaultSleep;
  let lastTransientError: QuizProviderTransientDiagnostic | undefined;

  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt += 1) {
    if (options.signal?.aborted) throw createAbortError();

    try {
      return {
        value: await operation(attempt),
        attempts: attempt,
        lastTransientError,
      };
    } catch (error) {
      if (options.signal?.aborted) throw createAbortError();
      if (!isRetryableQuizProviderError(error) || attempt > RETRY_DELAYS_MS.length) {
        if (error instanceof QuizProviderStageError) error.attempts = attempt;
        throw error;
      }

      lastTransientError = {
        code: error.code,
        phase: error.phase,
        upstreamStatus: error.upstreamStatus,
      };
      await sleep(RETRY_DELAYS_MS[attempt - 1], options.signal);
    }
  }

  throw new Error('Unreachable retry state');
}

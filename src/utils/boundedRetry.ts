export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  sleep?: (delayMs: number) => Promise<void>;
  random?: () => number;
}

const defaultSleep = (delayMs: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, delayMs);
});

export const retryWithBackoff = async <T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> => {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 3));
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 300);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 2_000);
  const jitterRatio = Math.min(1, Math.max(0, options.jitterRatio ?? 0.2));
  const shouldRetry = options.shouldRetry ?? (() => true);
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error, attempt)) throw error;
      const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * (2 ** (attempt - 1)));
      const jitter = exponentialDelay * jitterRatio * ((random() * 2) - 1);
      await sleep(Math.max(0, Math.round(exponentialDelay + jitter)));
    }
  }

  throw lastError;
};

export const createIdempotencyKey = (scope: string): string => {
  const normalizedScope = scope.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 48) || 'request';
  const randomPart = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  return `${normalizedScope}:${randomPart}`;
};

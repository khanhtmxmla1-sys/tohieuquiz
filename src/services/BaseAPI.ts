import { logger } from './logger';

interface RetryOptions {
    maxRetries?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    retryOn?: (error: any) => boolean;
}

interface RequestOptions extends RequestInit {
    timeout?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
    retryOn: () => true
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if error is retryable (network errors, 5xx, rate limits)
 */
const isRetryableError = (error: any, response?: Response): boolean => {
    // Network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
        return true;
    }

    // Rate limits (429) or server errors (5xx)
    if (response) {
        return response.status === 429 || (response.status >= 500 && response.status < 600);
    }

    return false;
};

/**
 * Base API Service with retry logic, timeout, and error handling
 */
export class BaseAPI {
    private baseUrl: string;
    private defaultHeaders: Record<string, string>;

    constructor(baseUrl: string = '', defaultHeaders: Record<string, string> = {}) {
        this.baseUrl = baseUrl;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            ...defaultHeaders
        };
    }

    /**
     * Fetch with retry logic
     */
    async fetchWithRetry<T>(
        url: string,
        options: RequestOptions = {},
        retryOptions: RetryOptions = {}
    ): Promise<T> {
        const { maxRetries, delayMs, backoffMultiplier, retryOn } = {
            ...DEFAULT_RETRY_OPTIONS,
            ...retryOptions
        };

        const fullUrl = this.baseUrl ? `${this.baseUrl}${url}` : url;
        const timeout = options.timeout || 30000;

        let lastError: any;
        let attempt = 0;

        while (attempt <= maxRetries) {
            attempt++;

            try {
                logger.api.request(fullUrl, { attempt, method: options.method || 'GET' });

                // Create abort controller for timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(fullUrl, {
                    ...options,
                    headers: {
                        ...this.defaultHeaders,
                        ...options.headers
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                // Check for error responses
                if (!response.ok) {
                    if (isRetryableError(null, response) && attempt <= maxRetries && retryOn(response)) {
                        const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
                        logger.warn(`Retry ${attempt}/${maxRetries} after ${delay}ms`, { module: 'API' });
                        await sleep(delay);
                        continue;
                    }

                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                logger.api.response(fullUrl, { status: response.status });
                return data as T;

            } catch (error: unknown) {
                const normalizedError = error instanceof Error ? error : new Error(String(error));
                lastError = error;

                // Don't retry on abort (timeout)
                if (normalizedError.name === 'AbortError') {
                    logger.error(`Request timeout: ${fullUrl}`, { module: 'API' });
                    throw new Error(`Request timeout after ${timeout}ms`);
                }

                // Check if should retry
                if (attempt <= maxRetries && isRetryableError(error) && retryOn(error)) {
                    const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
                    logger.warn(`Retry ${attempt}/${maxRetries} after ${delay}ms: ${normalizedError.message}`, { module: 'API' });
                    await sleep(delay);
                    continue;
                }

                logger.api.error(fullUrl, error);
                throw error;
            }
        }

        throw lastError;
    }

    /**
     * GET request
     */
    async get<T>(url: string, options?: RequestOptions, retryOptions?: RetryOptions): Promise<T> {
        return this.fetchWithRetry<T>(url, { ...options, method: 'GET' }, retryOptions);
    }

    /**
     * POST request
     */
    async post<T>(url: string, body: any, options?: RequestOptions, retryOptions?: RetryOptions): Promise<T> {
        return this.fetchWithRetry<T>(url, {
            ...options,
            method: 'POST',
            body: JSON.stringify(body)
        }, retryOptions);
    }

    /**
     * PUT request
     */
    async put<T>(url: string, body: any, options?: RequestOptions, retryOptions?: RetryOptions): Promise<T> {
        return this.fetchWithRetry<T>(url, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(body)
        }, retryOptions);
    }

    /**
     * DELETE request
     */
    async delete<T>(url: string, options?: RequestOptions, retryOptions?: RetryOptions): Promise<T> {
        return this.fetchWithRetry<T>(url, { ...options, method: 'DELETE' }, retryOptions);
    }
}

// Default API client instance
export const googleSheetsApi = new BaseAPI();

// Export for convenience
export default BaseAPI;

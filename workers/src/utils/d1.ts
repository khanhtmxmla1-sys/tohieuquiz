const TRANSIENT_D1_PATTERNS = [
    'D1_ERROR',
    'storage operation exceeded timeout',
    'caused object to be reset',
    'database is locked',
];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const isTransientD1Error = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error || '');
    return TRANSIENT_D1_PATTERNS.some((pattern) => message.includes(pattern));
};

export async function withD1Retry<T>(
    operation: () => Promise<T>,
    label: string,
    attempts = 2
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (!isTransientD1Error(error) || attempt === attempts) break;

            console.warn(`[D1 retry] ${label} failed on attempt ${attempt}; retrying`, error);
            await sleep(80 * attempt);
        }
    }

    throw lastError;
}

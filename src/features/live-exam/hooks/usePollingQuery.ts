import { useCallback, useEffect, useRef, useState } from 'react';

interface UsePollingQueryOptions<TData> {
    enabled?: boolean;
    intervalMs: number;
    fetcher: () => Promise<TData>;
    shouldPoll?: (data: TData | null) => boolean;
    errorLabel: string;
    fallbackError: string;
}

interface UsePollingQueryReturn<TData> {
    data: TData | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
};

const MAX_BACKOFF_MS = 30_000;

export function usePollingQuery<TData>({
    enabled = true,
    intervalMs,
    fetcher,
    shouldPoll = () => true,
    errorLabel,
    fallbackError,
}: UsePollingQueryOptions<TData>): UsePollingQueryReturn<TData> {
    const [data, setData] = useState<TData | null>(null);
    const [isLoading, setIsLoading] = useState(enabled);
    const [error, setError] = useState<string | null>(null);
    const dataRef = useRef<TData | null>(null);
    const requestSeqRef = useRef(0);
    const shouldPollRef = useRef(shouldPoll);
    const mountedRef = useRef(true);

    useEffect(() => {
        shouldPollRef.current = shouldPoll;
    }, [shouldPoll]);

    const runFetch = useCallback(async ({ showLoading = false }: { showLoading?: boolean } = {}): Promise<boolean> => {
        if (!enabled) return false;
        if (showLoading) setIsLoading(true);
        const requestSequence = ++requestSeqRef.current;

        try {
            const result = await fetcher();
            if (!mountedRef.current || requestSequence !== requestSeqRef.current) return false;
            dataRef.current = result;
            setData(result);
            setError(null);
            setIsLoading(false);
            return true;
        } catch (err) {
            console.error(errorLabel, err);
            if (!mountedRef.current || requestSequence !== requestSeqRef.current) return false;
            setError(getErrorMessage(err, fallbackError));
            setIsLoading(false);
            return false;
        }
    }, [enabled, errorLabel, fallbackError, fetcher]);

    useEffect(() => {
        mountedRef.current = true;
        let stopped = false;
        let timer: number | undefined;
        let nextDelay = intervalMs;

        const clearTimer = () => {
            if (timer !== undefined) window.clearTimeout(timer);
            timer = undefined;
        };

        const schedule = (delay: number) => {
            clearTimer();
            if (stopped || !enabled || document.visibilityState === 'hidden') return;
            timer = window.setTimeout(() => void cycle(false), delay);
        };

        const cycle = async (showLoading: boolean) => {
            if (stopped || !enabled || document.visibilityState === 'hidden') return;
            const succeeded = await runFetch({ showLoading });
            if (stopped || !enabled) return;
            nextDelay = succeeded ? intervalMs : Math.min(MAX_BACKOFF_MS, Math.max(intervalMs, nextDelay * 2));
            if (shouldPollRef.current(dataRef.current)) schedule(nextDelay);
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                clearTimer();
                return;
            }
            nextDelay = intervalMs;
            void cycle(false);
        };

        if (!enabled) {
            setIsLoading(false);
            return () => {
                stopped = true;
                mountedRef.current = false;
            };
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);
        void cycle(dataRef.current === null);

        return () => {
            stopped = true;
            mountedRef.current = false;
            requestSeqRef.current += 1;
            clearTimer();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [enabled, intervalMs, runFetch]);

    const refetch = useCallback(async () => {
        await runFetch({ showLoading: true });
    }, [runFetch]);

    return { data, isLoading, error, refetch };
}

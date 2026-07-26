/**
 * useLiveExamStatus Hook
 *
 * Polls live exam session status every 3 seconds.
 * Used by students to track session state and timer.
 *
 * Related: ADR-0001 (Polling)
 */

import { useCallback } from 'react';
import type { LiveExamStatusResponse } from '../../../types/liveExam.types';
import { getSessionStatus } from '../../../services/liveExamService';
import { usePollingQuery } from './usePollingQuery';

const POLL_INTERVAL = 3000; // 3 seconds
interface UseLiveExamStatusOptions {
    sessionId: string;
    enabled?: boolean; // Allow pausing polling
}

interface UseLiveExamStatusReturn {
    status: LiveExamStatusResponse | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useLiveExamStatus({
    sessionId,
    enabled = true,
}: UseLiveExamStatusOptions): UseLiveExamStatusReturn {
    const fetchStatus = useCallback(() => getSessionStatus(sessionId), [sessionId]);
    const shouldPoll = useCallback((data: LiveExamStatusResponse | null) => {
        return data?.session?.status !== 'closed';
    }, []);

    const {
        data: status,
        isLoading,
        error,
        refetch,
    } = usePollingQuery<LiveExamStatusResponse>({
        enabled,
        intervalMs: POLL_INTERVAL,
        fetcher: fetchStatus,
        shouldPoll,
        errorLabel: '[useLiveExamStatus] Error:',
        fallbackError: 'Failed to fetch status',
    });

    return {
        status,
        isLoading,
        error,
        refetch,
    };
}

/**
 * useLiveExamParticipants Hook
 *
 * Polls live exam participants every 3 seconds.
 * Used by teachers to monitor student progress.
 *
 * Related: ADR-0001 (Polling)
 */

import { useCallback } from 'react';
import type { LiveExamParticipantsResponse } from '../../../types/liveExam.types';
import { getParticipants as fetchLiveExamParticipants } from '../../../services/liveExamService';
import { usePollingQuery } from './usePollingQuery';

const POLL_INTERVAL = 3000; // 3 seconds
interface UseLiveExamParticipantsOptions {
    sessionId: string;
    enabled?: boolean;
}

interface UseLiveExamParticipantsReturn {
    participants: LiveExamParticipantsResponse['participants'];
    totalCount: number;
    submittedCount: number;
    onlineCount: number;
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useLiveExamParticipants({
    sessionId,
    enabled = true,
}: UseLiveExamParticipantsOptions): UseLiveExamParticipantsReturn {
    const fetchParticipants = useCallback(() => fetchLiveExamParticipants(sessionId), [sessionId]);

    const {
        data,
        isLoading,
        error,
        refetch,
    } = usePollingQuery<LiveExamParticipantsResponse>({
        enabled,
        intervalMs: POLL_INTERVAL,
        fetcher: fetchParticipants,
        errorLabel: '[useLiveExamParticipants] Error:',
        fallbackError: 'Failed to fetch participants',
    });

    return {
        participants: data?.participants || [],
        totalCount: data?.totalCount || 0,
        submittedCount: data?.submittedCount || 0,
        onlineCount: data?.onlineCount || 0,
        isLoading,
        error,
        refetch,
    };
}

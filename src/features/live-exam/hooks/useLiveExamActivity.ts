/**
 * useLiveExamActivity Hook
 *
 * Sends activity updates to track student progress.
 * Updates are sent with every status poll (every 3 seconds).
 *
 * Related: ADR-0001 (Polling)
 */

import { useState, useCallback } from 'react';
import { updateActivity as sendActivityUpdate } from '../../../services/liveExamService';

interface ActivityData {
    currentQuestion?: number;
    answeredCount: number;
}

interface UseLiveExamActivityOptions {
    sessionId: string;
}

interface UseLiveExamActivityReturn {
    updateActivity: (data: ActivityData) => Promise<void>;
    isUpdating: boolean;
    error: string | null;
}

export function useLiveExamActivity({
    sessionId,
}: UseLiveExamActivityOptions): UseLiveExamActivityReturn {
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const updateActivity = useCallback(
        async (data: ActivityData) => {
            setIsUpdating(true);
            setError(null);

            try {
                await sendActivityUpdate(sessionId, data);
            } catch (err: any) {
                console.error('[useLiveExamActivity] Error:', err);
                setError(err.message || 'Failed to update activity');
            } finally {
                setIsUpdating(false);
            }
        },
        [sessionId]
    );

    return {
        updateActivity,
        isUpdating,
        error,
    };
}

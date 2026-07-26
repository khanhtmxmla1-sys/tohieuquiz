/**
 * Custom hook for Live Exam Analytics
 * Handles data fetching, polling, and caching
 */

import { useCallback } from 'react';
import { fetchAnalytics, SessionAnalytics } from '../../../services/liveExamAnalyticsService';
import { usePollingQuery } from './usePollingQuery';

interface UseLiveExamAnalyticsOptions {
  sessionId: string;
  enabled?: boolean;
  pollingInterval?: number; // milliseconds
}

interface UseLiveExamAnalyticsReturn {
  analytics: SessionAnalytics | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useLiveExamAnalytics({
  sessionId,
  enabled = true,
  pollingInterval = 5000, // 5 seconds
}: UseLiveExamAnalyticsOptions): UseLiveExamAnalyticsReturn {
  const fetchData = useCallback(() => fetchAnalytics(sessionId), [sessionId]);
  const shouldPoll = useCallback((analytics: SessionAnalytics | null) => {
    if (!analytics) return true;

    return analytics.session.status === 'active'
      || analytics.progress.submittedCount < analytics.progress.totalParticipants;
  }, []);

  const {
    data: analytics,
    isLoading,
    error,
    refetch,
  } = usePollingQuery<SessionAnalytics>({
    enabled: enabled && Boolean(sessionId),
    intervalMs: pollingInterval,
    fetcher: fetchData,
    shouldPoll,
    errorLabel: 'Failed to fetch analytics:',
    fallbackError: 'Failed to fetch analytics',
  });

  return {
    analytics,
    isLoading,
    error,
    refetch,
  };
}

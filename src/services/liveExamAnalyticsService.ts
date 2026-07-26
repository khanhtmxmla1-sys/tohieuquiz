/**
 * Live Exam Analytics Service
 * Frontend service for fetching and tracking analytics data
 */

import { fetchWithJWTInterceptor } from '../utils/jwtInterceptor';
import { getWorkersApiBaseUrl } from './api/config';

export interface SessionAnalytics {
  session: {
    id: string;
    title: string;
    status: string;
    totalQuestions: number;
  };
  progress: {
    totalParticipants: number;
    submittedCount: number;
    submittedPercentage: number;
    notSubmittedStudents: Array<{
      username: string;
      joinedAt: string;
    }>;
  };
  scores: {
    distribution: Array<{
      range: string;
      count: number;
      percentage: number;
    }>;
    average: number;
    median: number;
    min: number;
    max: number;
    standardDeviation: number;
  };
  questions: Array<{
    questionIndex: number;
    questionText: string;
    correctRate: number;
    incorrectRate: number;
    avgTimeSeconds: number | null;
    minTimeSeconds: number | null;
    maxTimeSeconds: number | null;
  }>;
  topDifficultQuestions: Array<{
    questionIndex: number;
    questionText: string;
    correctRate: number;
    incorrectCount: number;
  }>;
}

/**
 * Fetch comprehensive analytics for a session
 */
export async function fetchAnalytics(sessionId: string): Promise<SessionAnalytics> {
  const response = await fetchWithJWTInterceptor(`${getWorkersApiBaseUrl()}/api/live-exam/${sessionId}/analytics`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch analytics' }));
    throw new Error(error.message || error.error || 'Failed to fetch analytics');
  }

  const data = await response.json();
  return data.analytics;
}

/**
 * Track time spent on a question (single)
 */
export async function trackQuestionTiming(
  sessionId: string,
  questionIndex: number,
  timeSpentSeconds: number
): Promise<void> {
  const response = await fetchWithJWTInterceptor(`${getWorkersApiBaseUrl()}/api/live-exam/${sessionId}/track-timing`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      questionIndex,
      timeSpentSeconds,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to track timing' }));
    throw new Error(error.message || error.error || 'Failed to track timing');
  }
}

/**
 * Track time spent on multiple questions (batch)
 */
export async function batchTrackQuestionTiming(
  sessionId: string,
  timings: Array<{ questionIndex: number; timeSpentSeconds: number }>
): Promise<void> {
  const response = await fetchWithJWTInterceptor(`${getWorkersApiBaseUrl()}/api/live-exam/${sessionId}/track-timing`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timings,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to track timing' }));
    throw new Error(error.message || error.error || 'Failed to track timing');
  }
}

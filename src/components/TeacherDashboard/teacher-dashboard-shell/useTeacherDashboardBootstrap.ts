import { useCallback, useEffect, useState } from 'react';
import type { ResultDashboardSummary } from '../../../../shared/result-summary.contract';
import { useQuizStore } from '../../../../stores/quizStore';
import { fetchResultDashboardSummary } from '../../../services/resultSummaryService';
import type { ResultsLoadState } from './types';

const getErrorMessage = (error: unknown): string => (
  error instanceof Error && error.message
    ? error.message
    : 'Không thể tải số liệu tổng quan.'
);

export const useTeacherDashboardBootstrap = () => {
  const loadQuizzes = useQuizStore((state) => state.loadQuizzes);
  const [resultsLoadState, setResultsLoadState] = useState<ResultsLoadState>('loading');
  const [resultsLoadError, setResultsLoadError] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<ResultDashboardSummary | null>(null);
  const [summaryLoadState, setSummaryLoadState] = useState<ResultsLoadState>('loading');
  const [summaryLoadError, setSummaryLoadError] = useState<string | null>(null);

  const loadTeacherResults = useCallback(async () => {
    setResultsLoadState('loading');
    setResultsLoadError(null);
    setSummaryLoadState('loading');
    setSummaryLoadError(null);
    useQuizStore.getState().setError(null);

    const [, summaryResult] = await Promise.allSettled([
      useQuizStore.getState().loadResults(),
      fetchResultDashboardSummary(),
    ]);

    const loadError = useQuizStore.getState().error;
    if (loadError) {
      setResultsLoadState('error');
      setResultsLoadError(loadError);
    } else {
      setResultsLoadState('success');
    }

    if (summaryResult.status === 'fulfilled') {
      setResultSummary(summaryResult.value);
      setSummaryLoadState('success');
    } else {
      setSummaryLoadState('error');
      setSummaryLoadError(getErrorMessage(summaryResult.reason));
    }
  }, []);

  useEffect(() => {
    void loadQuizzes();
    void loadTeacherResults();
  }, [loadQuizzes, loadTeacherResults]);

  return {
    resultsLoadState,
    resultsLoadError,
    resultSummary,
    summaryLoadState,
    summaryLoadError,
    loadTeacherResults,
  };
};

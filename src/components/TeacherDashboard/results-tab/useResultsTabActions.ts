import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import type { StudentResult } from '../../../types';
import { showError } from '../../../utils/toast';
import { useQuizStore } from '../../../../stores/quizStore';
import type { ResultsStatistics } from '../../../utils/statisticsUtils';
import { exportResultsCsv, exportResultsSummary } from './resultsExport';

export const useResultsTabActions = (
  filteredResults: StudentResult[],
  statistics: ResultsStatistics,
) => {
  const navigate = useNavigate();
  const [isNavigatingDetail, setIsNavigatingDetail] = useState(false);
  const viewDetail = useCallback((result: StudentResult) => {
    setIsNavigatingDetail(true);
    navigate(`/teacher/results/${encodeURIComponent(String(result.id))}`);
  }, [navigate]);
  const deleteResult = useCallback(async (result: StudentResult) => {
    try {
      await useQuizStore.getState().removeResult(result.id);
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      showError(`Loi: ${normalized.message}`);
    }
  }, []);

  return {
    isNavigatingDetail,
    viewDetail,
    deleteResult,
    exportCsv: () => exportResultsCsv(filteredResults),
    exportSummary: () => exportResultsSummary(statistics),
  };
};

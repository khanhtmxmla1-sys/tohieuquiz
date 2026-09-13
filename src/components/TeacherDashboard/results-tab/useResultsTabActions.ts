import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Quiz, StudentResult } from '../../../types';
import { showError } from '../../../utils/toast';
import { useQuizStore } from '../../../../stores/quizStore';
import { fetchResultAnswersBulk } from '../../../services/results/resultAnswersService';
import type { ResultsStatistics } from '../../../utils/statisticsUtils';
import { calculateOverrideFromAnswers } from './resultAnswerOverride';
import {
  exportLatestResultsXlsx,
  exportResultsCsv,
  exportResultsSummary,
  selectLatestResults,
} from './resultsExport';

export const useResultsTabActions = (
  filteredResults: StudentResult[],
  statistics: ResultsStatistics,
  quizzes: Quiz[],
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
  const exportLatestScores = useCallback(async () => {
    try {
      const latestResults = selectLatestResults(filteredResults);
      const answersById = await fetchResultAnswersBulk(latestResults.map(result => result.id));
      const exportResults = latestResults.map(result => {
        const quiz = quizzes.find(item => String(item.id) === String(result.quizId));
        const override = calculateOverrideFromAnswers(
          result,
          answersById[String(result.id)] ?? {},
          quiz,
        );
        return override ? { ...result, ...override } : result;
      });
      await exportLatestResultsXlsx(exportResults);
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      showError(`Không thể xuất điểm mới nhất: ${normalized.message}`);
    }
  }, [filteredResults, quizzes]);

  return {
    isNavigatingDetail,
    viewDetail,
    deleteResult,
    exportCsv: () => exportResultsCsv(filteredResults),
    exportSummary: () => exportResultsSummary(statistics),
    exportLatestScores,
  };
};

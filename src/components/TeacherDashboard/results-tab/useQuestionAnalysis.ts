import { useEffect, useMemo, useState } from 'react';
import type { Quiz, StudentResult } from '../../../types';
import type { DateRange } from '../../teacher/ResultsView';
import { fetchResultAnswersBulk } from '../../../services/results/resultAnswersService';
import {
  analyzeQuestionDifficulty,
  type AnalysisAttemptMode,
} from '../../../utils/statisticsUtils';
import { buildAnalysisCohort, getSelectedQuizQuestions } from './resultsTabSelectors';
import { buildQuestionAnalysisInput, hydrateAnalysisResults } from './questionAnalysisData';

export const useQuestionAnalysis = (
  quizzes: Quiz[],
  filteredByClassResults: StudentResult[],
  activeQuizId: string,
  dateRange: DateRange,
) => {
  const [analysisAttemptMode, setAnalysisAttemptMode] = useState<AnalysisAttemptMode>('latest');
  const [analysisAnswers, setAnalysisAnswers] = useState<Record<string, Record<string, any>>>({});
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const selectedQuestions = useMemo(
    () => getSelectedQuizQuestions(quizzes, activeQuizId),
    [quizzes, activeQuizId],
  );
  const cohort = useMemo(() => buildAnalysisCohort(
    filteredByClassResults,
    activeQuizId,
    dateRange,
    analysisAttemptMode,
  ), [filteredByClassResults, activeQuizId, dateRange, analysisAttemptMode]);

  useEffect(() => {
    if (activeQuizId === 'all' || cohort.length === 0) {
      setIsLoadingAnalysis(false);
      setAnalysisError('');
      return;
    }
    const missingIds = cohort
      .filter(result => !Object.prototype.hasOwnProperty.call(analysisAnswers, String(result.id))
        && Object.keys(result.answers || {}).length === 0)
      .map(result => String(result.id));
    if (missingIds.length === 0) {
      setIsLoadingAnalysis(false);
      return;
    }

    let cancelled = false;
    setIsLoadingAnalysis(true);
    setAnalysisError('');
    fetchResultAnswersBulk(missingIds)
      .then(answersById => {
        if (cancelled) return;
        setAnalysisAnswers(previous => {
          const next = { ...previous };
          missingIds.forEach(resultId => { next[resultId] = answersById[resultId] ?? {}; });
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setAnalysisError('Không thể tải đáp án để phân tích. Vui lòng thử làm mới.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAnalysis(false);
      });
    return () => { cancelled = true; };
  }, [activeQuizId, cohort, analysisAnswers]);

  const hydratedResults = useMemo(() => hydrateAnalysisResults(
    cohort,
    analysisAnswers,
    new Set(selectedQuestions.map(question => question.id)),
  ), [cohort, analysisAnswers, selectedQuestions]);
  const analysis = useMemo(() => selectedQuestions.length && hydratedResults.length
    ? analyzeQuestionDifficulty(hydratedResults, buildQuestionAnalysisInput(selectedQuestions))
    : [], [hydratedResults, selectedQuestions]);

  return {
    analysis,
    cohortSize: hydratedResults.length,
    analysisAttemptMode,
    setAnalysisAttemptMode,
    isLoadingAnalysis,
    analysisError,
  };
};

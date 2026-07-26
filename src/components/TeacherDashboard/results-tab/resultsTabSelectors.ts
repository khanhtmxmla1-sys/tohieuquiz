import type { Quiz, Question, StudentResult } from '../../../types';
import type { DateRange } from '../../teacher/ResultsView';
import {
  filterResultsByDateRange,
  searchResultsByName,
  selectResultsForQuestionAnalysis,
  type AnalysisAttemptMode,
} from '../../../utils/statisticsUtils';

export const filterResultsForDisplay = (
  baseResults: StudentResult[],
  dateRange: DateRange,
  searchName: string,
  activeQuizId: string,
): StudentResult[] => {
  let filtered = baseResults;
  if (dateRange.startDate || dateRange.endDate) {
    filtered = filterResultsByDateRange(
      filtered,
      dateRange.startDate ?? undefined,
      dateRange.endDate ?? undefined,
    );
  }
  if (searchName.trim()) filtered = searchResultsByName(filtered, searchName);
  if (activeQuizId !== 'all') filtered = filtered.filter(result => result.quizId === activeQuizId);
  return filtered;
};

export const buildAnalysisCohort = (
  baseResults: StudentResult[],
  activeQuizId: string,
  dateRange: DateRange,
  attemptMode: AnalysisAttemptMode,
): StudentResult[] => {
  if (activeQuizId === 'all') return [];
  let cohort = baseResults.filter(result => result.quizId === activeQuizId);
  if (dateRange.startDate || dateRange.endDate) {
    cohort = filterResultsByDateRange(
      cohort,
      dateRange.startDate ?? undefined,
      dateRange.endDate ?? undefined,
    );
  }
  return selectResultsForQuestionAnalysis(cohort, attemptMode);
};

export const getAvailableQuizzes = (results: StudentResult[], quizzes: Quiz[]) => {
  const quizMap = new Map<string, { id: string; title: string }>();
  results.forEach(result => {
    if (quizMap.has(result.quizId)) return;
    const quiz = quizzes.find(item => item.id === result.quizId);
    quizMap.set(result.quizId, {
      id: result.quizId,
      title: quiz?.title || result.quizTitle || 'Unknown Quiz',
    });
  });
  return Array.from(quizMap.values());
};

export const getSelectedQuizQuestions = (
  quizzes: Quiz[],
  activeQuizId: string,
): Question[] => activeQuizId === 'all'
  ? []
  : quizzes.find(quiz => quiz.id === activeQuizId)?.questions || [];

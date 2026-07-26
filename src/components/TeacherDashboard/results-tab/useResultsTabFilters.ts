import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Quiz, StudentResult } from '../../../types';
import { useResults } from '../../../hooks';
import type { DateRange } from '../../teacher/ResultsView';
import { calculateResultsStatistics } from '../../../utils/statisticsUtils';
import { filterResultsForDisplay, getAvailableQuizzes } from './resultsTabSelectors';

export const PAGE_SIZE = 5;

export const useResultsTabFilters = (
  results: StudentResult[],
  quizzes: Quiz[],
  onRefresh?: () => Promise<StudentResult[]>,
) => {
  const resultsHook = useResults({ results, onRefresh });
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null, label: 'Tất cả' });
  const [searchName, setSearchName] = useState('');
  const [activeQuizId, setActiveQuizId] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredResults = useMemo(() => filterResultsForDisplay(
    resultsHook.filteredResults,
    dateRange,
    searchName,
    activeQuizId,
  ), [resultsHook.filteredResults, dateRange, searchName, activeQuizId]);
  const totalPages = Math.max(1, Math.ceil(filteredResults.length / PAGE_SIZE));
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredResults.slice(start, start + PAGE_SIZE);
  }, [filteredResults, currentPage]);

  useEffect(() => setCurrentPage(1), [
    dateRange,
    searchName,
    activeQuizId,
    resultsHook.filterClass,
    resultsHook.sortField,
    resultsHook.sortOrder,
  ]);
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const resetFilters = useCallback(() => {
    setDateRange({ startDate: null, endDate: null, label: 'Tất cả' });
    setSearchName('');
    setActiveQuizId('all');
  }, []);

  return {
    resultsHook,
    dateRange,
    setDateRange,
    searchName,
    setSearchName,
    activeQuizId,
    setActiveQuizId,
    currentPage,
    setCurrentPage,
    filteredResults,
    paginatedResults,
    totalPages,
    statistics: useMemo(() => calculateResultsStatistics(filteredResults), [filteredResults]),
    availableQuizzes: useMemo(() => getAvailableQuizzes(results, quizzes), [results, quizzes]),
    resetFilters,
  };
};

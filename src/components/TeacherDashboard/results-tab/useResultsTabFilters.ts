import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { Quiz, StudentResult } from '../../../types';
import { useResults } from '../../../hooks';
import type { DateRange } from '../../teacher/ResultsView';
import { calculateResultsStatistics } from '../../../utils/statisticsUtils';
import { filterResultsForDisplay, getAvailableQuizzes } from './resultsTabSelectors';
import { systemDateKeyToLabelDate } from '../../../utils/dateTime';

export const PAGE_SIZE = 5;

const parseDateParam = (value: string | null): Date | null => {
  if (!value) return null;
  try { return systemDateKeyToLabelDate(value); } catch { return null; }
};

const formatDateParam = (value: Date | null): string | null => {
  if (!value || Number.isNaN(value.getTime())) return null;
  return value.toISOString().slice(0, 10);
};

const parsePage = (value: string | null): number => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

export const useResultsTabFilters = (
  results: StudentResult[],
  quizzes: Quiz[],
  onRefresh?: () => Promise<StudentResult[]>,
) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const resultsHook = useResults({ results, onRefresh });
  const dateRange = useMemo<DateRange>(() => ({
    startDate: parseDateParam(searchParams.get('from')),
    endDate: parseDateParam(searchParams.get('to')),
    label: searchParams.get('range') || 'Tất cả',
  }), [searchParams]);
  const searchName = searchParams.get('q') || '';
  const activeQuizId = searchParams.get('quiz') || 'all';
  const currentPage = parsePage(searchParams.get('page'));

  const updateParams = useCallback((
    updates: Record<string, string | null>,
    options: { replace?: boolean; resetPage?: boolean } = {},
  ) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(updates).forEach(([name, value]) => {
        if (value) next.set(name, value);
        else next.delete(name);
      });
      if (options.resetPage !== false) next.delete('page');
      return next;
    }, { replace: options.replace ?? true });
  }, [setSearchParams]);

  const setDateRange = useCallback((range: DateRange) => {
    updateParams({
      from: formatDateParam(range.startDate),
      to: formatDateParam(range.endDate),
      range: range.label === 'Tất cả' ? null : range.label,
    });
  }, [updateParams]);
  const setSearchName = useCallback((value: string) => {
    updateParams({ q: value.trim() || null });
  }, [updateParams]);
  const setActiveQuizId = useCallback((value: string) => {
    updateParams({ quiz: value === 'all' ? null : value });
  }, [updateParams]);
  const setCurrentPage = useCallback((page: number) => {
    updateParams({ page: page > 1 ? String(page) : null }, { replace: false, resetPage: false });
  }, [updateParams]);

  const filteredResults = useMemo(() => filterResultsForDisplay(
    resultsHook.filteredResults,
    dateRange,
    searchName,
    activeQuizId,
  ), [resultsHook.filteredResults, dateRange, searchName, activeQuizId]);
  const totalPages = Math.max(1, Math.ceil(filteredResults.length / PAGE_SIZE));
  const effectivePage = Math.min(currentPage, totalPages);
  const paginatedResults = useMemo(() => {
    const start = (effectivePage - 1) * PAGE_SIZE;
    return filteredResults.slice(start, start + PAGE_SIZE);
  }, [filteredResults, effectivePage]);

  useEffect(() => {
    if (results.length > 0 && currentPage > totalPages) {
      updateParams({ page: totalPages > 1 ? String(totalPages) : null }, { replace: true, resetPage: false });
    }
  }, [currentPage, results.length, totalPages, updateParams]);

  const resetFilters = useCallback(() => {
    updateParams({ q: null, quiz: null, class: null, from: null, to: null, range: null });
  }, [updateParams]);
  const clearInterventionFilters = useCallback(() => {
    updateParams({ quiz: null, class: null });
  }, [updateParams]);

  return {
    resultsHook,
    dateRange,
    setDateRange,
    searchName,
    setSearchName,
    activeQuizId,
    setActiveQuizId,
    currentPage: effectivePage,
    setCurrentPage,
    filteredResults,
    paginatedResults,
    totalPages,
    statistics: useMemo(() => calculateResultsStatistics(filteredResults), [filteredResults]),
    availableQuizzes: useMemo(() => getAvailableQuizzes(results, quizzes), [results, quizzes]),
    resetFilters,
    clearInterventionFilters,
  };
};

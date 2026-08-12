import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InterventionDashboard } from '../../../../../shared/intervention.contract';
import { getInterventionDashboard } from '../../../../services/results/interventionService';

export interface InterventionDashboardFilters {
  className?: string;
  quizId?: string;
}

export interface UseInterventionDashboardOptions {
  classNameFilter: string;
  quizId: string;
  isOnline: boolean;
}

export const useInterventionDashboard = ({
  classNameFilter,
  quizId,
  isOnline,
}: UseInterventionDashboardOptions) => {
  const filters = useMemo<InterventionDashboardFilters>(() => ({
    className: classNameFilter && classNameFilter !== 'All' ? classNameFilter : undefined,
    quizId: quizId && quizId !== 'all' ? quizId : undefined,
  }), [classNameFilter, quizId]);
  const scopeKey = `${filters.className || '*'}::${filters.quizId || '*'}`;
  const [dashboard, setDashboardState] = useState<InterventionDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isStale, setIsStale] = useState(false);
  const sequenceRef = useRef(0);
  const dashboardRef = useRef<InterventionDashboard | null>(null);
  const dashboardScopeRef = useRef('');
  const activeScopeRef = useRef(scopeKey);

  const setDashboard = useCallback((value: InterventionDashboard | null, key: string) => {
    dashboardRef.current = value;
    dashboardScopeRef.current = value ? key : '';
    setDashboardState(value);
  }, []);

  const reload = useCallback(async (): Promise<InterventionDashboard | null> => {
    if (!isOnline) return null;
    const requestSequence = ++sequenceRef.current;
    setIsLoading(true);
    setError('');

    try {
      const nextDashboard = await getInterventionDashboard(filters);
      if (requestSequence !== sequenceRef.current) return null;
      setDashboard(nextDashboard, scopeKey);
      setIsStale(false);
      return nextDashboard;
    } catch (loadError) {
      if (requestSequence !== sequenceRef.current) return null;
      const normalized = loadError instanceof Error ? loadError : new Error(String(loadError));
      setError(normalized.message || 'Không thể tải nhóm hỗ trợ.');
      setIsStale(Boolean(dashboardRef.current && dashboardScopeRef.current === scopeKey));
      return null;
    } finally {
      if (requestSequence === sequenceRef.current) setIsLoading(false);
    }
  }, [filters, isOnline, scopeKey, setDashboard]);

  useEffect(() => {
    const scopeChanged = activeScopeRef.current !== scopeKey;
    activeScopeRef.current = scopeKey;

    if (scopeChanged && dashboardScopeRef.current !== scopeKey) {
      sequenceRef.current += 1;
      setDashboard(null, scopeKey);
      setError('');
      setIsStale(false);
    }

    if (!isOnline) {
      sequenceRef.current += 1;
      setIsLoading(false);
      setIsStale(Boolean(dashboardRef.current && dashboardScopeRef.current === scopeKey));
      return;
    }

    void reload();
  }, [isOnline, reload, scopeKey, setDashboard]);

  return {
    dashboard,
    filters,
    isLoading,
    error,
    isStale,
    reload,
  };
};

export default useInterventionDashboard;

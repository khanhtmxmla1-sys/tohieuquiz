/**
 * useResults Hook
 *
 * Custom hook for results viewing and filtering.
 * URL search params are the source of truth for shareable state.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { ApiError } from '../services/api/errors';
import { useOnlineStatus } from './useOnlineStatus';
import { StudentResult } from '../types';

export interface UseResultsProps {
    results: StudentResult[];
    onRefresh?: () => Promise<StudentResult[]>;
}

export interface UseResultsReturn {
    filteredResults: StudentResult[];
    filterClass: string;
    setFilterClass: (value: string) => void;
    sortField: 'score' | 'submittedAt';
    setSortField: (field: 'score' | 'submittedAt') => void;
    sortOrder: 'asc' | 'desc';
    setSortOrder: (order: 'asc' | 'desc') => void;
    isRefreshing: boolean;
    handleRefresh: () => Promise<void>;
    refreshError: string | null;
    isOnline: boolean;
    lastUpdatedAt: number | null;
    discardStaleData: boolean;
    stats: {
        total: number;
        average: number;
        highest: number;
        lowest: number;
        passCount: number;
        passRate: number;
    };
    availableClasses: string[];
}

export const useResults = ({ results, onRefresh }: UseResultsProps): UseResultsReturn => {
    const { isOnline } = useOnlineStatus();
    const [searchParams, setSearchParams] = useSearchParams();
    const filterClass = searchParams.get('class') || 'All';
    const sortField = searchParams.get('sort') === 'score' ? 'score' : 'submittedAt';
    const sortOrder = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshError, setRefreshError] = useState<string | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(() => (results.length > 0 ? Date.now() : null));
    const [discardStaleData, setDiscardStaleData] = useState(false);

    const updateParam = useCallback((name: string, value: string, defaultValue: string) => {
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            if (!value || value === defaultValue) next.delete(name);
            else next.set(name, value);
            next.delete('page');
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const setFilterClass = useCallback((value: string) => {
        updateParam('class', value, 'All');
    }, [updateParam]);
    const setSortField = useCallback((field: 'score' | 'submittedAt') => {
        updateParam('sort', field, 'submittedAt');
    }, [updateParam]);
    const setSortOrder = useCallback((order: 'asc' | 'desc') => {
        updateParam('order', order, 'desc');
    }, [updateParam]);

    useEffect(() => {
        if (results.length > 0 && !discardStaleData) setLastUpdatedAt(Date.now());
    }, [results, discardStaleData]);

    const safeResults = discardStaleData ? [] : results;
    const availableClasses = useMemo(() => {
        const classes = new Set(safeResults.map(result => result.studentClass));
        return Array.from(classes).sort();
    }, [safeResults]);

    const filteredResults = useMemo(() => {
        let filtered = [...safeResults];
        if (filterClass !== 'All') {
            filtered = filtered.filter(result => result.studentClass === filterClass);
        }
        filtered.sort((a, b) => {
            const comparison = sortField === 'score'
                ? a.score - b.score
                : new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
            return sortOrder === 'asc' ? comparison : -comparison;
        });
        return filtered;
    }, [safeResults, filterClass, sortField, sortOrder]);

    const stats = useMemo(() => {
        const total = filteredResults.length;
        if (total === 0) {
            return { total: 0, average: 0, highest: 0, lowest: 0, passCount: 0, passRate: 0 };
        }
        const scores = filteredResults.map(result => result.score);
        const sum = scores.reduce((totalScore, score) => totalScore + score, 0);
        const passCount = scores.filter(score => score >= 5).length;
        return {
            total,
            average: Math.round((sum / total) * 10) / 10,
            highest: Math.max(...scores),
            lowest: Math.min(...scores),
            passCount,
            passRate: Math.round((passCount / total) * 100),
        };
    }, [filteredResults]);

    const handleRefresh = useCallback(async () => {
        if (!onRefresh) return;
        if (!isOnline) {
            setRefreshError('Bạn đang ngoại tuyến. Kết quả gần nhất vẫn được giữ để xem.');
            return;
        }
        setIsRefreshing(true);
        setRefreshError(null);
        try {
            await onRefresh();
            setDiscardStaleData(false);
            setLastUpdatedAt(Date.now());
        } catch (error) {
            const accessDenied = error instanceof ApiError && (error.status === 401 || error.status === 403);
            if (accessDenied) {
                setDiscardStaleData(true);
                setLastUpdatedAt(null);
            }
            setRefreshError(error instanceof Error ? error.message : 'Không thể cập nhật kết quả. Vui lòng thử lại.');
        } finally {
            setIsRefreshing(false);
        }
    }, [isOnline, onRefresh]);

    return {
        filteredResults,
        filterClass,
        setFilterClass,
        sortField,
        setSortField,
        sortOrder,
        setSortOrder,
        isRefreshing,
        handleRefresh,
        refreshError,
        isOnline,
        lastUpdatedAt,
        discardStaleData,
        stats,
        availableClasses,
    };
};

export default useResults;

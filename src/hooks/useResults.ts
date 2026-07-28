/**
 * useResults Hook
 * 
 * Custom hook for results viewing and filtering.
 * Extracts state management from TeacherDashboard.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { ApiError } from '../services/api/errors';
import { useOnlineStatus } from './useOnlineStatus';
import { StudentResult } from '../types';

export interface UseResultsProps {
    results: StudentResult[];
    onRefresh?: () => Promise<StudentResult[]>;
}

export interface UseResultsReturn {
    // Filtered results
    filteredResults: StudentResult[];

    // Filters
    filterClass: string;
    setFilterClass: (value: string) => void;

    // Sorting
    sortField: 'score' | 'submittedAt';
    setSortField: (field: 'score' | 'submittedAt') => void;
    sortOrder: 'asc' | 'desc';
    setSortOrder: (order: 'asc' | 'desc') => void;

    // Refresh
    isRefreshing: boolean;
    handleRefresh: () => Promise<void>;
    refreshError: string | null;
    isOnline: boolean;
    lastUpdatedAt: number | null;
    discardStaleData: boolean;

    // Stats
    stats: {
        total: number;
        average: number;
        highest: number;
        lowest: number;
        passCount: number;
        passRate: number;
    };

    // Unique classes
    availableClasses: string[];
}

export const useResults = ({ results, onRefresh }: UseResultsProps): UseResultsReturn => {
    const { isOnline } = useOnlineStatus();
    const [filterClass, setFilterClass] = useState<string>('All');
    const [sortField, setSortField] = useState<'score' | 'submittedAt'>('submittedAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshError, setRefreshError] = useState<string | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(() => (results.length > 0 ? Date.now() : null));
    const [discardStaleData, setDiscardStaleData] = useState(false);

    useEffect(() => {
        if (results.length > 0 && !discardStaleData) setLastUpdatedAt(Date.now());
    }, [results, discardStaleData]);

    const safeResults = discardStaleData ? [] : results;

    // Get unique classes
    const availableClasses = useMemo(() => {
        const classes = new Set(safeResults.map(r => r.studentClass));
        return Array.from(classes).sort();
    }, [safeResults]);

    // Filter and sort results
    const filteredResults = useMemo(() => {
        let filtered = [...safeResults];

        // Apply class filter
        if (filterClass !== 'All') {
            filtered = filtered.filter(r => r.studentClass === filterClass);
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let comparison = 0;

            if (sortField === 'score') {
                comparison = a.score - b.score;
            } else {
                comparison = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return filtered;
    }, [safeResults, filterClass, sortField, sortOrder]);

    // Calculate stats
    const stats = useMemo(() => {
        const total = filteredResults.length;

        if (total === 0) {
            return {
                total: 0,
                average: 0,
                highest: 0,
                lowest: 0,
                passCount: 0,
                passRate: 0,
            };
        }

        const scores = filteredResults.map(r => r.score);
        const sum = scores.reduce((acc, s) => acc + s, 0);
        const passCount = scores.filter(s => s >= 5).length;

        return {
            total,
            average: Math.round((sum / total) * 10) / 10,
            highest: Math.max(...scores),
            lowest: Math.min(...scores),
            passCount,
            passRate: Math.round((passCount / total) * 100),
        };
    }, [filteredResults]);

    // Handle refresh
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

/**
 * useQuizManager Hook
 * 
 * Custom hook for quiz list management.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Quiz } from '../types';
import { parseQuizTags } from '../utils/quizTags';

export interface UseQuizManagerProps {
    quizzes: Quiz[];
    onDelete?: (quizId: string) => Promise<void>;
}

export interface UseQuizManagerReturn {
    // Filtered quizzes
    filteredQuizzes: Quiz[];
    paginatedQuizzes: Quiz[];

    // Filters
    filterLevel: string;
    setFilterLevel: (level: string) => void;
    filterCategory: string;
    setFilterCategory: (category: string) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;

    // Pagination
    page: number;
    setPage: (page: number) => void;
    pageSize: number;
    totalPages: number;

    // Actions
    handleDelete: (quizId: string) => Promise<void>;
    deletingId: string | null;
}

const QUIZZES_PER_PAGE = 10;

export const useQuizManager = ({ quizzes, onDelete }: UseQuizManagerProps): UseQuizManagerReturn => {
    const [filterLevel, setFilterLevel] = useState('All');
    const [filterCategory, setFilterCategory] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Filter quizzes
    const filteredQuizzes = useMemo(() => {
        let filtered = [...quizzes];

        // Category filter (subject/mon hoc)
        if (filterCategory !== 'all') {
            filtered = filtered.filter(q => (q as any).category === filterCategory);
        }

        // Level filter - use String() to handle both number and string classLevel
        if (filterLevel !== 'All') {
            filtered = filtered.filter(q => String(q.classLevel) === String(filterLevel));
        }

        // Search filter - support searching by title, class level, or tag
        if (searchTerm.trim()) {
            const search = searchTerm.toLowerCase().trim();

            // Check if searching for class level (e.g., "lớp 1", "lop 1", "class 1")
            const classLevelMatch = search.match(/(?:lớp|lop|class)\s*(\d+)/i);

            if (classLevelMatch) {
                // Filter by class level extracted from search
                const targetLevel = classLevelMatch[1];
                filtered = filtered.filter(q => String(q.classLevel) === targetLevel);
            } else if (search.startsWith('#')) {
                // Tag search - filter by tag
                const tagSearch = search.substring(1);
                filtered = filtered.filter(q => {
                    const tags = parseQuizTags((q as any).tags);
                    return tags.some(t => t.toLowerCase().includes(tagSearch));
                });
            } else {
                // Normal title search
                filtered = filtered.filter(q =>
                    String(q.title || '').toLowerCase().includes(search)
                );
            }
        }

        // Sort by date (newest first)
        filtered.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        return filtered;
    }, [quizzes, filterLevel, filterCategory, searchTerm]);

    // Calculate pagination
    const totalPages = Math.ceil(filteredQuizzes.length / QUIZZES_PER_PAGE);

    useEffect(() => {
        setPage(1);
    }, [filterLevel, filterCategory, searchTerm]);

    useEffect(() => {
        if (totalPages === 0 && page !== 1) setPage(1);
        else if (totalPages > 0 && page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    // Paginate
    const paginatedQuizzes = useMemo(() => {
        const start = (page - 1) * QUIZZES_PER_PAGE;
        return filteredQuizzes.slice(start, start + QUIZZES_PER_PAGE);
    }, [filteredQuizzes, page]);

    // Handle delete
    const handleDelete = useCallback(async (quizId: string) => {
        if (!onDelete) {
            toast.error('Chức năng xóa chưa được cấu hình.');
            return;
        }

        if (window.confirm('Bạn có chắc chắn muốn xóa bài kiểm tra này?')) {
            setDeletingId(quizId);
            try {
                await onDelete(quizId);
                toast.success('Đã xóa bài kiểm tra thành công!');
            } catch (error: unknown) {
                const normalizedError = error instanceof Error ? error : new Error(String(error));
                console.error('Delete quiz error:', error);
                toast.error('Lỗi khi xóa: ' + (normalizedError.message || 'Không thể xóa bài kiểm tra. Vui lòng thử lại.'));
            } finally {
                setDeletingId(null);
            }
        }
    }, [onDelete]);

    return {
        filteredQuizzes,
        paginatedQuizzes,
        filterLevel,
        setFilterLevel,
        filterCategory,
        setFilterCategory,
        searchTerm,
        setSearchTerm,
        page,
        setPage,
        pageSize: QUIZZES_PER_PAGE,
        totalPages,
        handleDelete,
        deletingId,
    };
};

export default useQuizManager;

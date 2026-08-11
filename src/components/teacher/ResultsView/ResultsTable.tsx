import { formatSystemDateTime } from '../../../utils/dateTime';
/**
 * Results Table Component
 * 
 * Displays student results in a sortable table.
 */

import React from 'react';
import { StudentResult, Quiz } from '../../../types';
import { ArrowUpDown, Eye, Trash2, Loader2, Printer } from 'lucide-react';
import { ResponsiveDataView } from '../../common';

export interface ResultsTableProps {
    results: StudentResult[];
    quizzes: Quiz[];
    resultOverrides?: Record<string, { correctCount: number; totalQuestions: number; score?: number }>;
    sortField: 'score' | 'submittedAt';
    sortOrder: 'asc' | 'desc';
    onSortChange: (field: 'score' | 'submittedAt') => void;
    onRowClick?: (result: StudentResult) => void;
    onDeleteClick?: (result: StudentResult) => void;
    isLoading?: boolean;
    /** Mở modal phiếu kết quả cho học sinh này */
    onPhieuClick?: (result: StudentResult) => void;
}


export interface ResultDisplayMetrics {
    score: number;
    correctCount: number;
    totalQuestions: number;
}

const finiteNumberOr = (candidate: unknown, fallback: unknown): number => {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
    if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback;
    return 0;
};

export const resolveResultDisplayMetrics = (
    result: StudentResult,
    override?: { correctCount: number; totalQuestions: number; score?: number },
): ResultDisplayMetrics => ({
    score: finiteNumberOr(override?.score, result.score),
    correctCount: finiteNumberOr(override?.correctCount, result.correctCount),
    totalQuestions: finiteNumberOr(override?.totalQuestions, result.totalQuestions),
});

export const ResultsTable: React.FC<ResultsTableProps> = ({
    results,
    quizzes,
    resultOverrides,
    sortField,
    sortOrder,
    onSortChange,
    onRowClick,
    onDeleteClick,
    isLoading,
    onPhieuClick,
}) => {
    const getDisplayMetrics = (result: StudentResult): ResultDisplayMetrics => (
        resolveResultDisplayMetrics(result, resultOverrides?.[String(result.id)])
    );

    // Get quiz title by ID, prioritize quizTitle from result if available
    const getQuizTitle = (result: StudentResult) => {
        if (result.quizTitle) {
            return result.quizTitle;
        }
        const quiz = quizzes.find(q => q.id === result.quizId);
        return quiz ? quiz.title : 'Không xác định';
    };

    // Format date
    const formatDate = (dateString: string) =>
        formatSystemDateTime(dateString, 'Không rõ thời gian');

    // Get score color
    const getScoreColor = (score: number) => {
        if (score >= 9) return 'text-green-600 bg-green-100';
        if (score >= 7) return 'text-blue-600 bg-blue-100';
        if (score >= 5) return 'text-yellow-600 bg-yellow-100';
        return 'text-red-600 bg-red-100';
    };

    const SortButton: React.FC<{ field: 'score' | 'submittedAt'; label: string }> = ({ field, label }) => (
        <button
            onClick={() => onSortChange(field)}
            className={`flex items-center gap-1 font-semibold ${
                sortField === field ? 'text-orange-600' : 'text-gray-600'
            }`}
        >
            {label}
            <ArrowUpDown className="w-3 h-3" />
        </button>
    );

    if (results.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                <p>Chưa có kết quả nào.</p>
            </div>
        );
    }

    const hasActions = onRowClick || onPhieuClick || onDeleteClick;

    return (
        <ResponsiveDataView
            items={results}
            keyExtractor={(result) => result.id}
            renderDesktop={() => (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                    Học sinh
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                    Lớp
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                    Bài kiểm tra
                                </th>
                                <th className="px-4 py-3 text-center">
                                    <SortButton field="score" label="Điểm" />
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                                    Kết quả
                                </th>
                                <th className="px-4 py-3 text-right">
                                    <SortButton field="submittedAt" label="Thời gian" />
                                </th>
                                {hasActions && (
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                                        Thao tác
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {results.map((result) => {
                                const metrics = getDisplayMetrics(result);
                                return (
                                <tr
                                    key={result.id}
                                    className={`hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                                    onClick={() => onRowClick?.(result)}
                                >
                                    <td className="px-4 py-3">
                                        <span className="font-medium text-gray-800">{result.studentName}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-gray-600">{result.studentClass}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-gray-600 text-sm">{getQuizTitle(result)}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`inline-flex px-2 py-1 rounded-full text-sm font-bold ${getScoreColor(metrics.score)}`}>
                                            {metrics.score}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-sm text-gray-500">
                                            {metrics.correctCount}/{metrics.totalQuestions} câu
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className="text-sm text-gray-500">
                                            {formatDate(result.submittedAt)}
                                        </span>
                                    </td>
                                    {hasActions && (
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {onRowClick && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onRowClick(result);
                                                        }}
                                                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                                                        title="Xem chi tiết"
                                                        disabled={isLoading}
                                                    >
                                                        {isLoading ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Eye className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                )}
                                                {onPhieuClick && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onPhieuClick(result);
                                                        }}
                                                        className="p-2 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors"
                                                        title="Xuất phiếu kết quả"
                                                    >
                                                        <Printer className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {onDeleteClick && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm(`Bạn có chắc muốn xóa kết quả của học sinh ${result.studentName}?`)) {
                                                                onDeleteClick(result);
                                                            }
                                                        }}
                                                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                                        title="Xóa kết quả"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            renderMobileCard={(result) => {
                const metrics = getDisplayMetrics(result);
                return (
                <div
                    className={`space-y-3 ${onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={() => onRowClick?.(result)}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-bold text-slate-800">{result.studentName}</p>
                            <p className="text-xs text-slate-500">{result.studentClass}</p>
                        </div>
                        <span className={`inline-flex px-2 py-1 rounded-full text-sm font-bold ${getScoreColor(metrics.score)}`}>
                            {metrics.score}
                        </span>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2">{getQuizTitle(result)}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{metrics.correctCount}/{metrics.totalQuestions} câu đúng</span>
                        <span>{formatDate(result.submittedAt)}</span>
                    </div>
                    {hasActions && (
                        <div className="flex items-center justify-end gap-2 pt-1">
                            {onRowClick && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRowClick(result);
                                    }}
                                    className="h-11 px-4 rounded-xl bg-blue-50 text-blue-700 font-semibold text-sm inline-flex items-center gap-2"
                                    disabled={isLoading}
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                                    Chi tiết
                                </button>
                            )}
                            {onPhieuClick && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onPhieuClick(result);
                                    }}
                                    className="h-11 px-4 rounded-xl bg-orange-50 text-orange-700 font-semibold text-sm inline-flex items-center gap-2"
                                >
                                    <Printer className="w-4 h-4" />
                                    Phiếu
                                </button>
                            )}
                            {onDeleteClick && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm(`Bạn có chắc muốn xóa kết quả của học sinh ${result.studentName}?`)) {
                                            onDeleteClick(result);
                                        }
                                    }}
                                    className="h-11 px-4 rounded-xl bg-red-50 text-red-700 font-semibold text-sm inline-flex items-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Xóa
                                </button>
                            )}
                        </div>
                    )}
                </div>
                );
            }}
        />
    );
};

export default ResultsTable;

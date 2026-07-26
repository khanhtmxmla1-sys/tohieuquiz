import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    BookOpen,
    Copy,
    Edit,
    Eye,
    Key,
    Loader2,
    Lock,
    MoreVertical,
    RefreshCw,
    Search,
    Send,
    Tag,
    Trash2,
} from 'lucide-react';
import type { Quiz } from '../../types';
import { Button } from '../common';
import { useQuizManager } from '../../hooks';
import { useQuizStore } from '../../../stores/quizStore';
import { useAuthStore } from '../../../stores/authStore';
import { useAssignmentStore } from '../../stores/useAssignmentStore';
import { useTeacherDashboardUIStore } from '../../stores/useTeacherDashboardUIStore';
import { SUBJECT_CONFIG } from '../../features/student-dashboard/model/dashboardConstants';
import { parseQuizTags } from '../../utils/quizTags';
import { showConfirm, showError, showSuccess } from '../../utils/toast';
import { AssignmentDrawer } from './AssignmentDrawer';
import WorksheetExportModal from './WorksheetExportModal';

const CATEGORY_OPTIONS = [
    { key: 'all', label: 'Tất cả môn' },
    ...Object.entries(SUBJECT_CONFIG).map(([key, config]) => ({ key, label: config.title })),
];

interface ManageTabProps {
    quizzes: Quiz[];
    onDelete?: (quizId: string) => Promise<void>;
    onEdit: (quiz: Quiz) => void;
    onManageCode: (quizId: string, currentCode: string) => void;
}

type AssignmentStatusFilter = 'all' | 'unassigned' | 'open' | 'closed';

const getClassGrade = (value: unknown): string => (
    String(value || '').match(/\d+/)?.[0] || ''
);

const DropdownMenu: React.FC<{
    quiz: Quiz;
    onManageCode: (quizId: string, currentCode: string) => void;
    onEdit: (quiz: Quiz) => void;
    onDuplicate: (quiz: Quiz) => void;
    onDelete: (quizId: string) => void;
    onExportWorksheet: (quiz: Quiz) => void;
    isDeleting: boolean;
    isDuplicating: boolean;
}> = ({
    quiz,
    onManageCode,
    onEdit,
    onDuplicate,
    onDelete,
    onExportWorksheet,
    isDeleting,
    isDuplicating,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        if (isOpen) {
            document.addEventListener('mousedown', handlePointerDown);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const actionClass = 'flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none';

    return (
        <div className="relative" ref={menuRef}>
            <button
                type="button"
                onClick={() => setIsOpen(value => !value)}
                aria-label={`Tùy chọn khác cho ${quiz.title}`}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
                <MoreVertical className="h-5 w-5" />
            </button>
            {isOpen && (
                <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
                >
                    <button role="menuitem" className={actionClass} onClick={() => { onManageCode(quiz.id, quiz.accessCode || ''); setIsOpen(false); }}>
                        <Key className="h-4 w-4" /> Quản lý mã
                    </button>
                    <button role="menuitem" className={actionClass} onClick={() => { window.open(`${window.location.origin}?quizId=${quiz.id}`, '_blank'); setIsOpen(false); }}>
                        <Eye className="h-4 w-4" /> Xem trước
                    </button>
                    <button role="menuitem" className={actionClass} onClick={() => { onEdit(quiz); setIsOpen(false); }}>
                        <Edit className="h-4 w-4" /> Sửa đề
                    </button>
                    <button
                        role="menuitem"
                        className={actionClass}
                        disabled={isDuplicating}
                        onClick={() => { onDuplicate(quiz); setIsOpen(false); }}
                    >
                        {isDuplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                        {isDuplicating ? 'Đang nhân bản...' : 'Nhân bản'}
                    </button>
                    <button role="menuitem" className={actionClass} onClick={() => { onExportWorksheet(quiz); setIsOpen(false); }}>
                        <BookOpen className="h-4 w-4" /> Xuất Vở Bài Tập
                    </button>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                        role="menuitem"
                        className={`${actionClass} text-red-600 hover:bg-red-50`}
                        disabled={isDeleting}
                        onClick={() => { onDelete(quiz.id); setIsOpen(false); }}
                    >
                        <Trash2 className="h-4 w-4" />
                        {isDeleting ? 'Đang xóa...' : 'Xóa đề'}
                    </button>
                </div>
            )}
        </div>
    );
};

const ManageTab: React.FC<ManageTabProps> = ({ quizzes, onDelete, onEdit, onManageCode }) => {
    const authStore = useAuthStore();
    const quizStore = useQuizStore();
    const assignments = useAssignmentStore(state => state.assignments);
    const fetchAllAssignments = useAssignmentStore(state => state.fetchAllAssignments);
    const fetchTeacherAssignments = useAssignmentStore(state => state.fetchTeacherAssignments);
    const setActiveTab = useTeacherDashboardUIStore(state => state.setActiveTab);
    const [statusFilter, setStatusFilter] = useState<AssignmentStatusFilter>('all');
    const [creatorFilter, setCreatorFilter] = useState('all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
    const [assigningQuiz, setAssigningQuiz] = useState<Quiz | null>(null);
    const [worksheetQuiz, setWorksheetQuiz] = useState<Quiz | null>(null);

    useEffect(() => {
        if (!authStore.username) return;
        if (authStore.isAdmin) void fetchAllAssignments();
        else void fetchTeacherAssignments(authStore.username);
    }, [
        authStore.isAdmin,
        authStore.username,
        fetchAllAssignments,
        fetchTeacherAssignments,
    ]);

    const assignmentStats = useMemo(() => {
        const stats = new Map<string, { status: Exclude<AssignmentStatusFilter, 'all'>; openCount: number; total: number }>();
        quizzes.forEach(quiz => {
            const matching = assignments.filter(assignment => String(assignment.quizId) === String(quiz.id));
            const openCount = matching.filter(assignment => assignment.status === 'OPEN').length;
            stats.set(quiz.id, {
                status: matching.length === 0 ? 'unassigned' : openCount > 0 ? 'open' : 'closed',
                openCount,
                total: matching.length,
            });
        });
        return stats;
    }, [assignments, quizzes]);

    const creatorOptions = useMemo(() => (
        Array.from(new Set(quizzes.map(quiz => String(quiz.createdBy || '')).filter(Boolean))).sort()
    ), [quizzes]);

    const metadataFilteredQuizzes = useMemo(() => quizzes.filter(quiz => {
        const status = assignmentStats.get(quiz.id)?.status || 'unassigned';
        if (statusFilter !== 'all' && status !== statusFilter) return false;
        if (creatorFilter !== 'all' && String(quiz.createdBy || '') !== creatorFilter) return false;
        return true;
    }), [assignmentStats, creatorFilter, quizzes, statusFilter]);

    const quizManager = useQuizManager({ quizzes: metadataFilteredQuizzes, onDelete });

    const canManageQuiz = (quiz: Quiz): boolean => {
        if (authStore.isAdmin || !authStore.teacherClass) return true;
        const teacherGrade = getClassGrade(authStore.teacherClass);
        return Boolean(teacherGrade) && getClassGrade(quiz.classLevel) === teacherGrade;
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([
                quizStore.loadQuizzes({ force: true }),
                authStore.isAdmin
                    ? fetchAllAssignments()
                    : fetchTeacherAssignments(authStore.username || ''),
            ]);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleDuplicate = async (quiz: Quiz) => {
        showConfirm({
            message: `Nhân bản đề "${quiz.title}"?`,
            confirmLabel: 'Nhân bản',
            onConfirm: async () => {
                setDuplicatingId(quiz.id);
                try {
                    const ok = await quizStore.duplicateQuiz(quiz.id);
                    if (ok) showSuccess('Nhân bản đề thành công!');
                    else showError('Không thể nhân bản đề. Vui lòng thử lại.');
                } finally {
                    setDuplicatingId(null);
                }
            },
        });
    };

    const setMetadataFilter = (setter: (value: any) => void, value: string) => {
        setter(value);
        quizManager.setPage(1);
    };

    return (
        <section className="space-y-4" aria-labelledby="quiz-management-title">
            {assigningQuiz && (
                <AssignmentDrawer
                    quiz={assigningQuiz}
                    onClose={() => setAssigningQuiz(null)}
                    onViewAssignments={() => {
                        setAssigningQuiz(null);
                        setActiveTab('assignments');
                    }}
                />
            )}
            {worksheetQuiz && (
                <WorksheetExportModal quiz={worksheetQuiz} onClose={() => setWorksheetQuiz(null)} />
            )}

            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 id="quiz-management-title" className="text-xl font-bold text-slate-900">Quản lý đề</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        {quizManager.filteredQuizzes.length} đề phù hợp · Chọn một đề để giao bài
                    </p>
                </div>
                <Button
                    onClick={handleRefresh}
                    variant="ghost"
                    size="sm"
                    disabled={isRefreshing}
                    className="text-sky-700 hover:bg-sky-50"
                    icon={<RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
                >
                    {isRefreshing ? 'Đang tải...' : 'Làm mới'}
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_repeat(4,minmax(140px,auto))]">
                <label className="relative block">
                    <span className="sr-only">Tìm kiếm đề</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        value={quizManager.searchTerm}
                        onChange={event => quizManager.setSearchTerm(event.target.value)}
                        placeholder="Tìm tên đề hoặc #nhãn"
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                </label>
                <select
                    aria-label="Lọc môn học"
                    value={quizManager.filterCategory}
                    onChange={event => quizManager.setFilterCategory(event.target.value)}
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                >
                    {CATEGORY_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
                </select>
                <select
                    aria-label="Lọc khối"
                    value={quizManager.filterLevel}
                    onChange={event => quizManager.setFilterLevel(event.target.value)}
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                >
                    <option value="All">Tất cả khối</option>
                    {['1', '2', '3', '4', '5'].map(level => <option key={level} value={level}>Khối {level}</option>)}
                </select>
                <select
                    aria-label="Lọc trạng thái giao bài"
                    value={statusFilter}
                    onChange={event => setMetadataFilter(setStatusFilter, event.target.value)}
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="unassigned">Chưa giao</option>
                    <option value="open">Đang giao</option>
                    <option value="closed">Đã đóng</option>
                </select>
                <select
                    aria-label="Lọc người tạo"
                    value={creatorFilter}
                    onChange={event => setMetadataFilter(setCreatorFilter, event.target.value)}
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                >
                    <option value="all">Tất cả người tạo</option>
                    {creatorOptions.map(creator => <option key={creator} value={creator}>{creator}</option>)}
                </select>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {quizManager.paginatedQuizzes.map((quiz, index) => {
                    const tags = parseQuizTags((quiz as any).tags);
                    const stats = assignmentStats.get(quiz.id) || { status: 'unassigned', openCount: 0, total: 0 };
                    const statusLabel = stats.status === 'open'
                        ? `Đang giao ${stats.openCount} lớp`
                        : stats.status === 'closed'
                            ? `Đã đóng ${stats.total} lượt giao`
                            : 'Chưa giao';
                    const statusClass = stats.status === 'open'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : stats.status === 'closed'
                            ? 'border-slate-200 bg-slate-100 text-slate-600'
                            : 'border-amber-200 bg-amber-50 text-amber-700';

                    return (
                        <article
                            key={quiz.id}
                            className={`flex min-h-[104px] flex-col gap-4 px-4 py-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center ${index > 0 ? 'border-t border-slate-100' : ''}`}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <a
                                        href={`${window.location.origin}?quizId=${quiz.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="truncate font-semibold text-slate-900 hover:text-sky-700 hover:underline"
                                    >
                                        {quiz.title}
                                    </a>
                                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}`}>{statusLabel}</span>
                                </div>
                                <p className="mt-1 text-sm text-slate-500">
                                    Khối {quiz.classLevel} · {quiz.questions.length} câu · {quiz.timeLimit} phút
                                    {quiz.accessCode ? ` · Mã ${quiz.accessCode}` : ''}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    {tags.slice(0, 3).map(tag => (
                                        <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                                            <Tag className="h-3 w-3" /> {tag}
                                        </span>
                                    ))}
                                    <span className="text-xs text-slate-400">
                                        {new Date(quiz.createdAt).toLocaleDateString('vi-VN')}
                                        {quiz.createdBy ? ` · ${quiz.createdBy}` : ''}
                                    </span>
                                </div>
                            </div>

                            <div className="flex shrink-0 items-center justify-end gap-2">
                                {canManageQuiz(quiz) ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setAssigningQuiz(quiz)}
                                            className="inline-flex h-10 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                                        >
                                            <Send className="h-4 w-4" /> Giao bài
                                        </button>
                                        <DropdownMenu
                                            quiz={quiz}
                                            onManageCode={onManageCode}
                                            onEdit={onEdit}
                                            onDuplicate={handleDuplicate}
                                            onExportWorksheet={setWorksheetQuiz}
                                            onDelete={quizManager.handleDelete}
                                            isDeleting={quizManager.deletingId === quiz.id}
                                            isDuplicating={duplicatingId === quiz.id}
                                        />
                                    </>
                                ) : (
                                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">
                                        <Lock className="h-3.5 w-3.5" /> Khối {quiz.classLevel}
                                    </span>
                                )}
                            </div>
                        </article>
                    );
                })}

                {quizManager.paginatedQuizzes.length === 0 && (
                    <div role="status" className="px-6 py-14 text-center">
                        <Search className="mx-auto h-10 w-10 text-slate-300" />
                        <p className="mt-3 font-medium text-slate-700">Không tìm thấy đề phù hợp</p>
                        <p className="mt-1 text-sm text-slate-400">Thử thay đổi từ khóa hoặc bộ lọc.</p>
                    </div>
                )}
            </div>

            {quizManager.totalPages > 1 && (
                <nav className="flex items-center justify-between gap-3" aria-label="Phân trang danh sách đề">
                    <button
                        type="button"
                        disabled={quizManager.page === 1}
                        onClick={() => quizManager.setPage(Math.max(1, quizManager.page - 1))}
                        className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 disabled:opacity-40"
                    >
                        Trang trước
                    </button>
                    <span className="text-sm text-slate-500">Trang {quizManager.page}/{quizManager.totalPages}</span>
                    <button
                        type="button"
                        disabled={quizManager.page === quizManager.totalPages}
                        onClick={() => quizManager.setPage(Math.min(quizManager.totalPages, quizManager.page + 1))}
                        className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 disabled:opacity-40"
                    >
                        Trang sau
                    </button>
                </nav>
            )}
        </section>
    );
};

export default ManageTab;

import React, { useMemo, useState } from 'react';
import { Check, CheckCircle2, Clock, ClipboardList, Edit3, Loader2, Search, Trash2, X } from 'lucide-react';
import { Assignment } from '../../types/classroom.types';
import {
    getVietnamDefaultDeadline,
    toVietnamDateTimeLocal,
    vietnamDateTimeLocalToIso,
} from '../../utils/dateTime';
import { ResponsiveDataView } from '../common';
import { showConfirm } from '../../utils/toast';

const AssignmentTrackingSection: React.FC<{
    assignments: Assignment[];
    onDelete: (id: string) => void;
    onUpdateDeadline: (assignmentId: string, newDeadline: string) => Promise<boolean>;
    onUpdateStatus: (assignmentId: string, newStatus: 'OPEN' | 'CLOSED') => Promise<boolean>;
    isLoading: boolean;
}> = ({ assignments, onDelete, onUpdateDeadline, onUpdateStatus, isLoading }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');

    // Sort: OPEN first, then by deadline
    const sorted = useMemo(() => {
        const search = searchTerm.trim().toLocaleLowerCase('vi');
        return assignments.filter(assignment => {
            if (statusFilter !== 'ALL' && assignment.status !== statusFilter) return false;
            if (!search) return true;
            return [
                assignment.quizTitle,
                assignment.quizId,
                assignment.className,
                assignment.studentName,
            ].some(value => String(value || '').toLocaleLowerCase('vi').includes(search));
        }).sort((a, b) => {
            if (a.status === 'OPEN' && b.status !== 'OPEN') return -1;
            if (a.status !== 'OPEN' && b.status === 'OPEN') return 1;
            const leftDeadline = Date.parse(a.deadline);
            const rightDeadline = Date.parse(b.deadline);
            if (!Number.isFinite(leftDeadline)) return 1;
            if (!Number.isFinite(rightDeadline)) return -1;
            return leftDeadline - rightDeadline;
        });
    }, [assignments, searchTerm, statusFilter]);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-blue-50 rounded-xl">
                    <ClipboardList className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Theo dõi bài giao</h2>
                    <p className="text-sm text-gray-400">{assignments.length} bài tập đã giao</p>
                </div>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(240px,1fr)_180px]">
                <label className="relative block">
                    <span className="sr-only">Tìm bài đã giao</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        aria-label="Tìm bài đã giao"
                        value={searchTerm}
                        onChange={event => setSearchTerm(event.target.value)}
                        placeholder="Tìm đề, lớp hoặc học sinh"
                        className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                </label>
                <select
                    aria-label="Lọc trạng thái bài giao"
                    value={statusFilter}
                    onChange={event => setStatusFilter(event.target.value as 'ALL' | 'OPEN' | 'CLOSED')}
                    className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="OPEN">Đang mở</option>
                    <option value="CLOSED">Đã đóng</option>
                </select>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                </div>
            )}

            {/* Empty */}
            {!isLoading && assignments.length === 0 && (
                <div className="text-center py-12">
                    <ClipboardList className="w-14 h-14 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400">Chưa giao bài tập nào</p>
                    <p className="text-gray-300 text-sm">Sử dụng form ở trên để giao bài</p>
                </div>
            )}

            {!isLoading && assignments.length > 0 && sorted.length === 0 && (
                <div role="status" className="py-12 text-center">
                    <Search className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-3 font-medium text-slate-700">Không tìm thấy bài giao phù hợp</p>
                    <p className="mt-1 text-sm text-slate-400">Thử thay đổi từ khóa hoặc trạng thái.</p>
                </div>
            )}

            {/* Table / Mobile Cards */}
            {!isLoading && sorted.length > 0 && (
                <ResponsiveDataView
                    items={sorted}
                    keyExtractor={(assignment) => assignment.id}
                    renderDesktop={() => (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/50">
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Đề bài</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Đối tượng</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Hạn nộp</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Trạng thái</th>
                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Tiến độ</th>
                                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map((a) => (
                                        <AssignmentRow key={a.id} assignment={a} onDelete={() => onDelete(a.id)} onUpdateDeadline={onUpdateDeadline} onUpdateStatus={onUpdateStatus} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    renderMobileCard={(assignment) => (
                        <AssignmentCardRow
                            assignment={assignment}
                            onDelete={() => onDelete(assignment.id)}
                            onUpdateDeadline={onUpdateDeadline}
                            onUpdateStatus={onUpdateStatus}
                        />
                    )}
                />
            )}
        </div>
    );
};

// ==========================================
// ASSIGNMENT ROW
// ==========================================

const AssignmentRow: React.FC<{
    assignment: Assignment;
    onDelete: () => void;
    onUpdateDeadline: (assignmentId: string, newDeadline: string) => Promise<boolean>;
    onUpdateStatus: (assignmentId: string, newStatus: 'OPEN' | 'CLOSED') => Promise<boolean>;
}> = ({ assignment, onDelete, onUpdateDeadline, onUpdateStatus }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editDeadline, setEditDeadline] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const isOpen = assignment.status === 'OPEN';
    const deadlineDate = new Date(assignment.deadline);
    const submitted = assignment.submittedCount ?? 0;
    const total = assignment.totalStudents ?? 0;
    const progress = total > 0 ? Math.round((submitted / total) * 100) : 0;

    // Format remaining time
    const getTimeRemaining = () => {
        if (!isOpen) return null;
        const diff = deadlineDate.getTime() - Date.now();
        if (diff <= 0) return 'Đã hết hạn';
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        if (days > 0) return `Còn ${days} ngày`;
        return `Còn ${hours} giờ`;
    };

    const timeRemaining = getTimeRemaining();

    const handleEditClick = () => {
        // Pre-fill with current deadline in datetime-local format
        setEditDeadline(toVietnamDateTimeLocal(deadlineDate));
        setIsEditing(true);
    };

    // Handle re-opening: if deadline is expired, must extend deadline first
    const handleReopenClick = () => {
        // Default to 7 days from now
        setEditDeadline(getVietnamDefaultDeadline());
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!editDeadline) return;
        setIsSaving(true);
        const newDeadlineISO = vietnamDateTimeLocalToIso(editDeadline);
        const ok = await onUpdateDeadline(assignment.id, newDeadlineISO);
        // If the assignment was closed and new deadline is in the future, also set status to OPEN
        if (ok && !isOpen && new Date(editDeadline) > new Date()) {
            await onUpdateStatus(assignment.id, 'OPEN');
        }
        setIsSaving(false);
        if (ok) setIsEditing(false);
    };

    const handleCancel = () => {
        setIsEditing(false);
    };

    return (
        <tr className="border-b border-gray-50 hover:bg-orange-50/20 transition-colors">
            {/* Quiz Title */}
            <td className="py-3 px-4">
                <div className="font-medium text-gray-800 text-sm">
                    {assignment.quizTitle || assignment.quizId}
                </div>
            </td>

            {/* Target Audience (Class / Student) */}
            <td className="py-3 px-4">
                <div className="flex flex-col gap-1 items-start">
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                        Lớp {assignment.className || assignment.classId}
                    </span>
                    {assignment.studentName ? (
                        <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            👤 {assignment.studentName}
                        </span>
                    ) : (
                        <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                            👥 Toàn lớp
                        </span>
                    )}
                </div>
            </td>

            {/* Deadline */}
            <td className="py-3 px-4">
                {isEditing ? (
                    <DeadlineEditor
                        editDeadline={editDeadline}
                        setEditDeadline={setEditDeadline}
                        onSave={handleSave}
                        onCancel={handleCancel}
                        isSaving={isSaving}
                    />
                ) : (
                    <DeadlineDisplay
                        deadlineDate={deadlineDate}
                        onEdit={handleEditClick}
                    />
                )}
            </td>

            {/* Status - Clickable to toggle */}
            <td className="py-3 px-4">
                <AssignmentStatusBadge
                    isOpen={isOpen}
                    timeRemaining={timeRemaining}
                    onToggle={() => {
                        if (isOpen) {
                            showConfirm({
                                message: `Đóng bài "${assignment.quizTitle || assignment.quizId}"?`,
                                confirmLabel: 'Đóng bài',
                                onConfirm: () => { void onUpdateStatus(assignment.id, 'CLOSED'); },
                            });
                        } else {
                            handleReopenClick();
                        }
                    }}
                />
            </td>

            {/* Progress */}
            <td className="py-3 px-4">
                <AssignmentProgress
                    submitted={submitted}
                    total={total}
                    progress={progress}
                />
            </td>

            {/* Actions */}
            <td className="py-3 px-4 text-right">
                <button
                    onClick={onDelete}
                    className="p-1.5 text-red-900 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Xóa bài giao"
                    aria-label={`Xóa bài giao ${assignment.quizTitle || assignment.quizId}`}
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </td>
        </tr>
    );
};

const AssignmentCardRow: React.FC<{
    assignment: Assignment;
    onDelete: () => void;
    onUpdateDeadline: (assignmentId: string, newDeadline: string) => Promise<boolean>;
    onUpdateStatus: (assignmentId: string, newStatus: 'OPEN' | 'CLOSED') => Promise<boolean>;
}> = ({ assignment, onDelete, onUpdateDeadline, onUpdateStatus }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editDeadline, setEditDeadline] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const isOpen = assignment.status === 'OPEN';
    const deadlineDate = new Date(assignment.deadline);
    const submitted = assignment.submittedCount ?? 0;
    const total = assignment.totalStudents ?? 0;
    const progress = total > 0 ? Math.round((submitted / total) * 100) : 0;

    const getTimeRemaining = () => {
        if (!isOpen) return null;
        const diff = deadlineDate.getTime() - Date.now();
        if (diff <= 0) return 'Đã hết hạn';
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        if (days > 0) return `Còn ${days} ngày`;
        return `Còn ${hours} giờ`;
    };

    const timeRemaining = getTimeRemaining();

    const handleEditClick = () => {
        setEditDeadline(toVietnamDateTimeLocal(deadlineDate));
        setIsEditing(true);
    };

    const handleReopenClick = () => {
        setEditDeadline(getVietnamDefaultDeadline());
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!editDeadline) return;
        setIsSaving(true);
        const newDeadlineISO = vietnamDateTimeLocalToIso(editDeadline);
        const ok = await onUpdateDeadline(assignment.id, newDeadlineISO);
        if (ok && !isOpen && new Date(editDeadline) > new Date()) {
            await onUpdateStatus(assignment.id, 'OPEN');
        }
        setIsSaving(false);
        if (ok) setIsEditing(false);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-gray-800 line-clamp-2">{assignment.quizTitle || assignment.quizId}</p>
                <button
                    onClick={onDelete}
                    className="h-9 w-9 shrink-0 rounded-lg border border-red-100 bg-red-50 text-red-500 inline-flex items-center justify-center"
                    title="Xóa bài giao"
                    aria-label={`Xóa bài giao ${assignment.quizTitle || assignment.quizId}`}
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            <div className="flex flex-wrap gap-2">
                <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                    Lớp {assignment.className || assignment.classId}
                </span>
                {assignment.studentName ? (
                    <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                        👤 {assignment.studentName}
                    </span>
                ) : (
                    <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded border border-green-200">
                        👥 Toàn lớp
                    </span>
                )}
            </div>

            <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500 uppercase">Hạn nộp</p>
                {isEditing ? (
                    <DeadlineEditor
                        editDeadline={editDeadline}
                        setEditDeadline={setEditDeadline}
                        onSave={handleSave}
                        onCancel={() => setIsEditing(false)}
                        isSaving={isSaving}
                    />
                ) : (
                    <DeadlineDisplay deadlineDate={deadlineDate} onEdit={handleEditClick} />
                )}
            </div>

            <div className="flex items-center justify-between gap-3">
                <AssignmentStatusBadge
                    isOpen={isOpen}
                    timeRemaining={timeRemaining}
                    onToggle={() => {
                        if (isOpen) {
                            showConfirm({
                                message: `Đóng bài "${assignment.quizTitle || assignment.quizId}"?`,
                                confirmLabel: 'Đóng bài',
                                onConfirm: () => { void onUpdateStatus(assignment.id, 'CLOSED'); },
                            });
                        } else {
                            handleReopenClick();
                        }
                    }}
                />
                <AssignmentProgress submitted={submitted} total={total} progress={progress} />
            </div>
        </div>
    );
};

// ==========================================
// SUB-COMPONENTS
// ==========================================

const DeadlineEditor: React.FC<{
    editDeadline: string;
    setEditDeadline: (val: string) => void;
    onSave: () => void;
    onCancel: () => void;
    isSaving: boolean;
}> = ({ editDeadline, setEditDeadline, onSave, onCancel, isSaving }) => (
    <div className="flex items-center gap-1.5">
        <input
            type="datetime-local"
            value={editDeadline}
            onChange={(e) => setEditDeadline(e.target.value)}
            className="px-2 py-1.5 border border-orange-300 rounded-lg bg-orange-50 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-xs w-44"
        />
        <button
            onClick={onSave}
            disabled={isSaving}
            className="p-1 text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
            title="Lưu"
            aria-label="Lưu hạn nộp"
        >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button
            onClick={onCancel}
            className="p-1 text-gray-400 hover:bg-gray-100 rounded-md transition-colors"
            title="Hủy"
            aria-label="Hủy sửa hạn nộp"
        >
            <X className="w-3.5 h-3.5" />
        </button>
    </div>
);

const DeadlineDisplay: React.FC<{
    deadlineDate: Date;
    onEdit: () => void;
}> = ({ deadlineDate, onEdit }) => (
    <div className="flex items-center gap-1.5 group">
        <div>
            <div className="text-sm text-gray-700">
                {deadlineDate.toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                })}
            </div>
            <div className="text-xs text-gray-400">
                {deadlineDate.toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                })}
            </div>
        </div>
        <button
            onClick={onEdit}
            aria-label="Sửa hạn nộp"
            className="p-1 text-orange-700 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
            title="Sửa hạn nộp"
        >
            <Edit3 className="w-3.5 h-3.5" />
        </button>
    </div>
);

const AssignmentStatusBadge: React.FC<{
    isOpen: boolean;
    timeRemaining: string | null;
    onToggle: () => void;
}> = ({ isOpen, timeRemaining, onToggle }) => (
    <div className="flex items-center gap-2">
        <button
            onClick={onToggle}
            aria-label={isOpen ? 'Đóng bài giao' : 'Mở lại bài giao'}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-all hover:shadow-sm ${isOpen
                ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                }`}
            title={isOpen ? 'Bấm để đóng bài' : 'Bấm để mở lại (cần gia hạn deadline)'}
        >
            {isOpen ? (
                <><Clock className="w-3 h-3" /> Đang mở</>
            ) : (
                <><CheckCircle2 className="w-3 h-3" /> Đã đóng</>
            )}
        </button>
        {isOpen && timeRemaining && (
            <span className={`text-xs ${timeRemaining.includes('giờ') ? 'text-amber-500' : 'text-gray-400'
                }`}>
                {timeRemaining}
            </span>
        )}
    </div>
);

const AssignmentProgress: React.FC<{
    submitted: number;
    total: number;
    progress: number;
}> = ({ submitted, total, progress }) => (
    <>
        {total > 0 ? (
            <div className="min-w-[120px]">
                <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">{submitted}/{total} nộp</span>
                    <span className="text-gray-400">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all ${progress === 100
                            ? 'bg-green-500'
                            : progress > 50
                                ? 'bg-blue-500'
                                : 'bg-orange-400'
                            }`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        ) : (
            <span className="text-xs text-gray-300">-</span>
        )}
    </>
);

export default AssignmentTrackingSection;

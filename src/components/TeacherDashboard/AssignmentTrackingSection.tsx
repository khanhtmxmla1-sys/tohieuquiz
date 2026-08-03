import React, { useMemo, useState } from 'react';
import {
    Check,
    CheckCircle2,
    Clock,
    ClipboardList,
    Edit3,
    Loader2,
    RotateCcw,
    Search,
    ShieldAlert,
    X,
} from 'lucide-react';
import type { Assignment, AssignmentStatus } from '../../types/classroom.types';
import {
    getVietnamDefaultDeadline,
    toVietnamDateTimeLocal,
    vietnamDateTimeLocalToIso,
} from '../../utils/dateTime';
import { ResponsiveDataView } from '../common';
import { showConfirm } from '../../utils/toast';
import { useBrowserSearchParams } from '../../hooks/useBrowserSearchParams';
import AssignmentRevokeDialog from './assignment-tab/AssignmentRevokeDialog';

interface AssignmentTrackingSectionProps {
    assignments: Assignment[];
    onRevoke: (assignmentId: string, reason: string) => Promise<boolean>;
    onUpdateDeadline: (assignmentId: string, newDeadline: string) => Promise<boolean>;
    onUpdateStatus: (assignmentId: string, newStatus: 'OPEN' | 'CLOSED') => Promise<boolean>;
    isLoading: boolean;
}

type StatusFilter = 'ALL' | AssignmentStatus;

const STATUS_ORDER: Record<AssignmentStatus, number> = {
    OPEN: 0,
    CLOSED: 1,
    REVOKED: 2,
};

const AssignmentTrackingSection: React.FC<AssignmentTrackingSectionProps> = ({
    assignments,
    onRevoke,
    onUpdateDeadline,
    onUpdateStatus,
    isLoading,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [revocationTarget, setRevocationTarget] = useState<Assignment | null>(null);
    const [searchParams, setSearchParams] = useBrowserSearchParams();
    const rawStatus = searchParams.get('status');
    const statusFilter: StatusFilter = ['OPEN', 'CLOSED', 'REVOKED'].includes(String(rawStatus))
        ? rawStatus as AssignmentStatus
        : 'ALL';
    const rawDueHours = Number(searchParams.get('due'));
    const dueHours = Number.isFinite(rawDueHours) && rawDueHours > 0 && rawDueHours <= 168
        ? rawDueHours
        : null;

    const updateStatusFilter = (status: StatusFilter) => {
        const next = new URLSearchParams(searchParams);
        if (status === 'ALL') next.delete('status');
        else next.set('status', status);
        setSearchParams(next);
    };

    const sorted = useMemo(() => {
        const search = searchTerm.trim().toLocaleLowerCase('vi');
        return assignments
            .filter((assignment) => {
                if (statusFilter !== 'ALL' && assignment.status !== statusFilter) return false;
                if (dueHours !== null) {
                    if (assignment.status !== 'OPEN') return false;
                    const deadline = Date.parse(assignment.deadline);
                    const now = Date.now();
                    if (!Number.isFinite(deadline) || deadline <= now || deadline > now + dueHours * 3_600_000) {
                        return false;
                    }
                }
                if (!search) return true;
                return [
                    assignment.quizTitle,
                    assignment.quizId,
                    assignment.className,
                    assignment.studentName,
                    assignment.revokedReason,
                ].some(value => String(value || '').toLocaleLowerCase('vi').includes(search));
            })
            .sort((a, b) => {
                const statusDelta = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
                if (statusDelta !== 0) return statusDelta;
                const leftDeadline = Date.parse(a.deadline);
                const rightDeadline = Date.parse(b.deadline);
                if (!Number.isFinite(leftDeadline)) return 1;
                if (!Number.isFinite(rightDeadline)) return -1;
                return leftDeadline - rightDeadline;
            });
    }, [assignments, dueHours, searchTerm, statusFilter]);

    const commonRowProps = {
        onRequestRevoke: setRevocationTarget,
        onUpdateDeadline,
        onUpdateStatus,
    };

    return (
        <>
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center gap-3">
                    <div className="rounded-xl bg-blue-50 p-2.5">
                        <ClipboardList className="h-5 w-5 text-blue-500" />
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
                        onChange={event => updateStatusFilter(event.target.value as StatusFilter)}
                        className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    >
                        <option value="ALL">Tất cả trạng thái</option>
                        <option value="OPEN">Đang mở</option>
                        <option value="CLOSED">Đã đóng</option>
                        <option value="REVOKED">Đã thu hồi</option>
                    </select>
                </div>

                {isLoading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                    </div>
                )}

                {!isLoading && assignments.length === 0 && (
                    <div className="py-12 text-center">
                        <ClipboardList className="mx-auto mb-3 h-14 w-14 text-gray-200" />
                        <p className="text-gray-400">Chưa giao bài tập nào</p>
                        <p className="text-sm text-gray-300">Sử dụng form ở trên để giao bài</p>
                    </div>
                )}

                {!isLoading && assignments.length > 0 && sorted.length === 0 && (
                    <div role="status" className="py-12 text-center">
                        <Search className="mx-auto h-10 w-10 text-slate-300" />
                        <p className="mt-3 font-medium text-slate-700">Không tìm thấy bài giao phù hợp</p>
                        <p className="mt-1 text-sm text-slate-400">Thử thay đổi từ khóa hoặc trạng thái.</p>
                    </div>
                )}

                {!isLoading && sorted.length > 0 && (
                    <ResponsiveDataView
                        items={sorted}
                        keyExtractor={assignment => assignment.id}
                        renderDesktop={() => (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-gray-50/50">
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Đề bài</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Đối tượng</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Hạn nộp</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Trạng thái</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Tiến độ</th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sorted.map(assignment => (
                                            <AssignmentRow
                                                key={assignment.id}
                                                assignment={assignment}
                                                {...commonRowProps}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        renderMobileCard={assignment => (
                            <AssignmentCardRow assignment={assignment} {...commonRowProps} />
                        )}
                    />
                )}
            </div>

            {revocationTarget && (
                <AssignmentRevokeDialog
                    assignment={revocationTarget}
                    onClose={() => setRevocationTarget(null)}
                    onConfirm={reason => onRevoke(revocationTarget.id, reason)}
                />
            )}
        </>
    );
};

interface AssignmentRowProps {
    assignment: Assignment;
    onRequestRevoke: (assignment: Assignment) => void;
    onUpdateDeadline: (assignmentId: string, newDeadline: string) => Promise<boolean>;
    onUpdateStatus: (assignmentId: string, newStatus: 'OPEN' | 'CLOSED') => Promise<boolean>;
}

const AssignmentRow: React.FC<AssignmentRowProps> = ({
    assignment,
    onRequestRevoke,
    onUpdateDeadline,
    onUpdateStatus,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editDeadline, setEditDeadline] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const isOpen = assignment.status === 'OPEN';
    const isRevoked = assignment.status === 'REVOKED';
    const deadlineDate = new Date(assignment.deadline);
    const submitted = assignment.submittedCount ?? 0;
    const total = assignment.totalStudents ?? 0;
    const progress = total > 0 ? Math.round((submitted / total) * 100) : 0;
    const timeRemaining = getTimeRemaining(assignment, deadlineDate);

    const editCurrentDeadline = () => {
        if (isRevoked) return;
        setEditDeadline(toVietnamDateTimeLocal(deadlineDate));
        setIsEditing(true);
    };
    const reopen = () => {
        if (isRevoked) return;
        setEditDeadline(getVietnamDefaultDeadline());
        setIsEditing(true);
    };
    const saveDeadline = async () => {
        if (!editDeadline || isRevoked) return;
        setIsSaving(true);
        const newDeadline = vietnamDateTimeLocalToIso(editDeadline);
        const ok = await onUpdateDeadline(assignment.id, newDeadline);
        if (ok && !isOpen && new Date(editDeadline) > new Date()) {
            await onUpdateStatus(assignment.id, 'OPEN');
        }
        setIsSaving(false);
        if (ok) setIsEditing(false);
    };

    return (
        <tr className={`border-b border-gray-50 transition-colors ${isRevoked ? 'bg-slate-50/70' : 'hover:bg-orange-50/20'}`}>
            <td className="px-4 py-3">
                <div className="text-sm font-medium text-gray-800">{assignment.quizTitle || assignment.quizId}</div>
                {isRevoked && assignment.revokedReason && (
                    <p className="mt-1 max-w-xs text-xs text-rose-700">{assignment.revokedReason}</p>
                )}
            </td>
            <td className="px-4 py-3"><Audience assignment={assignment} /></td>
            <td className="px-4 py-3">
                {isRevoked ? (
                    <span className="text-xs font-medium text-slate-400">Đã khóa sau thu hồi</span>
                ) : isEditing ? (
                    <DeadlineEditor
                        editDeadline={editDeadline}
                        setEditDeadline={setEditDeadline}
                        onSave={saveDeadline}
                        onCancel={() => setIsEditing(false)}
                        isSaving={isSaving}
                    />
                ) : (
                    <DeadlineDisplay deadlineDate={deadlineDate} onEdit={editCurrentDeadline} />
                )}
            </td>
            <td className="px-4 py-3">
                <AssignmentStatusBadge
                    status={assignment.status}
                    timeRemaining={timeRemaining}
                    onToggle={isRevoked ? undefined : () => {
                        if (isOpen) {
                            showConfirm({
                                message: `Đóng bài "${assignment.quizTitle || assignment.quizId}"?`,
                                confirmLabel: 'Đóng bài',
                                onConfirm: () => { void onUpdateStatus(assignment.id, 'CLOSED'); },
                            });
                        } else reopen();
                    }}
                />
            </td>
            <td className="px-4 py-3">
                <AssignmentProgress submitted={submitted} total={total} progress={progress} />
            </td>
            <td className="px-4 py-3 text-right">
                {!isRevoked && (
                    <button
                        type="button"
                        onClick={() => onRequestRevoke(assignment)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        title="Thu hồi bài đã giao"
                        aria-label={`Thu hồi bài giao ${assignment.quizTitle || assignment.quizId}`}
                    >
                        <RotateCcw className="h-4 w-4" /> Thu hồi
                    </button>
                )}
            </td>
        </tr>
    );
};

const AssignmentCardRow: React.FC<AssignmentRowProps> = ({
    assignment,
    onRequestRevoke,
    onUpdateDeadline,
    onUpdateStatus,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editDeadline, setEditDeadline] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const isOpen = assignment.status === 'OPEN';
    const isRevoked = assignment.status === 'REVOKED';
    const deadlineDate = new Date(assignment.deadline);
    const submitted = assignment.submittedCount ?? 0;
    const total = assignment.totalStudents ?? 0;
    const progress = total > 0 ? Math.round((submitted / total) * 100) : 0;

    const saveDeadline = async () => {
        if (!editDeadline || isRevoked) return;
        setIsSaving(true);
        const deadline = vietnamDateTimeLocalToIso(editDeadline);
        const ok = await onUpdateDeadline(assignment.id, deadline);
        if (ok && !isOpen && new Date(editDeadline) > new Date()) {
            await onUpdateStatus(assignment.id, 'OPEN');
        }
        setIsSaving(false);
        if (ok) setIsEditing(false);
    };

    return (
        <div className={`space-y-3 ${isRevoked ? 'opacity-90' : ''}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="line-clamp-2 text-sm font-semibold text-gray-800">{assignment.quizTitle || assignment.quizId}</p>
                    {isRevoked && assignment.revokedReason && (
                        <p className="mt-1 text-xs text-rose-700">{assignment.revokedReason}</p>
                    )}
                </div>
                {!isRevoked && (
                    <button
                        type="button"
                        onClick={() => onRequestRevoke(assignment)}
                        className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700"
                        title="Thu hồi bài đã giao"
                        aria-label={`Thu hồi bài giao ${assignment.quizTitle || assignment.quizId}`}
                    >
                        <RotateCcw className="h-4 w-4" /> Thu hồi
                    </button>
                )}
            </div>
            <Audience assignment={assignment} />
            <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Hạn nộp</p>
                {isRevoked ? (
                    <span className="text-xs font-medium text-slate-400">Đã khóa sau thu hồi</span>
                ) : isEditing ? (
                    <DeadlineEditor
                        editDeadline={editDeadline}
                        setEditDeadline={setEditDeadline}
                        onSave={saveDeadline}
                        onCancel={() => setIsEditing(false)}
                        isSaving={isSaving}
                    />
                ) : (
                    <DeadlineDisplay
                        deadlineDate={deadlineDate}
                        onEdit={() => {
                            setEditDeadline(toVietnamDateTimeLocal(deadlineDate));
                            setIsEditing(true);
                        }}
                    />
                )}
            </div>
            <div className="flex items-center justify-between gap-3">
                <AssignmentStatusBadge
                    status={assignment.status}
                    timeRemaining={getTimeRemaining(assignment, deadlineDate)}
                    onToggle={isRevoked ? undefined : () => {
                        if (isOpen) {
                            showConfirm({
                                message: `Đóng bài "${assignment.quizTitle || assignment.quizId}"?`,
                                confirmLabel: 'Đóng bài',
                                onConfirm: () => { void onUpdateStatus(assignment.id, 'CLOSED'); },
                            });
                        } else {
                            setEditDeadline(getVietnamDefaultDeadline());
                            setIsEditing(true);
                        }
                    }}
                />
                <AssignmentProgress submitted={submitted} total={total} progress={progress} />
            </div>
        </div>
    );
};

const Audience = ({ assignment }: { assignment: Assignment }) => (
    <div className="flex flex-wrap items-start gap-1">
        <span className="rounded border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            Lớp {assignment.className || assignment.classId}
        </span>
        {assignment.studentName ? (
            <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                👤 {assignment.studentName}
            </span>
        ) : (
            <span className="rounded border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                👥 Toàn lớp
            </span>
        )}
    </div>
);

const getTimeRemaining = (assignment: Assignment, deadlineDate: Date) => {
    if (assignment.status !== 'OPEN') return null;
    const diff = deadlineDate.getTime() - Date.now();
    if (diff <= 0) return 'Đã hết hạn';
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(hours / 24);
    return days > 0 ? `Còn ${days} ngày` : `Còn ${hours} giờ`;
};

const DeadlineEditor: React.FC<{
    editDeadline: string;
    setEditDeadline: (value: string) => void;
    onSave: () => void;
    onCancel: () => void;
    isSaving: boolean;
}> = ({ editDeadline, setEditDeadline, onSave, onCancel, isSaving }) => (
    <div className="flex items-center gap-1.5">
        <input
            type="datetime-local"
            value={editDeadline}
            onChange={event => setEditDeadline(event.target.value)}
            className="w-44 rounded-lg border border-orange-300 bg-orange-50 px-2 py-1.5 text-xs outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
        />
        <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="rounded-md p-1 text-green-600 hover:bg-green-50 disabled:opacity-50"
            title="Lưu"
            aria-label="Lưu hạn nộp"
        >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </button>
        <button
            type="button"
            onClick={onCancel}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
            title="Hủy"
            aria-label="Hủy sửa hạn nộp"
        >
            <X className="h-3.5 w-3.5" />
        </button>
    </div>
);

const DeadlineDisplay: React.FC<{ deadlineDate: Date; onEdit: () => void }> = ({ deadlineDate, onEdit }) => (
    <div className="group flex items-center gap-1.5">
        <div>
            <div className="text-sm text-gray-700">
                {deadlineDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </div>
            <div className="text-xs text-gray-400">
                {deadlineDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </div>
        </div>
        <button
            type="button"
            onClick={onEdit}
            aria-label="Sửa hạn nộp"
            className="rounded-md p-1 text-orange-700 hover:bg-orange-50 hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
            title="Sửa hạn nộp"
        >
            <Edit3 className="h-3.5 w-3.5" />
        </button>
    </div>
);

const AssignmentStatusBadge: React.FC<{
    status: AssignmentStatus;
    timeRemaining: string | null;
    onToggle?: () => void;
}> = ({ status, timeRemaining, onToggle }) => {
    if (status === 'REVOKED') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                <ShieldAlert className="h-3 w-3" /> Đã thu hồi
            </span>
        );
    }
    const isOpen = status === 'OPEN';
    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={onToggle}
                aria-label={isOpen ? 'Đóng bài giao' : 'Mở lại bài giao'}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all hover:shadow-sm ${isOpen
                    ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                    : 'border-gray-200 bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                title={isOpen ? 'Bấm để đóng bài' : 'Bấm để mở lại (cần gia hạn deadline)'}
            >
                {isOpen
                    ? <><Clock className="h-3 w-3" /> Đang mở</>
                    : <><CheckCircle2 className="h-3 w-3" /> Đã đóng</>}
            </button>
            {isOpen && timeRemaining && (
                <span className={`text-xs ${timeRemaining.includes('giờ') ? 'text-amber-500' : 'text-gray-400'}`}>
                    {timeRemaining}
                </span>
            )}
        </div>
    );
};

const AssignmentProgress: React.FC<{ submitted: number; total: number; progress: number }> = ({
    submitted,
    total,
    progress,
}) => total > 0 ? (
    <div className="min-w-[120px]">
        <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-gray-600">{submitted}/{total} nộp</span>
            <span className="text-gray-400">{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
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
) : <span className="text-xs text-gray-300">-</span>;

export default AssignmentTrackingSection;

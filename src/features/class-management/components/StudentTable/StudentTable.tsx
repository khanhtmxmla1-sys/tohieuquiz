import React, { memo } from 'react';
import { Archive, KeyRound, QrCode } from 'lucide-react';
import { Student } from '../../types';
import { ResponsiveDataView } from '../../../../components/common';
import { showConfirm } from '../../../../utils/toast';

interface StudentTableProps {
    students: Student[];
    classId: string;
    onResetPassword: (studentId: string) => void;
    onRemoveStudent: (studentId: string, classId: string) => void;
    onParentAccess: (student: Student) => void;
    serverActionsDisabled?: boolean;
    selectedStudentIds?: string[];
    onSelectionChange?: (studentIds: string[]) => void;
    onOpenCoinAwards?: (input: { classId: string; studentIds: string[]; selectionMode: 'STUDENT' | 'SELECTED' }) => void;
    allStudentIds?: string[];
    selectionDisabled?: boolean;
    selectionEnabled?: boolean;
}

export const StudentTable: React.FC<StudentTableProps> = memo(({
    students,
    classId,
    onResetPassword,
    onRemoveStudent,
    onParentAccess,
    serverActionsDisabled = false,
    selectedStudentIds = [],
    onSelectionChange,
    onOpenCoinAwards,
    allStudentIds,
    selectionDisabled = false,
    selectionEnabled = true,
}) => {
    const selected = new Set(selectedStudentIds);
    const visibleStudentIds = students.map((student) => student.id);
    const activeStudentIds = allStudentIds || visibleStudentIds;
    const selectionIsDisabled = selectionDisabled || serverActionsDisabled;
    const allVisibleSelected = visibleStudentIds.length > 0 && visibleStudentIds.every((id) => selected.has(id));

    const updateSelection = (ids: string[]) => {
        onSelectionChange?.(Array.from(new Set(ids)));
    };

    const toggleStudent = (studentId: string) => {
        if (selectionIsDisabled) return;
        const next = new Set(selected);
        if (next.has(studentId)) next.delete(studentId);
        else next.add(studentId);
        updateSelection(Array.from(next));
    };

    const toggleVisible = () => {
        if (selectionIsDisabled) return;
        const next = new Set(selected);
        if (allVisibleSelected) visibleStudentIds.forEach((id) => next.delete(id));
        else visibleStudentIds.forEach((id) => next.add(id));
        updateSelection(Array.from(next));
    };

    const selectAllActive = () => {
        if (selectionIsDisabled) return;
        updateSelection(activeStudentIds);
    };

    const clearSelection = () => {
        if (selectionIsDisabled) return;
        updateSelection([]);
    };

    const openCoinAwards = () => {
        if (selectionIsDisabled || selectedStudentIds.length === 0) return;
        onOpenCoinAwards?.({ classId, studentIds: selectedStudentIds, selectionMode: 'SELECTED' });
    };

    const openSingleCoinAward = (studentId: string) => {
        if (selectionIsDisabled) return;
        onOpenCoinAwards?.({ classId, studentIds: [studentId], selectionMode: 'STUDENT' });
    };

    const selectionToolbar = selectionEnabled ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-orange-100 bg-orange-50/60 p-3" aria-label="Chọn học sinh để thưởng xu">
            <button
                type="button"
                onClick={toggleVisible}
                disabled={selectionIsDisabled || visibleStudentIds.length === 0}
                className="min-h-10 rounded-lg border border-orange-200 bg-white px-3 text-sm font-semibold text-orange-800 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {allVisibleSelected ? 'Bỏ chọn học sinh đang hiển thị' : 'Chọn tất cả học sinh đang hiển thị'}
            </button>
            <button
                type="button"
                onClick={selectAllActive}
                disabled={selectionIsDisabled || activeStudentIds.length === 0}
                className="min-h-10 rounded-lg border border-orange-200 bg-white px-3 text-sm font-semibold text-orange-800 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
                Chọn tất cả học sinh đang hoạt động
            </button>
            {selectedStudentIds.length > 0 && (
                <button
                    type="button"
                    onClick={clearSelection}
                    disabled={selectionIsDisabled}
                    className="min-h-10 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Bỏ chọn tất cả
                </button>
            )}
        </div>
    ) : null;

    const bulkAction = selectionEnabled && selectedStudentIds.length > 0 ? (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-white/95 p-3 shadow-lg backdrop-blur" role="region" aria-label="Thao tác thưởng xu">
            <p className="text-sm font-semibold text-slate-700">Đã chọn {selectedStudentIds.length} học sinh</p>
            <button
                type="button"
                onClick={openCoinAwards}
                disabled={selectionIsDisabled || !onOpenCoinAwards}
                className="min-h-11 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
                Thưởng xu cho {selectedStudentIds.length} học sinh
            </button>
        </div>
    ) : null;

    return (
        <div className="space-y-3">
            {selectionToolbar}
            <ResponsiveDataView
                items={students}
                keyExtractor={(student) => student.id}
                renderDesktop={() => (
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    {selectionEnabled && <th className="w-12 py-3 px-4 text-left text-sm font-semibold text-gray-600"><input type="checkbox" aria-label="Chọn tất cả học sinh đang hiển thị" checked={allVisibleSelected} onChange={toggleVisible} disabled={selectionIsDisabled || visibleStudentIds.length === 0} /></th>}
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">#</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Họ tên</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Tài khoản</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">SĐT phụ huynh</th>
                                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((student, idx) => (
                                    <tr key={student.id} className="border-b border-gray-50 hover:bg-orange-50/30 transition-colors">
                                        {selectionEnabled && <td className="py-3 px-4"><input type="checkbox" aria-label={`Chọn ${student.fullName}`} checked={selected.has(student.id)} onChange={() => toggleStudent(student.id)} disabled={selectionIsDisabled} /></td>}
                                        <td className="py-3 px-4 text-sm text-gray-400">{idx + 1}</td>
                                        <td className="py-3 px-4 font-medium text-gray-800">{student.fullName}</td>
                                        <td className="py-3 px-4"><code className="bg-gray-100 px-2 py-0.5 rounded text-sm text-gray-600">{student.username}</code></td>
                                        <td className="py-3 px-4 text-sm text-gray-500">{student.parentPhone || '—'}</td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-end gap-1">
                                                {selectionEnabled && onOpenCoinAwards && (
                                                    <button type="button" onClick={() => openSingleCoinAward(student.id)} disabled={selectionIsDisabled} className="min-h-9 rounded-lg border border-orange-200 bg-orange-50 px-2.5 text-xs font-bold text-orange-800 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`+ Xu cho ${student.fullName}`}>
                                                        + Xu
                                                    </button>
                                                )}
                                                <button onClick={() => onParentAccess(student)} disabled={serverActionsDisabled} className="p-1.5 text-indigo-900 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:cursor-not-allowed disabled:opacity-50" title={serverActionsDisabled ? 'Cần kết nối mạng để quản lý quyền phụ huynh.' : 'Quản lý quyền phụ huynh'} aria-label={`Quản lý quyền phụ huynh cho ${student.fullName}`}><QrCode className="w-4 h-4" /></button>
                                                <button onClick={() => onResetPassword(student.id)} disabled={serverActionsDisabled} className="p-1.5 text-blue-900 hover:text-blue-600 hover:bg-blue-50 rounded-lg disabled:cursor-not-allowed disabled:opacity-50" title={serverActionsDisabled ? 'Cần kết nối mạng để đặt lại mật khẩu.' : 'Đặt lại mật khẩu'} aria-label={`Đặt lại mật khẩu cho ${student.fullName}`}><KeyRound className="w-4 h-4" /></button>
                                                <button disabled={serverActionsDisabled} onClick={() => showConfirm({ message: `Lưu trữ học sinh "${student.fullName}" khỏi lớp? Tài khoản sẽ ẩn khỏi danh sách nhưng lịch sử học tập vẫn được bảo toàn.`, confirmLabel: 'Lưu trữ', destructive: true, onConfirm: () => onRemoveStudent(student.id, classId) })} className="p-1.5 text-amber-900 hover:text-amber-700 hover:bg-amber-50 rounded-lg disabled:cursor-not-allowed disabled:opacity-50" title={serverActionsDisabled ? 'Cần kết nối mạng để lưu trữ học sinh.' : 'Lưu trữ học sinh'} aria-label={`Lưu trữ học sinh ${student.fullName}`}><Archive className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                renderMobileCard={(student, idx) => (
                    <div className="space-y-3">
                        {selectionEnabled && <label className="flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" aria-label={`Chọn ${student.fullName}`} checked={selected.has(student.id)} onChange={() => toggleStudent(student.id)} disabled={selectionIsDisabled} /> Chọn học sinh</label>}
                        <div className="flex items-start justify-between gap-2">
                            <div><p className="text-xs text-slate-400">#{idx + 1}</p><p className="text-sm font-bold text-slate-800">{student.fullName}</p></div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                                {selectionEnabled && onOpenCoinAwards && (
                                    <button type="button" onClick={() => openSingleCoinAward(student.id)} disabled={selectionIsDisabled} className="min-h-10 rounded-lg border border-orange-200 bg-orange-50 px-3 text-xs font-bold text-orange-800 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`+ Xu cho ${student.fullName}`}>
                                        + Xu
                                    </button>
                                )}
                                <button onClick={() => onParentAccess(student)} disabled={serverActionsDisabled} className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 inline-flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50" title={serverActionsDisabled ? 'Cần kết nối mạng để quản lý quyền phụ huynh.' : 'Quản lý quyền phụ huynh'} aria-label={`Quản lý quyền phụ huynh cho ${student.fullName}`}><QrCode className="w-4 h-4" /></button>
                                <button onClick={() => onResetPassword(student.id)} disabled={serverActionsDisabled} className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 inline-flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50" title={serverActionsDisabled ? 'Cần kết nối mạng để đặt lại mật khẩu.' : 'Đặt lại mật khẩu'} aria-label={`Đặt lại mật khẩu cho ${student.fullName}`}><KeyRound className="w-4 h-4" /></button>
                                <button disabled={serverActionsDisabled} onClick={() => showConfirm({ message: `Lưu trữ học sinh "${student.fullName}" khỏi lớp? Tài khoản sẽ ẩn khỏi danh sách nhưng lịch sử học tập vẫn được bảo toàn.`, confirmLabel: 'Lưu trữ', destructive: true, onConfirm: () => onRemoveStudent(student.id, classId) })} className="h-10 w-10 rounded-lg bg-amber-50 text-amber-700 inline-flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50" title={serverActionsDisabled ? 'Cần kết nối mạng để lưu trữ học sinh.' : 'Lưu trữ học sinh'} aria-label={`Lưu trữ học sinh ${student.fullName}`}><Archive className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <div className="text-sm text-slate-600"><p className="mb-1"><span className="font-semibold text-slate-500">Tài khoản:</span>{' '}<code className="bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-700">{student.username}</code></p><p><span className="font-semibold text-slate-500">SĐT phụ huynh:</span> {student.parentPhone || '—'}</p></div>
                    </div>
                )}
            />
            {bulkAction}
        </div>
    );
});

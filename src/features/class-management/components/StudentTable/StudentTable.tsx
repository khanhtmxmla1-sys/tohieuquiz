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
}

export const StudentTable: React.FC<StudentTableProps> = memo(({
    students,
    classId,
    onResetPassword,
    onRemoveStudent,
    onParentAccess,
    serverActionsDisabled = false,
}) => {
    return (
        <ResponsiveDataView
            items={students}
            keyExtractor={(student) => student.id}
            renderDesktop={() => (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
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
                                    <td className="py-3 px-4 text-sm text-gray-400">{idx + 1}</td>
                                    <td className="py-3 px-4 font-medium text-gray-800">{student.fullName}</td>
                                    <td className="py-3 px-4">
                                        <code className="bg-gray-100 px-2 py-0.5 rounded text-sm text-gray-600">
                                            {student.username}
                                        </code>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-500">
                                        {student.parentPhone || '—'}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => onParentAccess(student)}
                                                disabled={serverActionsDisabled}
                                                className="p-1.5 text-indigo-900 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
                                                title={serverActionsDisabled ? 'Cần kết nối mạng để quản lý quyền phụ huynh.' : 'Quản lý quyền phụ huynh'}
                                                aria-label={`Quản lý quyền phụ huynh cho ${student.fullName}`}
                                            >
                                                <QrCode className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => onResetPassword(student.id)}
                                                disabled={serverActionsDisabled}
                                                className="p-1.5 text-blue-900 hover:text-blue-600 hover:bg-blue-50 rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
                                                title={serverActionsDisabled ? 'Cần kết nối mạng để đặt lại mật khẩu.' : 'Đặt lại mật khẩu'}
                                                aria-label={`Đặt lại mật khẩu cho ${student.fullName}`}
                                            >
                                                <KeyRound className="w-4 h-4" />
                                            </button>
                                            <button
                                                disabled={serverActionsDisabled}
                                                onClick={() => {
                                                    showConfirm({
                                                        message: `Lưu trữ học sinh "${student.fullName}" khỏi lớp? Tài khoản sẽ ẩn khỏi danh sách nhưng lịch sử học tập vẫn được bảo toàn.`,
                                                        confirmLabel: 'Lưu trữ',
                                                        destructive: true,
                                                        onConfirm: () => onRemoveStudent(student.id, classId),
                                                    });
                                                }}
                                                className="p-1.5 text-amber-900 hover:text-amber-700 hover:bg-amber-50 rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
                                                title={serverActionsDisabled ? 'Cần kết nối mạng để lưu trữ học sinh.' : 'Lưu trữ học sinh'}
                                                aria-label={`Lưu trữ học sinh ${student.fullName}`}
                                            >
                                                <Archive className="w-4 h-4" />
                                            </button>
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
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className="text-xs text-slate-400">#{idx + 1}</p>
                            <p className="text-sm font-bold text-slate-800">{student.fullName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => onParentAccess(student)}
                                disabled={serverActionsDisabled}
                                className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 inline-flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
                                title={serverActionsDisabled ? 'Cần kết nối mạng để quản lý quyền phụ huynh.' : 'Quản lý quyền phụ huynh'}
                                aria-label={`Quản lý quyền phụ huynh cho ${student.fullName}`}
                            >
                                <QrCode className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => onResetPassword(student.id)}
                                disabled={serverActionsDisabled}
                                className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 inline-flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
                                title={serverActionsDisabled ? 'Cần kết nối mạng để đặt lại mật khẩu.' : 'Đặt lại mật khẩu'}
                                aria-label={`Đặt lại mật khẩu cho ${student.fullName}`}
                            >
                                <KeyRound className="w-4 h-4" />
                            </button>
                            <button
                                disabled={serverActionsDisabled}
                                onClick={() => {
                                    showConfirm({
                                        message: `Lưu trữ học sinh "${student.fullName}" khỏi lớp? Tài khoản sẽ ẩn khỏi danh sách nhưng lịch sử học tập vẫn được bảo toàn.`,
                                        confirmLabel: 'Lưu trữ',
                                        destructive: true,
                                        onConfirm: () => onRemoveStudent(student.id, classId),
                                    });
                                }}
                                className="h-10 w-10 rounded-lg bg-amber-50 text-amber-700 inline-flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
                                title={serverActionsDisabled ? 'Cần kết nối mạng để lưu trữ học sinh.' : 'Lưu trữ học sinh'}
                                aria-label={`Lưu trữ học sinh ${student.fullName}`}
                            >
                                <Archive className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div className="text-sm text-slate-600">
                        <p className="mb-1">
                            <span className="font-semibold text-slate-500">Tài khoản:</span>{' '}
                            <code className="bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-700">{student.username}</code>
                        </p>
                        <p>
                            <span className="font-semibold text-slate-500">SĐT phụ huynh:</span> {student.parentPhone || '—'}
                        </p>
                    </div>
                </div>
            )}
        />
    );
});

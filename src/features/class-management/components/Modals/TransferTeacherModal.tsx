import React from 'react';
import { X, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../../../../components/common';
import { Classroom, TeacherRecord } from '../../types';

interface TransferTeacherModalProps {
    classroom: Classroom;
    teachers: TeacherRecord[];
    selectedTeacherUsername: string;
    onSelectTeacher: (username: string) => void;
    onClose: () => void;
    onSubmit: () => Promise<void>;
    isLoadingTeachers: boolean;
    isSaving: boolean;
    error: string | null;
}

export const TransferTeacherModal: React.FC<TransferTeacherModalProps> = ({
    classroom,
    teachers,
    selectedTeacherUsername,
    onSelectTeacher,
    onClose,
    onSubmit,
    isLoadingTeachers,
    isSaving,
    error,
}) => {
    const submitDisabled = isLoadingTeachers || isSaving || !selectedTeacherUsername.trim();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md" onClick={onClose}>
            <div
                className="bg-white w-full h-dvh md:h-auto md:max-h-[90vh] md:max-w-md rounded-none md:rounded-2xl shadow-xl p-5 md:p-6 md:mx-4 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Chuyển giáo viên</h2>
                        <p className="text-sm text-gray-500 mt-1">Lớp: {classroom.name}</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm mb-4">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Giáo viên mới</label>
                        <select
                            value={selectedTeacherUsername}
                            onChange={(e) => onSelectTeacher(e.target.value)}
                            disabled={isLoadingTeachers || isSaving}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-gray-50"
                        >
                            <option value="">-- Chọn giáo viên --</option>
                            {teachers.map((teacher) => (
                                <option key={teacher.username} value={teacher.username}>
                                    {teacher.full_name} ({teacher.username})
                                    {teacher.class ? ` - Phụ trách: ${teacher.class}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {isLoadingTeachers && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Đang tải danh sách giáo viên...
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <Button onClick={onClose} variant="secondary" className="flex-1" disabled={isSaving}>
                            Hủy
                        </Button>
                        <Button
                            onClick={onSubmit}
                            variant="primary"
                            className="flex-1"
                            disabled={submitDisabled}
                            icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        >
                            {isSaving ? 'Đang chuyển...' : 'Xác nhận'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

import React, { useId, useRef, useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { Button } from '../../../../components/common';
import type { TeacherRecord } from '../../types';
import { useDialogFocus } from '../../../../hooks/useDialogFocus';

interface CreateClassModalProps {
    onClose: () => void;
    onCreate: (name: string, teacherUsername: string) => Promise<any>;
    isLoading: boolean;
    teachers: TeacherRecord[];
    isLoadingTeachers: boolean;
    error?: string | null;
}

export const CreateClassModal: React.FC<CreateClassModalProps> = ({ onClose, onCreate, isLoading, teachers, isLoadingTeachers, error }) => {
    const [name, setName] = useState('');
    const [teacherUsername, setTeacherUsername] = useState('');
    const dialogRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const titleId = useId();
    const requestClose = () => {
        if (!isLoading && !isLoadingTeachers) onClose();
    };

    useDialogFocus({
        isOpen: true,
        dialogRef,
        initialFocusRef: nameInputRef,
        onClose: requestClose,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !teacherUsername.trim()) return;
        await onCreate(name.trim(), teacherUsername.trim());
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md" onClick={requestClose}>
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className="bg-white w-full h-dvh md:h-auto md:max-h-[90vh] md:max-w-md rounded-none md:rounded-2xl shadow-xl p-5 md:p-6 md:mx-4 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 id={titleId} className="text-xl font-bold text-gray-800">Tạo lớp mới</h2>
                    <button type="button" onClick={requestClose} disabled={isLoading || isLoadingTeachers} aria-label="Đóng" className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-50">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
                {error && (
                    <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="create-class-name" className="block text-sm font-medium text-gray-700 mb-1">Tên lớp</label>
                        <input
                            ref={nameInputRef}
                            id="create-class-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="VD: Lớp Toán 5A"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label htmlFor="create-class-teacher" className="block text-sm font-medium text-gray-700 mb-1">Giáo viên phụ trách</label>
                        <select
                            id="create-class-teacher"
                            value={teacherUsername}
                            onChange={(e) => setTeacherUsername(e.target.value)}
                            disabled={isLoadingTeachers || isLoading}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none disabled:bg-gray-50"
                        >
                            <option value="">-- Chọn giáo viên --</option>
                            {teachers.map((teacher) => (
                                <option key={teacher.username} value={teacher.username}>
                                    {teacher.full_name} ({teacher.username})
                                </option>
                            ))}
                        </select>
                        {!isLoadingTeachers && !error && teachers.length === 0 && (
                            <p className="text-xs text-amber-700 mt-1">Chưa có giáo viên đang hoạt động để phân công lớp.</p>
                        )}
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button onClick={onClose} variant="secondary" className="flex-1">Hủy</Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="flex-1"
                            disabled={!name.trim() || !teacherUsername.trim() || isLoading || isLoadingTeachers}
                            icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        >
                            {isLoading ? 'Đang tạo...' : 'Tạo lớp'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

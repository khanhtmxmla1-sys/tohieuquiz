import React from 'react';
import { Users, Archive, RefreshCw, ClipboardList, Activity } from 'lucide-react';
import { Classroom } from '../../types';

interface ClassCardProps {
    classroom: Classroom;
    isAdmin: boolean;
    onClick: () => void;
    onTransfer: () => void;
    onDelete: () => void;
}

export const ClassCard: React.FC<ClassCardProps> = ({ classroom, isAdmin, onClick, onTransfer, onDelete }) => {
    return (
        <div
            className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:border-orange-200 transition-all cursor-pointer group"
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onClick(); }}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 bg-orange-50 rounded-xl group-hover:bg-orange-100 transition-colors">
                    <Users className="w-6 h-6 text-orange-500" />
                </div>
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                    {isAdmin && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onTransfer();
                            }}
                            className="p-1.5 text-blue-900 hover:text-blue-600 hover:bg-indigo-50 rounded-lg"
                            title="Chuyển giáo viên phụ trách"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    )}
                    {isAdmin && <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        className="p-1.5 text-amber-950 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                        title="Lưu trữ lớp học"
                        aria-label={`Lưu trữ lớp ${classroom.name}`}
                    >
                        <Archive className="w-4 h-4" />
                    </button>}
                </div>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">{classroom.name}</h3>
            <p className="text-sm text-gray-500 mb-1">
                GV phụ trách: {classroom.teacherFullName || classroom.teacherUsername || 'Chưa phân công'}
            </p>
            <p className="text-sm text-gray-400">
                Tạo ngày {new Date(classroom.createdAt).toLocaleDateString('vi-VN')}
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-600">
                <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5 text-orange-500" /> {classroom.studentCount || 0} học sinh</span>
                <span className="inline-flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5 text-indigo-500" /> {classroom.assignmentCount || 0} bài giao</span>
                <span className="col-span-2 inline-flex items-center gap-1 text-gray-400"><Activity className="w-3.5 h-3.5" /> {classroom.lastActivityAt ? `Hoạt động ${new Date(classroom.lastActivityAt).toLocaleDateString('vi-VN')}` : 'Chưa có hoạt động'}</span>
            </div>
        </div>
    );
};

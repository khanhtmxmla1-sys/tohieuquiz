import React, { useMemo, useState } from 'react';
import { AlertCircle, Loader2, Plus, RefreshCw, Search } from 'lucide-react';
import { Classroom } from '../types';
import { Button } from '../../../components/common';
import { ClassCard } from '../components/ClassCard';

interface ClassListViewProps {
    classes: Classroom[];
    isAdmin: boolean;
    onSelectClass: (classroom: Classroom) => void;
    onCreateClick: () => void;
    onTransferClick: (classroom: Classroom) => void;
    onDeleteClick: (classroom: Classroom) => void;
    isLoading: boolean;
    error: string | null;
    onRetry: () => void;
}

export const ClassListView: React.FC<ClassListViewProps> = ({
    classes, isAdmin, onSelectClass, onCreateClick, onTransferClick, onDeleteClick, isLoading, error, onRetry,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'students' | 'recent'>('name');
    const visibleClasses = useMemo(() => {
        const keyword = searchTerm.trim().toLocaleLowerCase('vi');
        return [...classes]
            .filter((classroom) => !keyword || classroom.name.toLocaleLowerCase('vi').includes(keyword) || (classroom.teacherFullName || classroom.teacherUsername).toLocaleLowerCase('vi').includes(keyword))
            .sort((a, b) => {
                if (sortBy === 'students') return (b.studentCount || 0) - (a.studentCount || 0);
                if (sortBy === 'recent') return String(b.lastActivityAt || b.createdAt).localeCompare(String(a.lastActivityAt || a.createdAt));
                return a.name.localeCompare(b.name, 'vi');
            });
    }, [classes, searchTerm, sortBy]);

    if (isLoading && classes.length === 0) {
        return <div className="min-h-[320px] flex items-center justify-center"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /><span className="ml-3 text-gray-500">Đang tải lớp học…</span></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-gray-800">Danh sách lớp học</h2>
                {isAdmin && <Button onClick={onCreateClick} variant="primary" icon={<Plus className="w-5 h-5" />}>Tạo lớp mới</Button>}
            </div>

            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-700"><span className="inline-flex items-center gap-2"><AlertCircle className="w-5 h-5" />{error}</span><Button variant="secondary" onClick={onRetry} icon={<RefreshCw className="w-4 h-4" />}>Thử lại</Button></div>}

            {classes.length > 0 && <div className="flex flex-col sm:flex-row gap-3 bg-white border border-gray-100 rounded-2xl p-3"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input className="w-full pl-9 pr-3 py-2.5 border rounded-xl" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm lớp hoặc giáo viên…" /></div><select className="px-3 py-2.5 border rounded-xl bg-white" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}><option value="name">Theo tên lớp</option><option value="students">Theo sĩ số</option><option value="recent">Hoạt động gần nhất</option></select></div>}

            {!isLoading && !error && classes.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4"><Plus className="w-8 h-8 text-orange-500" /></div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">Chưa có lớp học nào</h3>
                    {isAdmin ? <><p className="text-gray-500 mb-6">Hãy tạo lớp học đầu tiên của bạn</p><Button onClick={onCreateClick} variant="primary">Tạo lớp ngay</Button></> : <p className="text-gray-500 mb-6">Giáo viên chưa được cấp lớp. Vui lòng liên hệ quản trị viên.</p>}
                </div>
            ) : visibleClasses.length === 0 && classes.length > 0 ? (
                <div className="bg-white rounded-2xl border p-12 text-center text-gray-500">Không tìm thấy lớp phù hợp.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {visibleClasses.map((classroom) => <ClassCard key={classroom.id} classroom={classroom} isAdmin={isAdmin} onClick={() => onSelectClass(classroom)} onTransfer={() => onTransferClick(classroom)} onDelete={() => onDeleteClick(classroom)} />)}
                </div>
            )}
        </div>
    );
};

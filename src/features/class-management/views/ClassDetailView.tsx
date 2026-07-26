import React, { useMemo, useState } from 'react';
import { ArrowLeft, UserPlus, Loader2, Search, RefreshCw } from 'lucide-react';
import { Classroom, CreateStudentPayload } from '../types';
import { Button } from '../../../components/common';
import { StudentTable } from '../components/StudentTable';
import { AddStudentModal, ResetPasswordModal } from '../components/Modals';
import ParentAccessModal from '../components/ParentAccessModal';
import ParentCommunicationPanel from '../components/ParentCommunicationPanel';
import { useRosterStore } from '../../../stores/useRosterStore';
import { showSuccess, showError } from '../../../utils/toast';
import type { Student } from '../types';

interface ClassDetailViewProps {
    classroom: Classroom;
    onBack: () => void;
}

export const ClassDetailView: React.FC<ClassDetailViewProps> = ({ classroom, onBack }) => {
    const store = useRosterStore();
    const students = store.students[classroom.id] || [];
    const isLoadingStudents = store.isLoading;
    
    const [showAddModal, setShowAddModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'username' | 'newest'>('name');
    const [resettingStudent, setResettingStudent] = useState<Student | null>(null);
    const [resetError, setResetError] = useState<string | null>(null);
    const [isResetting, setIsResetting] = useState(false);
    const [parentAccessStudent, setParentAccessStudent] = useState<Student | null>(null);

    const visibleStudents = useMemo(() => {
        const keyword = searchTerm.trim().toLocaleLowerCase('vi');
        return students
            .filter((student) => !keyword || student.fullName.toLocaleLowerCase('vi').includes(keyword) || student.username.toLowerCase().includes(keyword) || (student.parentPhone || '').includes(keyword))
            .sort((a, b) => {
                if (sortBy === 'username') return a.username.localeCompare(b.username);
                if (sortBy === 'newest') return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
                return a.fullName.localeCompare(b.fullName, 'vi');
            });
    }, [students, searchTerm, sortBy]);

    const handleAddStudent = async (payload: CreateStudentPayload) => {
        setIsSaving(true);
        setAddError(null);
        try {
            const added = await store.addStudent(payload);
            if (added) {
                setShowAddModal(false);
            } else {
                setAddError('Tên đăng nhập đã tồn tại hoặc có lỗi xảy ra.');
            }
        } catch (err: unknown) {
            const normalizedError = err instanceof Error ? err : new Error(String(err));
            setAddError(normalizedError.message || 'Lỗi thêm học sinh');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddBatch = async (payloads: CreateStudentPayload[]) => {
        setIsSaving(true);
        setAddError(null);
        try {
            const result = await store.addStudentsBulk(payloads, classroom.id);
            if (!result) {
                setAddError(store.error || 'Không thể nhập danh sách học sinh.');
                return null;
            }
            if (result.errorCount > 0) setAddError(`Đã thêm ${result.successCount}/${payloads.length} học sinh. Xem chi tiết phía dưới.`);
            else showSuccess(`Đã thêm thành công ${result.successCount} học sinh`);
            return result;
        } catch (err: unknown) {
             const normalizedError = err instanceof Error ? err : new Error(String(err));
             setAddError(normalizedError.message || 'Lỗi thêm danh sách học sinh');
            return null;
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetPassword = (studentId: string) => {
        const student = students.find((item) => item.id === studentId);
        if (student) {
            setResetError(null);
            setResettingStudent(student);
        }
    };

    const submitResetPassword = async (newPassword: string) => {
        if (!resettingStudent) return;
        setIsResetting(true);
        setResetError(null);
        try {
            const ok = await store.resetPassword(resettingStudent.id, newPassword, '');
            if (!ok) {
                setResetError(store.error || 'Không thể đặt lại mật khẩu.');
                return;
            }
            try { await navigator.clipboard.writeText(newPassword); } catch { /* Clipboard may be unavailable. */ }
            showSuccess('Đã đặt lại mật khẩu và sao chép vào bộ nhớ tạm.');
            setResettingStudent(null);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Không thể đặt lại mật khẩu.';
            setResetError(message);
            showError(message);
        } finally {
            setIsResetting(false);
        }
    };

    const handleRemoveStudent = async (studentId: string, classId: string) => {
        await store.removeStudent(studentId, classId);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 -ml-2 text-gray-500 hover:text-gray-800 hover:bg-white rounded-xl transition-all shadow-sm">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Lớp {classroom.name}</h2>
                        <p className="text-sm text-gray-500 mt-1">Sĩ số: {students.length} học sinh</p>
                    </div>
                </div>
                <Button onClick={() => setShowAddModal(true)} variant="primary" icon={<UserPlus className="w-4 h-4" />}>
                    Thêm học sinh
                </Button>
            </div>

            {students.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-3 bg-white border border-gray-100 rounded-2xl p-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm theo tên, tài khoản hoặc SĐT…" className="w-full pl-9 pr-3 py-2.5 border rounded-xl" />
                    </div>
                    <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="px-3 py-2.5 border rounded-xl bg-white">
                        <option value="name">Sắp xếp theo họ tên</option>
                        <option value="username">Sắp xếp theo tài khoản</option>
                        <option value="newest">Mới thêm gần đây</option>
                    </select>
                    <button onClick={() => store.fetchStudents(classroom.id)} className="h-11 px-4 rounded-xl bg-gray-100 text-gray-700 inline-flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4" /> Tải lại</button>
                </div>
            )}

            {store.error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">{store.error}</div>}

            <ParentCommunicationPanel classId={classroom.id} />

            {isLoadingStudents ? (
                 <div className="flex items-center justify-center py-12">
                     <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                 </div>
            ) : visibleStudents.length > 0 ? (
                <StudentTable
                    students={visibleStudents}
                    classId={classroom.id}
                    onResetPassword={handleResetPassword}
                    onRemoveStudent={handleRemoveStudent}
                    onParentAccess={setParentAccessStudent}
                />
            ) : students.length > 0 ? (
                <div className="bg-white rounded-2xl border p-10 text-center text-gray-500">Không tìm thấy học sinh phù hợp.</div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserPlus className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">Chưa có học sinh</h3>
                    <p className="text-gray-500 mb-6">Thêm học sinh để bắt đầu giao bài tập</p>
                    <Button onClick={() => setShowAddModal(true)} variant="primary">Thêm học sinh đầu tiên</Button>
                </div>
            )}

            {showAddModal && (
                <AddStudentModal
                    classId={classroom.id}
                    onClose={() => setShowAddModal(false)}
                    onAdd={handleAddStudent}
                    onAddBatch={handleAddBatch}
                    isLoading={isSaving}
                    error={addError}
                />
            )}
            {resettingStudent && (
                <ResetPasswordModal student={resettingStudent} isSaving={isResetting} error={resetError} onClose={() => !isResetting && setResettingStudent(null)} onSubmit={submitResetPassword} />
            )}
            {parentAccessStudent && (
                <ParentAccessModal
                    studentId={parentAccessStudent.id}
                    studentName={parentAccessStudent.fullName}
                    className={classroom.name}
                    onClose={() => setParentAccessStudent(null)}
                />
            )}
        </div>
    );
};

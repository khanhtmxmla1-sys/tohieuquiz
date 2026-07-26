import { useState, useCallback } from 'react';
import { useClassStore } from '../../../stores/useClassStore';
import { useRosterStore } from '../../../stores/useRosterStore';
import { callApi } from '../../../services/apiAdapter';
import { Classroom, TeacherRecord } from '../types';
import { showConfirm } from '../../../utils/toast';

export const useClassManagement = (isAdmin: boolean, username: string | null) => {
    const classStore = useClassStore();
    const rosterStore = useRosterStore();
    
    // View State
    const [selectedClass, setSelectedClass] = useState<Classroom | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    
    // Transfer State
    const [transferClassroom, setTransferClassroom] = useState<Classroom | null>(null);
    const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
    const [transferTeacherUsername, setTransferTeacherUsername] = useState('');
    const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);
    const [transferError, setTransferError] = useState<string | null>(null);

    // Initial Loading is handled top-level context/effects

    const handleCreateClass = async (name: string) => {
        if (!username) return false;
        const result = await classStore.addClass({
            name,
            teacherUsername: username,
        });
        if (result) setShowCreateModal(false);
        return result;
    };

    const handleDeleteClass = (classroom: Classroom) => {
        showConfirm({
            message: `Lưu trữ lớp "${classroom.name}"? Lớp sẽ ẩn khỏi danh sách nhưng toàn bộ kết quả, học sinh và chứng nhận vẫn được bảo toàn.`,
            confirmLabel: 'Lưu trữ',
            destructive: true,
            onConfirm: () => classStore.removeClass(classroom.id),
        });
    };

    const openTransferModal = async (classroom: Classroom) => {
        if (!isAdmin) return;
        setTransferClassroom(classroom);
        setTransferTeacherUsername(classroom.teacherUsername || '');
        setTransferError(null);
        setIsLoadingTeachers(true);
        
        try {
            const data = await callApi<{ data?: { items?: TeacherRecord[] } }>('get_teachers', { status: 'ACTIVE', pageSize: 100 });
            const rows = data.data?.items || [];
            if (Array.isArray(rows)) {
                const teacherList = rows.filter((t) => {
                    const isAdminRole = String(t.role || '').trim().toLowerCase() === 'admin';
                    return !isAdminRole || t.username === classroom.teacherUsername;
                });
                setTeachers(teacherList);
            } else {
                setTeachers([]);
            }
        } catch (err: unknown) {
            const normalizedError = err instanceof Error ? err : new Error(String(err));
            setTransferError(normalizedError.message || 'Cannot load teacher list.');
            setTeachers([]);
        } finally {
            setIsLoadingTeachers(false);
        }
    };

    const handleTransferTeacher = async () => {
        if (!transferClassroom || !username) return;
        if (!transferTeacherUsername.trim()) {
            setTransferError('Please choose a teacher.');
            return;
        }
        if (transferTeacherUsername === transferClassroom.teacherUsername) {
            setTransferError('Teacher is already assigned to this class.');
            return;
        }

        setIsTransferring(true);
        setTransferError(null);
        try {
            const res = await callApi<{ status: string; message?: string }>('transfer_class_teacher', {
                classId: transferClassroom.id,
                teacherUsername: transferTeacherUsername,
                actorUsername: username,
            });
            if (res.status !== 'success') {
                setTransferError(res.message || 'Cannot transfer teacher.');
                return;
            }

            await classStore.fetchClasses(); // Refresh
            setTransferClassroom(null);
            setTransferTeacherUsername('');
            setTeachers([]);
        } catch (err: unknown) {
            const normalizedError = err instanceof Error ? err : new Error(String(err));
            setTransferError(normalizedError.message || 'Cannot transfer teacher.');
        } finally {
            setIsTransferring(false);
        }
    };

    const closeTransferModal = () => {
        if (isTransferring) return;
        setTransferClassroom(null);
        setTransferTeacherUsername('');
        setTransferError(null);
    };

    return {
        // Mode & Selection
        selectedClass,
        setSelectedClass,
        
        // Creation Modal
        showCreateModal,
        setShowCreateModal,
        handleCreateClass,
        
        // Deletion
        handleDeleteClass,
        
        // Transfer Modal
        transferClassroom,
        transferTeacherUsername,
        setTransferTeacherUsername,
        teachers,
        openTransferModal,
        closeTransferModal,
        handleTransferTeacher,
        isLoadingTeachers,
        isTransferring,
        transferError,
        
        // Store Bindings
        store: {
            ...classStore,
            ...rosterStore,
            isLoading: classStore.isLoading || rosterStore.isLoading,
            error: classStore.error || rosterStore.error,
            clearError: () => {
                classStore.clearError();
                rosterStore.clearError();
            },
        },
    };
};

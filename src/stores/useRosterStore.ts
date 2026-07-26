import { create } from 'zustand';
import type { CreateStudentPayload, Student } from '../types/classroom.types';
import * as classroomService from '../services/classroomService';

interface RosterStore {
    students: Record<string, Student[]>;
    isLoading: boolean;
    error: string | null;

    fetchStudents: (classId: string) => Promise<void>;
    addStudent: (payload: CreateStudentPayload) => Promise<Student | null>;
    addStudentsBulk: (
        payloads: CreateStudentPayload[],
        classId: string
    ) => Promise<classroomService.BatchStudentResult | null>;
    removeStudent: (studentId: string, classId: string) => Promise<boolean>;
    resetPassword: (studentId: string, newPassword: string, actorUsername: string) => Promise<boolean>;
    clearError: () => void;
}

export const useRosterStore = create<RosterStore>((set) => ({
    students: {},
    isLoading: false,
    error: null,

    fetchStudents: async (classId) => {
        set({ isLoading: true, error: null });
        try {
            const students = await classroomService.getStudents(classId, 'teacher');
            set((state) => ({
                students: { ...state.students, [classId]: students },
                isLoading: false,
            }));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Không thể tải danh sách học sinh.';
            set({ error: message, isLoading: false });
        }
    },

    addStudent: async (payload) => {
        set({ isLoading: true, error: null });
        try {
            const student = await classroomService.addStudent(payload);
            if (student) {
                set((state) => {
                    const existing = state.students[payload.classId] || [];
                    return {
                        students: {
                            ...state.students,
                            [payload.classId]: [...existing, student],
                        },
                        isLoading: false,
                    };
                });
                return student;
            }
            set({ error: 'Khong the them hoc sinh.', isLoading: false });
            return null;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Lỗi khi thêm học sinh.';
            set({ error: message, isLoading: false });
            return null;
        }
    },

    addStudentsBulk: async (payloads, classId) => {
        set({ isLoading: true, error: null });
        try {
            const result = await classroomService.addStudentsBatch(payloads);
            if (result && result.successes.length > 0) {
                set((state) => {
                    const existing = state.students[classId] || [];
                    return {
                        students: {
                            ...state.students,
                            [classId]: [...existing, ...result.successes],
                        },
                        isLoading: false,
                    };
                });
                return result;
            }
            if (result && result.successes.length === 0) {
                set({ isLoading: false });
                return result;
            }
            set({ error: 'Khong the them hoc sinh hang loat.', isLoading: false });
            return null;
        } catch (err: unknown) {
            const normalizedError = err instanceof Error ? err : new Error(String(err));
            set({ error: normalizedError.message || 'Loi khi them hoc sinh hang loat.', isLoading: false });
            return null;
        }
    },

    removeStudent: async (studentId, classId) => {
        set({ isLoading: true, error: null });
        try {
            const ok = await classroomService.deleteStudent(studentId);
            if (ok) {
                set((state) => ({
                    students: {
                        ...state.students,
                        [classId]: (state.students[classId] || []).filter((student) => student.id !== studentId),
                    },
                    isLoading: false,
                }));
            } else {
                set({ isLoading: false });
            }
            return ok;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Lỗi khi lưu trữ học sinh.';
            set({ error: message, isLoading: false });
            return false;
        }
    },

    resetPassword: async (studentId, newPassword, actorUsername) => {
        set({ isLoading: true, error: null });
        try {
            const ok = await classroomService.resetStudentPassword(studentId, newPassword, actorUsername);
            if (!ok) {
                set({ isLoading: false, error: 'Khong the dat lai mat khau.' });
                return false;
            }
            set({ isLoading: false });
            return true;
        } catch (err: unknown) {
            const normalizedError = err instanceof Error ? err : new Error(String(err));
            set({ error: normalizedError.message || 'Loi khi dat lai mat khau.', isLoading: false });
            return false;
        }
    },

    clearError: () => set({ error: null }),
}));

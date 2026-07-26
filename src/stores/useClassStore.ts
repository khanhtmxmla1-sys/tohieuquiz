import { create } from 'zustand';
import type { Classroom, CreateClassPayload } from '../types/classroom.types';
import * as classroomService from '../services/classroomService';

interface ClassStore {
    classes: Classroom[];
    isLoading: boolean;
    error: string | null;

    fetchClasses: (teacherUsername?: string) => Promise<void>;
    addClass: (payload: CreateClassPayload) => Promise<Classroom | null>;
    removeClass: (classId: string) => Promise<boolean>;
    restoreClass: (classId: string) => Promise<boolean>;
    clearError: () => void;
}

export const useClassStore = create<ClassStore>((set) => ({
    classes: [],
    isLoading: false,
    error: null,

    fetchClasses: async (teacherUsername) => {
        set({ isLoading: true, error: null });
        try {
            const classes = await classroomService.getClasses(teacherUsername);
            set({ classes, isLoading: false });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Không thể tải danh sách lớp.';
            set({ error: message, isLoading: false });
        }
    },

    addClass: async (payload) => {
        set({ isLoading: true, error: null });
        try {
            const newClass = await classroomService.createClass(payload);
            if (newClass) {
                set((state) => ({ classes: [...state.classes, newClass], isLoading: false }));
                return newClass;
            }
            set({ error: 'Khong the tao lop.', isLoading: false });
            return null;
        } catch {
            set({ error: 'Loi khi tao lop.', isLoading: false });
            return null;
        }
    },

    removeClass: async (classId) => {
        set({ isLoading: true, error: null });
        try {
            const ok = await classroomService.deleteClass(classId);
            if (ok) {
                set((state) => ({
                    classes: state.classes.filter((item) => item.id !== classId),
                    isLoading: false,
                }));
            } else {
                set({ isLoading: false });
            }
            return ok;
        } catch {
            set({ error: 'Loi khi xoa lop.', isLoading: false });
            return false;
        }
    },

    restoreClass: async (classId) => {
        set({ isLoading: true, error: null });
        try {
            const ok = await classroomService.restoreClass(classId);
            set({ isLoading: false });
            return ok;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Không thể khôi phục lớp.';
            set({ error: message, isLoading: false });
            return false;
        }
    },

    clearError: () => set({ error: null }),
}));

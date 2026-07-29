import { create } from 'zustand';
import type { Classroom, CreateClassPayload } from '../types/classroom.types';
import * as classroomService from '../services/classroomService';
import { ApiError } from '../services/api/errors';

const isAccessDenied = (error: unknown): boolean => (
    error instanceof ApiError && (error.status === 401 || error.status === 403)
);

interface ClassStore {
    classes: Classroom[];
    isLoading: boolean;
    error: string | null;
    lastUpdatedAt: number | null;

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
    lastUpdatedAt: null,

    fetchClasses: async (teacherUsername) => {
        set({ isLoading: true, error: null });
        try {
            const classes = await classroomService.getClasses(teacherUsername);
            set({ classes, isLoading: false, lastUpdatedAt: Date.now() });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Không thể tải danh sách lớp.';
            set(isAccessDenied(error)
                ? { classes: [], error: message, isLoading: false, lastUpdatedAt: null }
                : { error: message, isLoading: false });
        }
    },

    addClass: async (payload) => {
        set({ isLoading: true, error: null });
        try {
            const newClass = await classroomService.createClass(payload);
            if (newClass) {
                set((state) => ({
                    classes: [...state.classes, newClass],
                    isLoading: false,
                    lastUpdatedAt: Date.now(),
                }));
                return newClass;
            }
            set({ error: 'Khong the tao lop.', isLoading: false });
            return null;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Không thể tạo lớp.';
            set(isAccessDenied(error)
                ? { classes: [], error: message, isLoading: false, lastUpdatedAt: null }
                : { error: message, isLoading: false });
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
                    lastUpdatedAt: Date.now(),
                }));
            } else {
                set({ isLoading: false });
            }
            return ok;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Không thể lưu trữ lớp.';
            set(isAccessDenied(error)
                ? { classes: [], error: message, isLoading: false, lastUpdatedAt: null }
                : { error: message, isLoading: false });
            return false;
        }
    },

    restoreClass: async (classId) => {
        set({ isLoading: true, error: null });
        try {
            const ok = await classroomService.restoreClass(classId);
            set((state) => ({
                isLoading: false,
                lastUpdatedAt: ok ? Date.now() : state.lastUpdatedAt,
            }));
            return ok;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Không thể khôi phục lớp.';
            set(isAccessDenied(error)
                ? { classes: [], error: message, isLoading: false, lastUpdatedAt: null }
                : { error: message, isLoading: false });
            return false;
        }
    },

    clearError: () => set({ error: null }),
}));

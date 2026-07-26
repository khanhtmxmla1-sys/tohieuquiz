import { create } from 'zustand';
import type { StudentLoginPayload, StudentSession } from '../types/classroom.types';
import type { PetData, ShopItem } from '../types/gamification.types';
import { StorageKeys } from '../constants/storageKeys';
import * as classroomService from '../services/classroomService';
import { useHomeworkStore } from '../features/homework/stores/useHomeworkStore';
import { useAssignmentStore } from './useAssignmentStore';
import { useGamificationStore } from './useGamificationStore';

interface ClassroomStore {
    studentSession: StudentSession | null;
    isLoading: boolean;
    error: string | null;

    loginStudent: (payload: StudentLoginPayload) => Promise<boolean>;
    logoutStudent: () => void;
    restoreStudentSession: () => Promise<void>;
    changeMyPassword: (studentId: string, currentPassword: string, newPassword: string) => Promise<boolean>;
    updateAvatar: (studentId: string, avatar: string) => Promise<boolean>;
    clearError: () => void;
}

export const useClassroomStore = create<ClassroomStore>((set, get) => ({
    studentSession: null,
    isLoading: false,
    error: null,

    loginStudent: async (payload) => {
        set({ isLoading: true, error: null });
        try {
            const session = await classroomService.studentLogin(payload);
            if (session) {
                localStorage.setItem(StorageKeys.STUDENT_SESSION, JSON.stringify(session));
                set({ studentSession: session, isLoading: false });

                if (session.pet || session.coins !== undefined) {
                    useGamificationStore.getState().initFromLoginData(
                        session.pet as PetData | null,
                        session.coins || 0,
                        (session.shopItems || []) as ShopItem[]
                    );
                }

                return true;
            }
            set({ error: 'Sai ten dang nhap hoac mat khau.', isLoading: false });
            return false;
        } catch {
            set({ error: 'Loi khi dang nhap.', isLoading: false });
            return false;
        }
    },

    logoutStudent: () => {
        void classroomService.logoutSession().catch(() => undefined);
        localStorage.removeItem(StorageKeys.STUDENT_SESSION);
        set({ studentSession: null });
        useAssignmentStore.getState().resetAssignments();
        useGamificationStore.getState().clearGamification();
        useHomeworkStore.getState().resetStore();
    },

    restoreStudentSession: async () => {
        const saved = localStorage.getItem(StorageKeys.STUDENT_SESSION);
        if (!saved) return;
        set({ isLoading: true, error: null });
        try {
            const session = await classroomService.getStudentProfile();
            if (!session) throw new Error('Student session is unavailable');
            localStorage.setItem(StorageKeys.STUDENT_SESSION, JSON.stringify(session));
            set({ studentSession: session, isLoading: false });
            useGamificationStore.getState().initFromLoginData(
                session.pet as PetData | null,
                session.coins || 0,
                (session.shopItems || []) as ShopItem[],
            );
        } catch {
            localStorage.removeItem(StorageKeys.STUDENT_SESSION);
            set({ studentSession: null, isLoading: false });
        }
    },

    changeMyPassword: async (studentId, currentPassword, newPassword) => {
        set({ isLoading: true, error: null });
        try {
            const ok = await classroomService.changeStudentPassword(studentId, currentPassword, newPassword);
            if (!ok) {
                set({ isLoading: false, error: 'Khong the doi mat khau.' });
                return false;
            }
            set({ isLoading: false });
            return true;
        } catch (err: unknown) {
            const normalizedError = err instanceof Error ? err : new Error(String(err));
            set({ error: normalizedError.message || 'Loi khi doi mat khau.', isLoading: false });
            return false;
        }
    },

    updateAvatar: async (studentId, avatar) => {
        try {
            const ok = await classroomService.updateStudentAvatar(studentId, avatar);
            if (ok) {
                const session = get().studentSession;
                if (session) {
                    const updatedSession = { ...session, avatar };
                    localStorage.setItem(StorageKeys.STUDENT_SESSION, JSON.stringify(updatedSession));
                    set({ studentSession: updatedSession });
                }
                return true;
            }
            return false;
        } catch (err) {
            console.error('Failed to update avatar', err);
            return false;
        }
    },

    clearError: () => set({ error: null }),
}));

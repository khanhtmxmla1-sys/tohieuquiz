/**
 * Auth Store
 *
 * Zustand store for Authentication management.
 * Handles teacher login, session, and authentication state.
 */

import { create } from 'zustand';
import type { Teacher } from '../types';

interface AuthStore {
    // State
    isAuthenticated: boolean;
    username: string | null;
    fullName: string | null;
    role: 'admin' | 'teacher' | null;
    teacherClass: string | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    login: (teacher: Teacher) => void;
    logout: () => void;
    setUser: (username: string, fullName: string, role?: 'admin' | 'teacher', teacherClass?: string) => void;
    restoreSession: () => void;

    // Utilities
    setLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
    clearError: () => void;
}

const AUTH_STORAGE_KEY = 'auth_session';

export const useAuthStore = create<AuthStore>((set, get) => ({
    // Initial state
    isAuthenticated: false,
    username: null,
    fullName: null,
    role: null,
    teacherClass: null,
    isLoading: false,
    error: null,

    // Actions
    login: (teacher) => {
        const session = {
            username: teacher.username,
            fullName: teacher.fullName,
            role: teacher.role || 'teacher',
            teacherClass: teacher.class || null,
        };

        // Save to localStorage
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));

        set({
            isAuthenticated: true,
            username: teacher.username,
            fullName: teacher.fullName,
            role: teacher.role || 'teacher',
            teacherClass: teacher.class || null,
            error: null,
        });
    },

    logout: () => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        set({
            isAuthenticated: false,
            username: null,
            fullName: null,
            role: null,
            teacherClass: null,
            error: null,
        });
    },

    setUser: (username, fullName, role = 'teacher', teacherClass) => {
        const session = {
            username,
            fullName,
            role,
            teacherClass: teacherClass || null,
        };

        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));

        set({
            isAuthenticated: true,
            username,
            fullName,
            role,
            teacherClass: teacherClass || null,
        });
    },

    restoreSession: () => {
        try {
            const saved = localStorage.getItem(AUTH_STORAGE_KEY);
            if (saved) {
                const session = JSON.parse(saved);
                set({
                    isAuthenticated: true,
                    username: session.username,
                    fullName: session.fullName,
                    role: session.role || 'teacher',
                    teacherClass: session.teacherClass || null,
                });
            }
        } catch (error) {
            console.error('Failed to restore auth session:', error);
            localStorage.removeItem(AUTH_STORAGE_KEY);
        }
    },

    // Utilities
    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
    clearError: () => set({ error: null }),
}));

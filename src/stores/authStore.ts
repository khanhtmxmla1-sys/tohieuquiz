/**
 * Legacy-compatible teacher metadata store.
 * Authentication credentials are held only in the HttpOnly cookie.
 */
import { create } from 'zustand';

const AUTH_SESSION_KEY = 'auth_session';

interface AuthState {
    isLoggingIn: boolean;
    isAuthenticated: boolean;
    username: string | null;
    fullName: string | null;
    isAdmin: boolean;
    teacherClass: string | null;

    loginStart: () => void;
    loginSuccess: (
        username: string,
        fullName: string,
        isAdmin?: boolean,
        teacherClass?: string
    ) => void;
    loginFailure: () => void;
    logout: () => void;
    restoreSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    isLoggingIn: false,
    isAuthenticated: false,
    username: null,
    fullName: null,
    isAdmin: false,
    teacherClass: null,

    loginStart: () => set({ isLoggingIn: true }),

    loginSuccess: (username, fullName, isAdmin = false, teacherClass) => {
        // Persist only non-sensitive display metadata.
        localStorage.setItem(
            AUTH_SESSION_KEY,
            JSON.stringify({ username, fullName, isAdmin, teacherClass: teacherClass ?? null })
        );
        set({
            isLoggingIn: false,
            isAuthenticated: true,
            username,
            fullName,
            isAdmin,
            teacherClass: teacherClass ?? null,
        });
    },

    loginFailure: () => set({ isLoggingIn: false }),

    logout: () => {
        localStorage.removeItem(AUTH_SESSION_KEY);
        set({
            isLoggingIn: false,
            isAuthenticated: false,
            username: null,
            fullName: null,
            isAdmin: false,
            teacherClass: null,
                });
    },

    restoreSession: () => {
        try {
            const raw = localStorage.getItem(AUTH_SESSION_KEY);
            if (raw) {
                const s = JSON.parse(raw);
                set({
                    isAuthenticated: true,
                    username: s.username ?? null,
                    fullName: s.fullName ?? null,
                    isAdmin: s.isAdmin ?? false,
                    teacherClass: s.teacherClass ?? null,
                });
            }
        } catch {
            localStorage.removeItem(AUTH_SESSION_KEY);
        }
    },
}));

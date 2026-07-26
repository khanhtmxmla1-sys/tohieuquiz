import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { callApi } from '../src/services/apiAdapter';

interface AuthState {
    // State
    isLoggedIn: boolean;
    username: string | null; // Add username
    teacherName: string | null;
    isAdmin: boolean;
    teacherClass: string | null; // Class this teacher is responsible for
    isLoggingIn: boolean;
    loginError: boolean;

    // Actions
    loginStart: () => void;
    loginSuccess: (username: string, name: string, isAdmin: boolean, teacherClass?: string | null) => void;
    loginFailure: () => void;
    loginPendingPasswordChange: () => void;
    logout: () => void;
    restoreSession: () => Promise<void>;
    resetError: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            // Initial state
            isLoggedIn: false,
            username: null,
            teacherName: null,
            isAdmin: false,
            teacherClass: null,
            isLoggingIn: false,
            loginError: false,

            // Actions
            loginStart: () => set({ isLoggingIn: true, loginError: false }),

            loginSuccess: (username, name, isAdmin, teacherClass) => set({
                isLoggedIn: true,
                username,
                teacherName: name,
                isAdmin,
                teacherClass: teacherClass || null,
                isLoggingIn: false,
                loginError: false
            }),

            loginFailure: () => set({
                isLoggingIn: false,
                loginError: true
            }),

            loginPendingPasswordChange: () => set({ isLoggingIn: false, loginError: false }),

            logout: () => {
                void callApi('logout').catch(() => undefined);
                set({
                isLoggedIn: false,
                username: null,
                teacherName: null,
                isAdmin: false,
                teacherClass: null,
                isLoggingIn: false,
                loginError: false
                });
            },

            restoreSession: async () => {
                if (!get().isLoggedIn) return;
                try {
                    const response = await callApi<{ data?: {
                        username: string;
                        fullName: string;
                        role: string;
                        classes?: Array<{ id: string; name: string }>;
                    } }>('get_account_profile');
                    const profile = response.data;
                    if (!profile?.username) throw new Error('Invalid account profile');
                    set({
                        isLoggedIn: true,
                        username: profile.username,
                        teacherName: profile.fullName || profile.username,
                        isAdmin: profile.role === 'admin',
                        isLoggingIn: false,
                        loginError: false,
                    });
                } catch {
                    set({
                        isLoggedIn: false,
                        username: null,
                        teacherName: null,
                        isAdmin: false,
                        teacherClass: null,
                        isLoggingIn: false,
                        loginError: false,
                    });
                }
            },

            resetError: () => set({ loginError: false })
        }),
        {
            name: 'auth-storage', // localStorage key
            partialize: (state) => ({
                isLoggedIn: state.isLoggedIn,
                username: state.username,
                teacherName: state.teacherName,
                isAdmin: state.isAdmin,
                teacherClass: state.teacherClass
            })
        }
    )
);

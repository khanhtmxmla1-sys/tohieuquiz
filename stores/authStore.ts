import { create } from 'zustand';
import { callApi } from '../src/services/apiAdapter';
import { StorageKeys } from '../src/constants/storageKeys';

export type AuthSessionStatus = 'anonymous' | 'checking' | 'authenticated';

interface AuthProfileResponse {
  data?: {
    username: string;
    fullName?: string;
    role?: string;
    teacherClass?: string | null;
    classes?: Array<{ id: string; name: string }>;
  };
}

interface AuthState {
  status: AuthSessionStatus;
  isLoggedIn: boolean;
  username: string | null;
  teacherName: string | null;
  isAdmin: boolean;
  teacherClass: string | null;
  isLoggingIn: boolean;
  loginError: boolean;
  loginStart: () => void;
  loginSuccess: (username: string, name: string, isAdmin: boolean, teacherClass?: string | null) => void;
  loginFailure: () => void;
  loginPendingPasswordChange: () => void;
  logoutLocal: () => void;
  logout: () => Promise<void>;
  restoreSession: (force?: boolean) => Promise<void>;
  resetError: () => void;
}

const anonymousState = {
  status: 'anonymous' as const,
  isLoggedIn: false,
  username: null,
  teacherName: null,
  isAdmin: false,
  teacherClass: null,
  isLoggingIn: false,
  loginError: false,
};

export const useAuthStore = create<AuthState>((set) => ({
  ...anonymousState,

  loginStart: () => set({ status: 'checking', isLoggingIn: true, loginError: false }),

  loginSuccess: (username, name, isAdmin, teacherClass) => {
    localStorage.setItem(StorageKeys.TEACHER_SESSION_RESTORE_HINT, '1');
    set({
      status: 'authenticated',
      isLoggedIn: true,
      username,
      teacherName: name,
      isAdmin,
      teacherClass: teacherClass || null,
      isLoggingIn: false,
      loginError: false,
    });
  },

  loginFailure: () => set({ ...anonymousState, loginError: true }),

  loginPendingPasswordChange: () => set({ status: 'anonymous', isLoggingIn: false, loginError: false }),

  logoutLocal: () => {
    localStorage.removeItem('auth-storage');
    localStorage.removeItem('auth_session');
    localStorage.removeItem(StorageKeys.TEACHER_SESSION_RESTORE_HINT);
    set(anonymousState);
  },

  logout: async () => {
    localStorage.removeItem('auth-storage');
    localStorage.removeItem('auth_session');
    localStorage.removeItem(StorageKeys.TEACHER_SESSION_RESTORE_HINT);
    set(anonymousState);
    try {
      await callApi('logout');
    } catch {
      // Client state is already cleared. Server cookie expiry can be retried by the next request.
    }
  },

  restoreSession: async (force = false) => {
    const shouldRestore = force
      || localStorage.getItem(StorageKeys.TEACHER_SESSION_RESTORE_HINT) === '1';
    localStorage.removeItem('auth-storage');
    localStorage.removeItem('auth_session');
    if (!shouldRestore) {
      set(anonymousState);
      return;
    }
    set({ ...anonymousState, status: 'checking' });
    try {
      const response = await callApi<AuthProfileResponse>('get_account_profile');
      const profile = response.data;
      if (!profile?.username) throw new Error('INVALID_ACCOUNT_PROFILE');
      localStorage.setItem(StorageKeys.TEACHER_SESSION_RESTORE_HINT, '1');
      set({
        status: 'authenticated',
        isLoggedIn: true,
        username: profile.username,
        teacherName: profile.fullName || profile.username,
        isAdmin: profile.role === 'admin',
        teacherClass: profile.teacherClass || profile.classes?.[0]?.name || null,
        isLoggingIn: false,
        loginError: false,
      });
    } catch {
      localStorage.removeItem(StorageKeys.TEACHER_SESSION_RESTORE_HINT);
      set(anonymousState);
    }
  },

  resetError: () => set({ loginError: false }),
}));

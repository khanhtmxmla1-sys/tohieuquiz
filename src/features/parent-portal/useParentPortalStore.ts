import { create } from 'zustand';
import type {
  ParentDashboardPayload,
  ParentNotificationItem,
  ParentStudentProfile,
} from '../../../shared/parent-portal.contract';
import { ApiError } from '../../services/api/errors';
import * as parentPortalService from './parentPortalService';

export interface ParentPortalState {
  session: ParentStudentProfile | null;
  dashboard: ParentDashboardPayload | null;
  accessCodeMasked: string | null;
  notifications: ParentNotificationItem[];
  unreadCount: number;
  isRestoring: boolean;
  isLoading: boolean;
  error: string | null;
  restoreSession(): Promise<void>;
  login(accessCode: string, pin: string): Promise<boolean>;
  activate(token: string, pin: string): Promise<boolean>;
  logout(): Promise<void>;
  loadDashboard(weekStart?: string): Promise<void>;
  loadNotifications(): Promise<void>;
  markNotificationRead(id: string): Promise<void>;
}

const clearedProtectedState = {
  session: null,
  dashboard: null,
  accessCodeMasked: null,
  notifications: [] as ParentNotificationItem[],
  unreadCount: 0,
};

const messageOf = (error: unknown): string => (
  error instanceof Error ? error.message : 'Đã xảy ra lỗi. Vui lòng thử lại.'
);
const isUnauthorized = (error: unknown): boolean => error instanceof ApiError && error.status === 401;

export const useParentPortalStore = create<ParentPortalState>((set) => ({
  ...clearedProtectedState,
  isRestoring: false,
  isLoading: false,
  error: null,

  restoreSession: async () => {
    set({ isRestoring: true, error: null });
    try {
      const response = await parentPortalService.getSession();
      set({ session: response.student, accessCodeMasked: response.accessCodeMasked || null, isRestoring: false });
    } catch (error) {
      set({ ...clearedProtectedState, isRestoring: false, error: isUnauthorized(error) ? null : messageOf(error) });
    }
  },

  login: async (accessCode, pin) => {
    set({ isLoading: true, error: null });
    try {
      const response = await parentPortalService.login(accessCode, pin);
      set({ session: response.student, accessCodeMasked: response.accessCodeMasked || null, isLoading: false });
      return true;
    } catch (error) {
      set({ ...clearedProtectedState, isLoading: false, error: messageOf(error) });
      return false;
    }
  },

  activate: async (token, pin) => {
    set({ isLoading: true, error: null });
    try {
      const response = await parentPortalService.activate(token, pin);
      set({ session: response.student, accessCodeMasked: response.accessCodeMasked || null, isLoading: false });
      return true;
    } catch (error) {
      set({ ...clearedProtectedState, isLoading: false, error: messageOf(error) });
      return false;
    }
  },

  logout: async () => {
    try {
      await parentPortalService.logout();
    } catch {
      // Local state must be cleared even when the network is unavailable.
    } finally {
      set({ ...clearedProtectedState, isLoading: false, isRestoring: false, error: null });
    }
  },

  loadDashboard: async (weekStart) => {
    set({ isLoading: true, error: null });
    try {
      const dashboard = await parentPortalService.getDashboard(weekStart);
      set({ dashboard, isLoading: false });
    } catch (error) {
      if (isUnauthorized(error)) {
        set({ ...clearedProtectedState, isLoading: false, error: null });
      } else {
        set({ isLoading: false, error: messageOf(error) });
      }
    }
  },

  loadNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await parentPortalService.listNotifications();
      set({
        notifications: response.items,
        unreadCount: response.unreadCount,
        isLoading: false,
      });
    } catch (error) {
      if (isUnauthorized(error)) {
        set({ ...clearedProtectedState, isLoading: false, error: null });
      } else {
        set({ isLoading: false, error: messageOf(error) });
      }
    }
  },

  markNotificationRead: async (id) => {
    try {
      await parentPortalService.markNotificationRead(id);
      set(state => {
        const wasUnread = state.notifications.some(item => item.id === id && !item.isRead);
        return {
          notifications: state.notifications.map(item => (
            item.id === id ? { ...item, isRead: true } : item
          )),
          unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
        };
      });
    } catch (error) {
      if (isUnauthorized(error)) set({ ...clearedProtectedState, error: null });
      else set({ error: messageOf(error) });
    }
  },
}));

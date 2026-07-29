import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { InboxNotification } from '../../../shared/notifications.contract';
import {
  fetchNotificationInbox,
  readAllNotifications,
  readNotification,
} from './notificationService';

const POLL_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 5 * 60_000;

export interface NotificationInboxState {
  items: InboxNotification[];
  unreadCount: number;
  isLoading: boolean;
  isRefreshing: boolean;
  isStale: boolean;
  error: string | null;
}

const messageFromError = (error: unknown): string => (
  error instanceof Error ? error.message : 'Kh?ng th? t?i th?ng b?o.'
);

export function useNotificationInbox(enabled = true) {
  const [state, setState] = useState<NotificationInboxState>({
    items: [],
    unreadCount: 0,
    isLoading: enabled,
    isRefreshing: false,
    isStale: false,
    error: null,
  });
  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const loadedRef = useRef(false);
  const failureCountRef = useRef(0);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (!enabled) return true;
    if (inFlightRef.current) return inFlightRef.current;

    const request = (async () => {
      setState((current) => ({
        ...current,
        isLoading: !loadedRef.current,
        isRefreshing: loadedRef.current,
      }));
      try {
        const page = await fetchNotificationInbox({ filter: 'all', limit: 25 });
        if (!mountedRef.current) return true;
        loadedRef.current = true;
        failureCountRef.current = 0;
        setState({
          items: page.items,
          unreadCount: page.unreadCount,
          isLoading: false,
          isRefreshing: false,
          isStale: false,
          error: null,
        });
        return true;
      } catch (error) {
        if (!mountedRef.current) return false;
        loadedRef.current = true;
        failureCountRef.current += 1;
        setState((current) => ({
          ...current,
          isLoading: false,
          isRefreshing: false,
          isStale: true,
          error: messageFromError(error),
        }));
        return false;
      } finally {
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = request;
    return request;
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      loadedRef.current = false;
      failureCountRef.current = 0;
      setState({
        items: [],
        unreadCount: 0,
        isLoading: false,
        isRefreshing: false,
        isStale: false,
        error: null,
      });
      return () => { mountedRef.current = false; };
    }

    let timer: number | undefined;
    let disposed = false;

    const schedule = (successful: boolean) => {
      if (disposed || document.visibilityState === 'hidden') return;
      const delay = successful
        ? POLL_INTERVAL_MS
        : Math.min(POLL_INTERVAL_MS * (2 ** failureCountRef.current), MAX_BACKOFF_MS);
      timer = window.setTimeout(run, delay);
    };
    const run = async () => {
      if (disposed || document.visibilityState === 'hidden') return;
      schedule(await refresh());
    };
    const handleVisibility = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      if (document.visibilityState === 'visible') void run();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    void run();
    return () => {
      disposed = true;
      mountedRef.current = false;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, refresh]);

  const markRead = useCallback(async (id: string): Promise<boolean> => {
    try {
      await readNotification(id);
      setState((current) => {
        const wasUnread = current.items.some((item) => item.id === id && !item.isRead);
        return {
          ...current,
          items: current.items.map((item) => (
            item.id === id ? { ...item, isRead: true } : item
          )),
          unreadCount: wasUnread ? Math.max(0, current.unreadCount - 1) : current.unreadCount,
          error: null,
        };
      });
      return true;
    } catch (error) {
      setState((current) => ({
        ...current,
        isStale: true,
        error: messageFromError(error),
      }));
      return false;
    }
  }, []);

  const markAllRead = useCallback(async (): Promise<boolean> => {
    try {
      await readAllNotifications();
      setState((current) => ({
        ...current,
        items: current.items.map((item) => ({ ...item, isRead: true })),
        unreadCount: 0,
        error: null,
      }));
      return true;
    } catch (error) {
      setState((current) => ({
        ...current,
        isStale: true,
        error: messageFromError(error),
      }));
      return false;
    }
  }, []);

  return {
    ...state,
    refresh,
    markRead,
    markAllRead,
  };
}

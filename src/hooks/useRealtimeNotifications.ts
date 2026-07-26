import { useMemo } from 'react';
import type { CertificateNotification } from '../../shared/certificates.contract';
import { useNotificationInbox } from '../features/notifications/useNotificationInbox';

export function useRealtimeNotifications(userId: string | null) {
  const inbox = useNotificationInbox(Boolean(userId));
  const notifications = useMemo<CertificateNotification[]>(() => (
    inbox.items.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      body: item.body,
      data: item.data,
      is_read: item.isRead,
      created_at: item.createdAt,
    }))
  ), [inbox.items]);

  return {
    notifications,
    isLoading: inbox.isLoading,
    refresh: inbox.refresh,
    markAsRead: inbox.markRead,
  };
}

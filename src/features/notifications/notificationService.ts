import type {
  InboxNotification,
  NotificationMetricBucket,
  NotificationPreferences,
} from '../../../shared/notifications.contract';
import { callApi } from '../../services/apiAdapter';

export interface InboxQuery {
  filter?: 'all' | 'unread';
  cursor?: string;
  limit?: number;
}

export interface InboxPage {
  items: InboxNotification[];
  nextCursor: string | null;
  unreadCount: number;
}

export async function fetchNotificationInbox(
  input: InboxQuery = {},
): Promise<InboxPage> {
  const response = await callApi<{ data?: InboxPage } & Partial<InboxPage>>(
    'get_notifications',
    input,
  );
  const page = response.data ?? response;
  return {
    items: Array.isArray(page.items) ? page.items : [],
    nextCursor: typeof page.nextCursor === 'string' ? page.nextCursor : null,
    unreadCount: Number.isFinite(Number(page.unreadCount))
      ? Math.max(0, Number(page.unreadCount))
      : 0,
  };
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await callApi<{ data?: NotificationPreferences } & Partial<NotificationPreferences>>(
    'get_notification_preferences',
  );
  return (response.data ?? response) as NotificationPreferences;
}

export async function saveNotificationPreferences(
  preferences: NotificationPreferences,
): Promise<NotificationPreferences> {
  const response = await callApi<{ data?: NotificationPreferences } & Partial<NotificationPreferences>>(
    'save_notification_preferences',
    preferences,
  );
  return (response.data ?? response) as NotificationPreferences;
}

export async function readNotification(id: string): Promise<void> {
  await callApi('mark_notification_read', { id });
}

export async function recordNotificationClick(id: string): Promise<void> {
  await callApi('record_notification_click', { id });
}

export async function readAllNotifications(): Promise<void> {
  await callApi('mark_all_notifications_read');
}

export async function fetchNotificationMetrics(input: {
  from?: string;
  to?: string;
} = {}): Promise<{ from: string; to: string; buckets: NotificationMetricBucket[] }> {
  const response = await callApi<{
    data?: { from: string; to: string; buckets: NotificationMetricBucket[] };
  }>('get_notification_metrics', input);
  return response.data ?? { from: '', to: '', buckets: [] };
}

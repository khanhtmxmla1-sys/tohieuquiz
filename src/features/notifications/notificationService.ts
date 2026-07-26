import type { InboxNotification } from '../../../shared/notifications.contract';
import { callApi } from '../../services/apiAdapter';

export interface InboxQuery {
  filter?: 'all' | 'unread';
  cursor?: string;
  limit?: number;
}

export interface InboxPage {
  items: InboxNotification[];
  nextCursor: string | null;
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
  };
}

export async function readNotification(id: string): Promise<void> {
  await callApi('mark_notification_read', { id });
}

export async function readAllNotifications(): Promise<void> {
  await callApi('mark_all_notifications_read');
}

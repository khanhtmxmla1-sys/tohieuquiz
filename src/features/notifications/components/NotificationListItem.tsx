import React from 'react';
import type { InboxNotification } from '../../../../shared/notifications.contract';

interface NotificationListItemProps {
  notification: InboxNotification;
  onOpen: (notification: InboxNotification) => void;
}

export function NotificationListItem({
  notification,
  onOpen,
}: NotificationListItemProps) {
  return (
    <button
      type="button"
      className={[
        'w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50',
        notification.isRead ? 'bg-white' : 'bg-sky-50/70',
      ].join(' ')}
      onClick={() => onOpen(notification)}
    >
      <span className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={[
            'mt-2 h-2 w-2 shrink-0 rounded-full',
            notification.isRead ? 'bg-transparent' : 'bg-sky-600',
          ].join(' ')}
        />
        <span className="min-w-0">
          <span className="block font-medium text-slate-900">{notification.title}</span>
          {notification.body && (
            <span className="mt-1 line-clamp-2 block text-sm text-slate-600">
              {notification.body}
            </span>
          )}
          <span className="mt-2 block text-xs text-slate-400">
            {new Date(notification.createdAt).toLocaleString('vi-VN')}
          </span>
        </span>
      </span>
    </button>
  );
}

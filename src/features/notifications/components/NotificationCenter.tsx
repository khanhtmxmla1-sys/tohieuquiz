import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCheck, X } from 'lucide-react';
import {
  resolveNotificationTarget,
  type InboxNotification,
  type NotificationTarget,
} from '../../../../shared/notifications.contract';
import { useNotificationInbox } from '../useNotificationInbox';
import { NotificationListItem } from './NotificationListItem';

interface NotificationCenterProps {
  enabled?: boolean;
  forceMobile?: boolean;
  onNavigate?: (target: NotificationTarget) => void;
}

export function NotificationCenter({
  enabled = true,
  forceMobile,
  onNavigate,
}: NotificationCenterProps) {
  const inbox = useNotificationInbox(enabled);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [viewportMobile, setViewportMobile] = useState(
    () => window.innerWidth < 768,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const isMobile = forceMobile ?? viewportMobile;

  useEffect(() => {
    const update = () => setViewportMobile(window.innerWidth < 768);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointerDown = (event: MouseEvent) => {
      if (isMobile || rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [isMobile, open]);

  const close = () => setOpen(false);
  const openNotification = async (notification: InboxNotification) => {
    if (!notification.isRead) await inbox.markRead(notification.id);
    const target = resolveNotificationTarget({
      type: notification.type,
      data: notification.data,
      actionUrl: notification.actionUrl,
    });
    if (target) onNavigate?.(target);
    close();
  };
  const visibleItems = filter === 'unread'
    ? inbox.items.filter((item) => !item.isRead)
    : inbox.items;

  const panel = (
    <section
      role="dialog"
      aria-modal={isMobile ? 'true' : 'false'}
      aria-labelledby={titleId}
      data-variant={isMobile ? 'bottom-sheet' : 'popover'}
      className={isMobile
        ? 'fixed inset-x-0 bottom-0 z-[70] max-h-[85dvh] overflow-hidden rounded-t-3xl bg-white shadow-2xl'
        : 'absolute right-0 top-full z-50 mt-2 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl'}
    >
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <h2 id={titleId} className="font-semibold text-slate-900">Thông báo</h2>
          <p className="text-xs text-slate-500">{inbox.unreadCount} chưa đọc</p>
        </div>
        <div className="flex items-center gap-1">
          {inbox.unreadCount > 0 && (
            <button
              type="button"
              aria-label="Đánh dấu tất cả đã đọc"
              className="rounded-full p-2 text-sky-700 hover:bg-sky-50"
              onClick={() => void inbox.markAllRead()}
            >
              <CheckCheck aria-hidden="true" className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            aria-label="Đóng hộp thư"
            className="rounded-full p-2 hover:bg-slate-100"
            onClick={close}
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      </header>
      <div className="flex gap-2 border-b border-slate-100 px-4 py-2">
        {(['all', 'unread'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            className={[
              'min-h-9 rounded-full px-3 text-sm font-medium',
              filter === value ? 'bg-sky-100 text-sky-800' : 'text-slate-600',
            ].join(' ')}
            onClick={() => setFilter(value)}
          >
            {value === 'all' ? 'Tất cả' : 'Chưa đọc'}
          </button>
        ))}
      </div>
      <div className="max-h-[min(60vh,480px)] overflow-y-auto">
        {inbox.isLoading && inbox.items.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-500">Đang tải...</p>
        )}
        {!inbox.isLoading && visibleItems.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-500">
            {filter === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo'}
          </p>
        )}
        {visibleItems.map((notification) => (
          <NotificationListItem
            key={notification.id}
            notification={notification}
            onOpen={(item) => void openNotification(item)}
          />
        ))}
      </div>
    </section>
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Thông báo${inbox.unreadCount ? `, ${inbox.unreadCount} chưa đọc` : ''}`}
        aria-expanded={open}
        className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-slate-100"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell aria-hidden="true" className="h-5 w-5 text-slate-600" />
        {inbox.unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
            {inbox.unreadCount > 99 ? '99+' : inbox.unreadCount}
          </span>
        )}
      </button>
      {open && !isMobile && panel}
      {open && isMobile && createPortal(
        <>
          <button
            type="button"
            aria-label="Đóng hộp thư"
            className="fixed inset-0 z-[60] bg-slate-950/40"
            onClick={close}
          />
          {panel}
        </>,
        document.body,
      )}
    </div>
  );
}

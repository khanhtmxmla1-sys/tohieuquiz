import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';

interface NotificationBellProps {
  userId: string | null;
  onOpenCertificate?: (certificateId: string) => void;
  onOpenResultReport?: (phieuId: string) => void;
}

export default function NotificationBell({
  userId,
  onOpenCertificate,
  onOpenResultReport,
}: NotificationBellProps) {
  const { notifications, isLoading, markAsRead } = useRealtimeNotifications(userId);
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  const openNotification = async (notification: typeof notifications[number]) => {
    if (!notification.is_read) await markAsRead(notification.id);
    const phieuId = notification.data.phieu_id;
    if (notification.type === 'result_report_published' && typeof phieuId === 'string') {
      setIsOpen(false);
      onOpenResultReport?.(phieuId);
      return;
    }

    const certificateId = notification.data.certificate_id;
    if (typeof certificateId === 'string') {
      setIsOpen(false);
      onOpenCertificate?.(certificateId);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
        aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ''}`}
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] min-w-4 h-4 px-1 flex items-center justify-center rounded-full">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border z-50 max-h-[400px] overflow-auto" role="dialog" aria-label="Thông báo">
          <div className="p-4 border-b font-medium">Thông báo</div>
          <div className="divide-y">
            {isLoading && notifications.length === 0 && <div className="p-8 text-center text-gray-500">Đang tải...</div>}
            {!isLoading && notifications.length === 0 && <div className="p-8 text-center text-gray-500">Không có thông báo mới</div>}
            {notifications.map((notification) => (
              <button key={notification.id} type="button" onClick={() => openNotification(notification)} className={`w-full p-4 text-left hover:bg-gray-50 ${notification.is_read ? '' : 'bg-indigo-50/60'}`}>
                <div className="font-medium">{notification.title}</div>
                <div className="text-sm text-gray-600 mt-1">{notification.body}</div>
                <div className="text-xs text-gray-400 mt-2">{new Date(notification.created_at).toLocaleString('vi-VN')}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { Archive, CalendarX2, OctagonX } from 'lucide-react';

export type AnnouncementLifecycleIntent = 'cancel' | 'end' | 'archive';

interface AnnouncementLifecycleDialogProps {
  intent: AnnouncementLifecycleIntent | null;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const META: Record<AnnouncementLifecycleIntent, {
  title: string;
  confirmLabel: string;
  description: string;
  icon: typeof Archive;
  destructive?: boolean;
}> = {
  cancel: {
    title: 'Hủy lịch thông báo?',
    confirmLabel: 'Xác nhận hủy lịch',
    description: 'Thông báo sẽ trở về bản nháp và không còn tự động phát theo lịch hiện tại.',
    icon: CalendarX2,
  },
  end: {
    title: 'Kết thúc thông báo?',
    confirmLabel: 'Xác nhận kết thúc',
    description: 'Thông báo đang hiển thị sẽ dừng ngay và được giữ lại trong lịch sử ở trạng thái đã kết thúc.',
    icon: OctagonX,
    destructive: true,
  },
  archive: {
    title: 'Lưu trữ thông báo?',
    confirmLabel: 'Xác nhận lưu trữ',
    description: 'Thông báo sẽ chuyển sang lịch sử chỉ đọc. Bạn vẫn có thể nhân bản nội dung để sử dụng lại.',
    icon: Archive,
  },
};

export function AnnouncementLifecycleDialog({
  intent,
  submitting = false,
  onCancel,
  onConfirm,
}: AnnouncementLifecycleDialogProps) {
  if (!intent) return null;

  const meta = META[intent];
  const Icon = meta.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-lifecycle-dialog-title"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${meta.destructive ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h3 id="announcement-lifecycle-dialog-title" className="text-lg font-bold text-slate-900">{meta.title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">{meta.description}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-slate-200 px-4 font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50"
          >
            Quay lại
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            autoFocus
            className={`min-h-11 rounded-xl px-4 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 ${meta.destructive ? 'bg-red-600 focus-visible:ring-red-600' : 'bg-blue-600 focus-visible:ring-blue-600'}`}
          >
            {submitting ? 'Đang xử lý…' : meta.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { AlertTriangle, CalendarClock, Users } from 'lucide-react';
import { ANNOUNCEMENT_AUDIENCE_META } from './announcementAdminMeta';
import type { AnnouncementDraft } from './AnnouncementComposer';

interface AnnouncementPublishDialogProps {
  draft: AnnouncementDraft;
  open: boolean;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const excerpt = (draft: AnnouncementDraft): string => (
  draft.bannerTitle.trim() || draft.content.trim() || 'Thông báo chưa có nội dung'
);

export function AnnouncementPublishDialog({
  draft,
  open,
  submitting = false,
  onCancel,
  onConfirm,
}: AnnouncementPublishDialogProps) {
  if (!open) return null;

  const urgent = draft.priority === 'URGENT';
  const scheduled = draft.status === 'SCHEDULED';
  const audienceLabel = ANNOUNCEMENT_AUDIENCE_META[draft.audience].label;
  const title = urgent
    ? 'Xác nhận cảnh báo khẩn'
    : draft.audience === 'ALL'
      ? (scheduled ? 'Xác nhận lên lịch toàn hệ thống' : 'Xác nhận công bố toàn hệ thống')
      : (scheduled ? 'Xác nhận lên lịch' : 'Xác nhận công bố');
  const confirmLabel = scheduled ? 'Xác nhận lên lịch' : 'Xác nhận công bố';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-publish-dialog-title"
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${urgent ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
            {urgent ? <AlertTriangle aria-hidden="true" className="size-5" /> : <Users aria-hidden="true" className="size-5" />}
          </span>
          <div className="min-w-0">
            <h3 id="announcement-publish-dialog-title" className="text-lg font-bold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {urgent
                ? `${audienceLabel} sẽ nhận cảnh báo khẩn này trên bề mặt đã chọn.`
                : draft.audience === 'ALL'
                  ? `Toàn hệ thống sẽ nhìn thấy thông báo này trên các bề mặt phù hợp.`
                  : `${audienceLabel} sẽ nhận thông báo này trên các bề mặt phù hợp.`}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">{excerpt(draft)}</p>
          <p className="flex items-center gap-2 text-slate-600">
            <CalendarClock aria-hidden="true" className="size-4" />
            {scheduled ? 'Thông báo sẽ được lên lịch theo thời điểm đã chọn.' : 'Thông báo sẽ bắt đầu hiển thị ngay sau khi xác nhận.'}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-slate-200 px-4 font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50"
          >
            Quay lại kiểm tra
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            autoFocus
            className={`min-h-11 rounded-xl px-4 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 ${urgent ? 'bg-red-600 focus-visible:ring-red-600' : 'bg-blue-600 focus-visible:ring-blue-600'}`}
          >
            {submitting ? (scheduled ? 'Đang lên lịch…' : 'Đang công bố…') : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

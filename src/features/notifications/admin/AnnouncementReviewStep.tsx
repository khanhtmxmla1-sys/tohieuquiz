import React from 'react';
import { CalendarClock, Eye, Monitor, Smartphone, Users } from 'lucide-react';
import { formatSystemDateTime, systemDateTimeLocalToIso } from '../../../utils/dateTime';
import { ANNOUNCEMENT_AUDIENCE_META, ANNOUNCEMENT_PRESET_META } from './announcementAdminMeta';
import type { AnnouncementDraft } from './AnnouncementComposer';
import { AnnouncementPreview } from './AnnouncementPreview';
import { inferAnnouncementPreset } from './announcementPresets';
import type { NotificationSurface } from '../selectAnnouncements';

interface AnnouncementReviewStepProps {
  draft: AnnouncementDraft;
  surface: NotificationSurface;
  device: 'desktop' | 'mobile';
  onSurfaceChange: (surface: NotificationSurface) => void;
  onDeviceChange: (device: 'desktop' | 'mobile') => void;
}

const SURFACE_LABELS: Record<NotificationSurface, string> = {
  LOGIN: 'Đăng nhập',
  TEACHER_DASHBOARD: 'Giáo viên',
  STUDENT_DASHBOARD: 'Học sinh',
};

export const getAnnouncementReviewSurfaces = (
  audience: AnnouncementDraft['audience'],
): NotificationSurface[] => {
  if (audience === 'TEACHERS') return ['TEACHER_DASHBOARD'];
  if (audience === 'STUDENTS') return ['STUDENT_DASHBOARD'];
  return ['LOGIN', 'TEACHER_DASHBOARD', 'STUDENT_DASHBOARD'];
};

const formatScheduledStart = (startsAt: string): string => {
  if (!startsAt) return 'Chưa chọn thời điểm bắt đầu';
  try {
    return formatSystemDateTime(systemDateTimeLocalToIso(startsAt));
  } catch {
    return 'Thời điểm chưa hợp lệ';
  }
};

export function AnnouncementReviewStep({
  draft,
  surface,
  device,
  onSurfaceChange,
  onDeviceChange,
}: AnnouncementReviewStepProps) {
  const surfaces = getAnnouncementReviewSurfaces(draft.audience);
  const preset = inferAnnouncementPreset(draft);
  const typeLabel = preset ? ANNOUNCEMENT_PRESET_META[preset].label : 'Nhiều vị trí';
  const timingLabel = draft.status === 'SCHEDULED'
    ? `Lên lịch: ${formatScheduledStart(draft.startsAt)} (giờ Hà Nội)`
    : 'Phát ngay';

  return (
    <section aria-labelledby="announcement-review-title" className="space-y-4 rounded-2xl border bg-slate-50 p-5 xl:sticky xl:top-20">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Bước 3</p>
        <h3 id="announcement-review-title" className="text-lg font-bold text-slate-900">Kiểm tra &amp; xem trước</h3>
        <p className="mt-1 text-sm text-slate-600">Xác nhận người nhận, cách hiển thị và thời điểm trước khi lưu thay đổi.</p>
      </div>

      <dl className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
        <div className="flex items-start gap-2">
          <dt className="flex items-center gap-2 font-semibold text-slate-700"><Users aria-hidden="true" className="size-4 shrink-0 text-slate-500" />Người nhận:</dt>
          <dd className="min-w-0 text-slate-900">{ANNOUNCEMENT_AUDIENCE_META[draft.audience].label}</dd>
        </div>
        <div className="flex items-start gap-2">
          <dt className="flex items-center gap-2 font-semibold text-slate-700"><Eye aria-hidden="true" className="size-4 shrink-0 text-slate-500" />Loại:</dt>
          <dd className="min-w-0 text-slate-900">{typeLabel}</dd>
        </div>
        <div className="flex items-start gap-2">
          <dt className="flex items-center gap-2 font-semibold text-slate-700"><CalendarClock aria-hidden="true" className="size-4 shrink-0 text-slate-500" />Thời điểm:</dt>
          <dd className="min-w-0 text-slate-900">{timingLabel}</dd>
        </div>
      </dl>

      <div>
        <h4 className="font-bold text-slate-900">Xem trước</h4>
        <p className="mt-1 text-xs text-slate-500">Preview dùng cùng component hiển thị ngoài sản phẩm.</p>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Bề mặt xem trước">
        {surfaces.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={surface === value}
            onClick={() => onSurfaceChange(value)}
            className="min-h-11 rounded-full border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            {SURFACE_LABELS[value]}
          </button>
        ))}
      </div>

      <div className="flex gap-2" aria-label="Thiết bị xem trước">
        <button
          type="button"
          aria-pressed={device === 'desktop'}
          onClick={() => onDeviceChange('desktop')}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <Monitor aria-hidden="true" className="size-4" />Desktop
        </button>
        <button
          type="button"
          aria-pressed={device === 'mobile'}
          onClick={() => onDeviceChange('mobile')}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <Smartphone aria-hidden="true" className="size-4" />Mobile
        </button>
      </div>

      <AnnouncementPreview draft={draft} surface={surface} device={device} />
    </section>
  );
}

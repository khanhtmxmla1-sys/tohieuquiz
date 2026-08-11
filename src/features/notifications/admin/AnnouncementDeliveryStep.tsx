import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clock3, Users } from 'lucide-react';
import type { AnnouncementChannel, NotificationPriority } from '../../../../shared/notifications.contract';
import { formatSystemDateTime, systemDateTimeLocalToIso, toSystemDateTimeLocal } from '../../../utils/dateTime';
import { ANNOUNCEMENT_AUDIENCE_META } from './announcementAdminMeta';
import type { AnnouncementDraft } from './AnnouncementComposer';
import { addHoursToAnnouncementLocal } from './announcementSchedule';
import type { AnnouncementDraftErrors } from './validateAnnouncementDraft';

interface AnnouncementDeliveryStepProps {
  draft: AnnouncementDraft;
  errors: AnnouncementDraftErrors;
  readOnly?: boolean;
  onChange: (draft: AnnouncementDraft) => void;
}

type EndMode = 'NONE' | '24H' | '3D' | 'CUSTOM';

const UI_CHANNELS: Array<{ value: AnnouncementChannel; label: string }> = [
  { value: 'CRITICAL_STRIP', label: 'Cảnh báo khẩn' },
  { value: 'TICKER', label: 'Tin chạy' },
  { value: 'BANNER', label: 'Banner' },
];

const AUDIENCES: AnnouncementDraft['audience'][] = ['ALL', 'TEACHERS', 'STUDENTS'];

const safeFormattedLocal = (value: string): string => {
  if (!value) return '';
  try {
    return formatSystemDateTime(systemDateTimeLocalToIso(value));
  } catch {
    return '';
  }
};

export function AnnouncementDeliveryStep({
  draft,
  errors,
  readOnly = false,
  onChange,
}: AnnouncementDeliveryStepProps) {
  const [endMode, setEndMode] = useState<EndMode>(draft.endsAt ? 'CUSTOM' : 'NONE');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const isScheduled = draft.status === 'SCHEDULED';
  const endLabel = useMemo(() => safeFormattedLocal(draft.endsAt), [draft.endsAt]);

  useEffect(() => {
    if (!draft.endsAt && endMode !== 'NONE') setEndMode('NONE');
  }, [draft.endsAt]);

  const update = (patch: Partial<AnnouncementDraft>) => {
    if (readOnly) return;
    onChange({ ...draft, ...patch });
  };

  const selectTiming = (scheduled: boolean) => {
    update({ status: scheduled ? 'SCHEDULED' : 'DRAFT', startsAt: scheduled ? draft.startsAt : '' });
  };

  const baseForEnd = (): string => {
    if (draft.startsAt) return draft.startsAt;
    return toSystemDateTimeLocal(new Date());
  };

  const chooseEndMode = (mode: EndMode) => {
    if (readOnly) return;
    setEndMode(mode);
    if (mode === 'NONE') update({ endsAt: '' });
    if (mode === '24H') update({ endsAt: addHoursToAnnouncementLocal(baseForEnd(), 24) });
    if (mode === '3D') update({ endsAt: addHoursToAnnouncementLocal(baseForEnd(), 72) });
  };

  const changeStart = (value: string) => {
    let endsAt = draft.endsAt;
    if (value && endMode === '24H') endsAt = addHoursToAnnouncementLocal(value, 24);
    if (value && endMode === '3D') endsAt = addHoursToAnnouncementLocal(value, 72);
    update({ startsAt: value, endsAt });
  };

  const toggleChannel = (channel: AnnouncementChannel) => {
    const channels = draft.channels.includes(channel)
      ? draft.channels.filter((item) => item !== channel)
      : [...draft.channels, channel];
    update({ channels });
  };

  return (
    <section className="space-y-5" aria-labelledby="announcement-distribution-title">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Bước 2</p>
        <h3 id="announcement-distribution-title" className="text-lg font-bold text-slate-900">Phân phối</h3>
        <p className="mt-1 text-sm text-slate-600">Chọn ai sẽ nhận thông báo và thời điểm hiển thị theo giờ Hà Nội (GMT+7).</p>
      </div>

      <fieldset disabled={readOnly} className="space-y-3">
        <legend className="flex items-center gap-2 text-sm font-bold text-slate-900"><Users aria-hidden="true" className="size-4" />Đối tượng nhận</legend>
        <div role="radiogroup" aria-label="Đối tượng nhận" className="grid gap-2 sm:grid-cols-3">
          {AUDIENCES.map((audience) => {
            const meta = ANNOUNCEMENT_AUDIENCE_META[audience];
            const selected = draft.audience === audience;
            return (
              <label key={audience} className={`min-h-20 cursor-pointer rounded-xl border p-3 ${selected ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'} ${readOnly ? 'cursor-default opacity-75' : ''}`}>
                <span className="flex items-start gap-2">
                  <input type="radio" aria-label={meta.label} name="announcement-audience" checked={selected} onChange={() => update({ audience })} className="mt-1" />
                  <span><span className="block text-sm font-bold text-slate-900">{meta.label}</span><span className="mt-1 block text-xs text-slate-600">{meta.description}</span></span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset disabled={readOnly} className="space-y-3">
        <legend className="flex items-center gap-2 text-sm font-bold text-slate-900"><Clock3 aria-hidden="true" className="size-4" />Thời điểm phát</legend>
        <div role="radiogroup" aria-label="Thời điểm phát" className="grid gap-2 sm:grid-cols-2">
          <label className={`min-h-16 cursor-pointer rounded-xl border p-3 ${!isScheduled ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}>
            <span className="flex gap-2"><input type="radio" aria-label="Phát ngay" name="announcement-timing" checked={!isScheduled} onChange={() => selectTiming(false)} /><span><span className="block text-sm font-bold">Phát ngay</span><span className="text-xs text-slate-600">Hiển thị ngay sau khi bạn xác nhận công bố.</span></span></span>
          </label>
          <label className={`min-h-16 cursor-pointer rounded-xl border p-3 ${isScheduled ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}>
            <span className="flex gap-2"><input type="radio" aria-label="Lên lịch" name="announcement-timing" checked={isScheduled} onChange={() => selectTiming(true)} /><span><span className="block text-sm font-bold">Lên lịch</span><span className="text-xs text-slate-600">Chỉ bắt đầu hiển thị vào thời điểm bạn chọn.</span></span></span>
          </label>
        </div>
        {isScheduled && (
          <label className="block text-sm font-semibold">
            Bắt đầu phát
            <input type="datetime-local" aria-label="Bắt đầu phát" value={draft.startsAt} onChange={(event) => changeStart(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" />
            <span className="mt-1 block text-xs font-normal text-slate-500">Giờ Hà Nội (GMT+7)</span>
            {errors.startsAt && <span className="mt-1 block text-xs text-red-700">{errors.startsAt}</span>}
          </label>
        )}
      </fieldset>

      <fieldset disabled={readOnly} className="space-y-3">
        <legend className="text-sm font-bold text-slate-900">Thời hạn hiển thị</legend>
        <div role="radiogroup" aria-label="Thời hạn hiển thị" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            ['NONE', 'Không giới hạn'],
            ['24H', '24 giờ'],
            ['3D', '3 ngày'],
            ['CUSTOM', 'Tùy chọn'],
          ] as const).map(([value, label]) => (
            <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${endMode === value ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}>
              <input type="radio" aria-label={label} name="announcement-end-mode" checked={endMode === value} onChange={() => chooseEndMode(value)} />{label}
            </label>
          ))}
        </div>
        {endMode === 'CUSTOM' && (
          <label className="block text-sm font-semibold">
            Kết thúc hiển thị
            <input type="datetime-local" aria-label="Kết thúc hiển thị" value={draft.endsAt} onChange={(event) => update({ endsAt: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" />
            <span className="mt-1 block text-xs font-normal text-slate-500">Giờ Hà Nội (GMT+7)</span>
          </label>
        )}
        {draft.endsAt && <p data-testid="announcement-end-value" className="text-xs text-slate-600">Kết thúc dự kiến: {endLabel}</p>}
        {errors.endsAt && <p className="text-xs text-red-700">{errors.endsAt}</p>}
      </fieldset>

      <label className="flex min-h-11 items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm">
        <input type="checkbox" aria-label="Cho phép người xem đóng thông báo" checked={draft.dismissible} disabled={readOnly} onChange={(event) => update({ dismissible: event.target.checked })} className="mt-1" />
        <span><span className="block font-bold text-slate-900">Cho phép người xem đóng thông báo</span><span className="mt-1 block text-xs leading-5 text-slate-600">{draft.priority === 'URGENT' ? 'Cảnh báo khẩn nên giữ hiển thị cho tới khi hết thời hạn hoặc được quản trị viên kết thúc.' : 'Bật nếu người xem có thể tự ẩn thông báo sau khi đã đọc.'}</span></span>
      </label>

      <div className="rounded-xl border border-slate-200">
        <button type="button" aria-label="Kênh hiển thị nâng cao" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)} className="flex min-h-11 w-full items-center justify-between px-4 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
          Kênh hiển thị nâng cao
          {advancedOpen ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
        </button>
        {advancedOpen && (
          <div className="space-y-4 border-t border-slate-200 p-4">
            <fieldset disabled={readOnly}>
              <legend className="text-sm font-semibold">Ghi đè kênh hiển thị</legend>
              <p className="mt-1 text-xs text-slate-500">Chỉ thay đổi khi bạn hiểu rõ vị trí hiển thị. Hộp thư chưa được hỗ trợ và không xuất hiện ở đây.</p>
              <div className="mt-3 space-y-2">
                {UI_CHANNELS.map(({ value, label }) => (
                  <label key={value} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.channels.includes(value)} onChange={() => toggleChannel(value)} />{label}</label>
                ))}
              </div>
              {errors.channels && <p className="mt-1 text-xs text-red-700">{errors.channels}</p>}
            </fieldset>
            <label className="block text-sm font-semibold">
              Mức ưu tiên nâng cao
              <select aria-label="Mức ưu tiên nâng cao" value={draft.priority} disabled={readOnly} onChange={(event) => update({ priority: event.target.value as NotificationPriority })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3">
                <option value="INFO">Thông tin</option>
                <option value="REMINDER">Nhắc nhở</option>
                <option value="IMPORTANT">Quan trọng</option>
                <option value="URGENT">Khẩn cấp</option>
              </select>
            </label>
          </div>
        )}
      </div>
    </section>
  );
}

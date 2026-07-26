import React from 'react';
import {
  ANNOUNCEMENT_CHANNELS,
  type AnnouncementChannel,
  type NotificationPriority,
} from '../../../../shared/notifications.contract';
import type { AnnouncementDraft } from './AnnouncementComposer';
import type { AnnouncementDraftErrors } from './validateAnnouncementDraft';

interface AnnouncementDistributionFieldsProps {
  draft: AnnouncementDraft;
  errors: AnnouncementDraftErrors;
  onChange: (draft: AnnouncementDraft) => void;
}

const CHANNEL_LABELS: Record<AnnouncementChannel, string> = {
  CRITICAL_STRIP: 'Cảnh báo khẩn',
  TICKER: 'Tin chạy',
  BANNER: 'Banner',
  INBOX: 'Hộp thư',
};

export function AnnouncementDistributionFields({
  draft,
  errors,
  onChange,
}: AnnouncementDistributionFieldsProps) {
  const toggleChannel = (channel: AnnouncementChannel) => {
    const channels = draft.channels.includes(channel)
      ? draft.channels.filter((item) => item !== channel)
      : [...draft.channels, channel];
    onChange({ ...draft, channels });
  };

  return (
    <section className="space-y-4" aria-labelledby="announcement-distribution-title">
      <h3 id="announcement-distribution-title" className="text-lg font-bold text-slate-900">
        Phân phối
      </h3>
      <label className="block text-sm font-semibold">
        Đối tượng
        <select
          aria-label="Đối tượng"
          value={draft.audience}
          onChange={(event) => onChange({
            ...draft,
            audience: event.target.value as AnnouncementDraft['audience'],
          })}
          className="mt-1 h-11 w-full rounded-xl border px-3"
        >
          <option value="ALL">Toàn hệ thống</option>
          <option value="TEACHERS">Giáo viên</option>
          <option value="STUDENTS">Học sinh</option>
        </select>
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Kênh hiển thị</legend>
        {ANNOUNCEMENT_CHANNELS.map((channel) => (
          <label key={channel} className="flex min-h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.channels.includes(channel)}
              onChange={() => toggleChannel(channel)}
            />
            {CHANNEL_LABELS[channel]}
          </label>
        ))}
        {errors.channels && <p className="text-sm text-red-700">{errors.channels}</p>}
      </fieldset>
      <label className="block text-sm font-semibold">
        Mức ưu tiên
        <select
          aria-label="Mức ưu tiên"
          value={draft.priority}
          onChange={(event) => onChange({
            ...draft,
            priority: event.target.value as NotificationPriority,
          })}
          className="mt-1 h-11 w-full rounded-xl border px-3"
        >
          <option value="INFO">Thông tin</option>
          <option value="REMINDER">Nhắc nhở</option>
          <option value="IMPORTANT">Quan trọng</option>
          <option value="URGENT">Khẩn cấp</option>
        </select>
      </label>
      <label className="block text-sm font-semibold">
        Trạng thái
        <select
          aria-label="Trạng thái"
          value={draft.status}
          onChange={(event) => onChange({
            ...draft,
            status: event.target.value as AnnouncementDraft['status'],
          })}
          className="mt-1 h-11 w-full rounded-xl border px-3"
        >
          <option value="DRAFT">Bản nháp</option>
          <option value="SCHEDULED">Lên lịch</option>
          <option value="PUBLISHED">Công bố</option>
        </select>
      </label>
      <div className="grid gap-3">
        <label className="text-sm font-semibold">
          Bắt đầu
          <input
            type="datetime-local"
            value={draft.startsAt}
            onChange={(event) => onChange({ ...draft, startsAt: event.target.value })}
            className="mt-1 h-11 w-full rounded-xl border px-3"
          />
          {errors.startsAt && <span className="block text-red-700">{errors.startsAt}</span>}
        </label>
        <label className="text-sm font-semibold">
          Kết thúc
          <input
            type="datetime-local"
            value={draft.endsAt}
            onChange={(event) => onChange({ ...draft, endsAt: event.target.value })}
            className="mt-1 h-11 w-full rounded-xl border px-3"
          />
          {errors.endsAt && <span className="block text-red-700">{errors.endsAt}</span>}
        </label>
      </div>
      <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={draft.dismissible}
          onChange={(event) => onChange({ ...draft, dismissible: event.target.checked })}
        />
        Cho phép đóng
      </label>
    </section>
  );
}

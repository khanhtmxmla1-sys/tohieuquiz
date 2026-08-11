import React from 'react';
import { Search } from 'lucide-react';
import {
  ANNOUNCEMENT_AUDIENCE_META,
  ANNOUNCEMENT_PRESET_META,
  ANNOUNCEMENT_STATUS_META,
} from './announcementAdminMeta';
import type {
  AnnouncementAdminAudienceFilter,
  AnnouncementAdminFilter,
  AnnouncementAdminPresetFilter,
  AnnouncementAdminStatusFilter,
} from './announcementAdminSelectors';
import type { AnnouncementStatus } from './AnnouncementComposer';

interface AnnouncementListToolbarProps {
  filter: AnnouncementAdminFilter;
  counts: Record<'ALL' | AnnouncementStatus, number>;
  onChange: (filter: AnnouncementAdminFilter) => void;
}

const STATUS_ORDER: AnnouncementStatus[] = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED', 'ARCHIVED'];

export function AnnouncementListToolbar({ filter, counts, onChange }: AnnouncementListToolbarProps) {
  const setStatus = (status: AnnouncementAdminStatusFilter) => onChange({ ...filter, status });
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Lọc theo trạng thái">
        <button
          type="button"
          aria-pressed={filter.status === 'ALL'}
          onClick={() => setStatus('ALL')}
          className="min-h-11 shrink-0 rounded-xl border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 aria-pressed:border-blue-200 aria-pressed:bg-blue-50 aria-pressed:text-blue-700"
        >
          Tất cả {counts.ALL}
        </button>
        {STATUS_ORDER.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={filter.status === status}
            onClick={() => setStatus(status)}
            className="min-h-11 shrink-0 rounded-xl border px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 aria-pressed:border-blue-200 aria-pressed:bg-blue-50 aria-pressed:text-blue-700"
          >
            {ANNOUNCEMENT_STATUS_META[status].label} {counts[status]}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_200px]">
        <label className="relative block">
          <span className="sr-only">Tìm thông báo</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Tìm thông báo"
            value={filter.query}
            onChange={(event) => onChange({ ...filter, query: event.target.value })}
            placeholder="Tìm theo tiêu đề hoặc nội dung..."
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="block">
          <span className="sr-only">Đối tượng lọc</span>
          <select
            aria-label="Đối tượng lọc"
            value={filter.audience}
            onChange={(event) => onChange({ ...filter, audience: event.target.value as AnnouncementAdminAudienceFilter })}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <option value="ALL">Mọi đối tượng</option>
            <option value="TEACHERS">{ANNOUNCEMENT_AUDIENCE_META.TEACHERS.label}</option>
            <option value="STUDENTS">{ANNOUNCEMENT_AUDIENCE_META.STUDENTS.label}</option>
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Loại thông báo lọc</span>
          <select
            aria-label="Loại thông báo lọc"
            value={filter.preset}
            onChange={(event) => onChange({ ...filter, preset: event.target.value as AnnouncementAdminPresetFilter })}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <option value="ALL">Mọi loại thông báo</option>
            {Object.entries(ANNOUNCEMENT_PRESET_META).map(([value, meta]) => (
              <option key={value} value={value}>{meta.label}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

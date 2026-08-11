import React from 'react';
import { CalendarClock, ChevronRight, Users } from 'lucide-react';
import {
  ANNOUNCEMENT_AUDIENCE_META,
  ANNOUNCEMENT_PRESET_META,
  ANNOUNCEMENT_STATUS_META,
} from './announcementAdminMeta';
import {
  formatAnnouncementAdminSchedule,
  getAnnouncementAdminPreset,
  getAnnouncementEffectiveStatus,
  type AnnouncementAdminListItem,
} from './announcementAdminSelectors';

interface AnnouncementListItemProps<T extends AnnouncementAdminListItem> {
  item: T;
  onOpen: (item: T) => void;
}

const toneClass = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-50 text-blue-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-800',
  red: 'bg-red-50 text-red-700',
  violet: 'bg-violet-50 text-violet-700',
} as const;

export function AnnouncementListItem<T extends AnnouncementAdminListItem>({ item, onOpen }: AnnouncementListItemProps<T>) {
  const status = getAnnouncementEffectiveStatus(item);
  const statusMeta = ANNOUNCEMENT_STATUS_META[status];
  const preset = getAnnouncementAdminPreset(item);
  const title = item.bannerTitle.trim() || item.content.trim() || 'Thông báo chưa có nội dung';
  const description = item.bannerTitle.trim() ? item.content.trim() : item.bannerSubtitle.trim();

  return (
    <li className="rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        aria-label={`Mở ${title}`}
        onClick={() => onOpen(item)}
        className="flex min-h-20 w-full items-center gap-4 rounded-2xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate font-bold text-slate-900">{title}</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass[statusMeta.tone]}`}>
              {statusMeta.label}
            </span>
          </div>
          {description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{description}</p>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Users aria-hidden="true" className="size-3.5" />{ANNOUNCEMENT_AUDIENCE_META[item.audience].label}
            </span>
            <span>{ANNOUNCEMENT_PRESET_META[preset].label}</span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock aria-hidden="true" className="size-3.5" />{formatAnnouncementAdminSchedule(item)}
            </span>
          </div>
        </div>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-slate-400" />
      </button>
    </li>
  );
}

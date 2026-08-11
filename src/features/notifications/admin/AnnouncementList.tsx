import React from 'react';
import { AnnouncementListItem } from './AnnouncementListItem';
import type { AnnouncementAdminListItem } from './announcementAdminSelectors';

interface AnnouncementListProps<T extends AnnouncementAdminListItem> {
  items: T[];
  onOpen: (item: T) => void;
}

export function AnnouncementList<T extends AnnouncementAdminListItem>({ items, onOpen }: AnnouncementListProps<T>) {
  return (
    <ul aria-label="Danh sách thông báo" className="space-y-3">
      {items.map((item) => <AnnouncementListItem key={item.id} item={item} onOpen={onOpen} />)}
    </ul>
  );
}

export function AnnouncementListSkeleton() {
  return (
    <div role="status" aria-label="Đang tải danh sách thông báo" className="space-y-3">
      <span className="sr-only">Đang tải danh sách thông báo</span>
      {[0, 1, 2].map((index) => (
        <div key={index} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
          <div className="h-4 w-2/5 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-4/5 rounded bg-slate-100" />
          <div className="mt-5 h-3 w-3/5 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

import React from 'react';
import { Megaphone, Plus } from 'lucide-react';

interface AnnouncementEmptyStateProps {
  filtered?: boolean;
  onCreate: () => void;
}

export function AnnouncementEmptyState({ filtered = false, onCreate }: AnnouncementEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-700">
        <Megaphone aria-hidden="true" className="size-6" />
      </span>
      <h3 className="mt-4 text-lg font-bold text-slate-900">
        {filtered ? 'Không tìm thấy thông báo phù hợp' : 'Chưa có thông báo nào'}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        {filtered
          ? 'Hãy đổi bộ lọc hoặc từ khóa để xem các thông báo khác.'
          : 'Tạo thông báo đầu tiên để gửi thông tin tới giáo viên hoặc học sinh.'}
      </p>
      {!filtered && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <Plus aria-hidden="true" className="size-4" />Tạo thông báo đầu tiên
        </button>
      )}
    </div>
  );
}

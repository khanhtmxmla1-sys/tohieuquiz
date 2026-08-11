import React from 'react';

interface AnnouncementPresetChangeNoticeProps {
  onApply: () => void;
  onCancel: () => void;
}

export function AnnouncementPresetChangeNotice({ onApply, onCancel }: AnnouncementPresetChangeNoticeProps) {
  return (
    <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-bold">Thay đổi cách hiển thị?</p>
      <p className="mt-1">Nội dung bạn đã nhập sẽ được giữ nguyên; chỉ kênh hiển thị, mức ưu tiên và khả năng đóng sẽ đổi theo loại mới.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onApply} className="min-h-11 rounded-xl bg-amber-700 px-4 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700">Áp dụng thay đổi</button>
        <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-amber-300 bg-white px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700">Giữ loại hiện tại</button>
      </div>
    </div>
  );
}

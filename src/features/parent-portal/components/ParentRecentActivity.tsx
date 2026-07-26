import React from 'react';
import type { ParentDashboardPayload } from '../../../../shared/parent-portal.contract';

export default function ParentRecentActivity({ items }: { items: ParentDashboardPayload['recentActivity'] }) {
  if (!items.length) return <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">Chưa có hoạt động học tập gần đây.</p>;
  return (
    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
      {items.slice(0, 10).map(item => (
        <div key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-4 py-4">
          <div><p className="font-semibold text-slate-900">{item.title}</p><p className="text-xs text-slate-500">{item.subject} · {new Date(item.occurredAt).toLocaleDateString('vi-VN')}</p></div>
          <span className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">{item.score === null ? 'Đã nộp' : `${item.score.toFixed(1)}/10`}</span>
        </div>
      ))}
    </div>
  );
}

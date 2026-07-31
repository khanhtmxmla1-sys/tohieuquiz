import React from 'react';
import { BookOpenCheck, CheckCircle2, ChevronRight } from 'lucide-react';
import type { ParentDashboardPayload } from '../../../../shared/parent-portal.contract';

export default function ParentRecentActivity({ items }: { items: ParentDashboardPayload['recentActivity'] }) {
  if (!items.length) return <p className="rounded-[20px] border border-dashed border-[#cbd5e1] bg-white p-6 text-sm text-[#64748b]">Chưa có hoạt động học tập gần đây.</p>;

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#e2e8f0] bg-white shadow-[0_18px_44px_-38px_rgba(30,58,138,0.7)]">
      {items.slice(0, 10).map((item, index) => {
        const isHomework = item.type === 'homework';
        const Icon = isHomework ? BookOpenCheck : CheckCircle2;
        return (
          <div key={`${item.type}-${item.id}`} className={`flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5 ${index ? 'border-t border-[#f1f5f9]' : ''}`}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] ${isHomework ? 'bg-[#fff7ed] text-[#c2410c]' : 'bg-[#eff6ff] text-[#2563eb]'}`}>
              <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#1e293b] sm:text-base">{item.title}</p>
              <p className="mt-1 truncate text-xs text-[#64748b]">{item.subject} · {new Date(item.occurredAt).toLocaleDateString('vi-VN')}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className={`rounded-[10px] px-2.5 py-1.5 text-xs font-bold sm:text-sm ${item.score === null ? 'bg-[#f1f5f9] text-[#475569]' : item.score >= 8 ? 'bg-[#ecfdf5] text-[#15803d]' : 'bg-[#fff7ed] text-[#b45309]'}`}>
                {item.score === null ? 'Đã nộp' : `${item.score.toFixed(1)}/10`}
              </span>
              <ChevronRight className="hidden h-4 w-4 text-[#cbd5e1] sm:block" aria-hidden="true" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

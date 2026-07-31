import React from 'react';
import { ArrowUpRight, BookOpenCheck, Target } from 'lucide-react';
import type { ParentDashboardPayload } from '../../../../shared/parent-portal.contract';

const confidenceLabel = { low: 'Ít dữ liệu', medium: 'Đủ dữ liệu', high: 'Tin cậy cao' } as const;

export default function ParentSubjectSummary({ subjects }: { subjects: ParentDashboardPayload['subjects'] }) {
  if (!subjects.length) return <p className="rounded-[20px] border border-dashed border-[#cbd5e1] bg-white p-6 text-sm text-[#64748b]">Tuần này chưa có đủ dữ liệu theo môn.</p>;

  const strongest = [...subjects].sort((a, b) => b.correctRate - a.correctRate)[0];
  const weakest = [...subjects].sort((a, b) => a.correctRate - b.correctRate)[0];

  const cards = [
    {
      label: 'Môn đang làm tốt',
      subject: strongest,
      icon: BookOpenCheck,
      iconClass: 'bg-[#ecfdf5] text-[#15803d]',
      progressClass: 'bg-[#22c55e]',
      borderClass: 'border-[#bbf7d0]',
      helper: 'Hãy ghi nhận nỗ lực để con tiếp tục duy trì.',
    },
    {
      label: 'Môn cần cải thiện',
      subject: weakest,
      icon: Target,
      iconClass: 'bg-[#fff7ed] text-[#c2410c]',
      progressClass: 'bg-[#f59e0b]',
      borderClass: 'border-[#fed7aa]',
      helper: 'Nên dành thêm thời gian ôn tập theo gợi ý của giáo viên.',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cards.map(({ label, subject, icon: Icon, iconClass, progressClass, borderClass, helper }) => (
        <article key={label} className={`rounded-[22px] border bg-white p-5 shadow-[0_18px_44px_-38px_rgba(30,58,138,0.7)] ${borderClass}`}>
          <div className="flex items-start justify-between gap-3">
            <span className={`flex h-11 w-11 items-center justify-center rounded-[13px] ${iconClass}`}>
              <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
            </span>
            <span className="rounded-lg bg-[#f8fafc] px-2.5 py-1 text-[11px] font-semibold text-[#64748b]">{confidenceLabel[subject.confidence]}</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-[#64748b]">{label}</p>
          <h3 className="mt-1 flex items-center gap-1.5 text-xl font-bold tracking-[-0.025em] text-[#0f172a]">{subject.subject}<ArrowUpRight className="h-4 w-4 text-[#94a3b8]" aria-hidden="true" /></h3>
          {label === 'Môn cần cải thiện' && <span className="mt-2 inline-flex rounded-[8px] bg-[#fff7ed] px-2.5 py-1 text-xs font-bold text-[#b45309]">Cần ôn thêm</span>}
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="font-semibold text-[#64748b]">Tỷ lệ chính xác</span>
            <span className="font-bold text-[#1e293b]">{subject.correctRate}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f1f5f9]" aria-label={`Tỷ lệ chính xác ${subject.correctRate}%`} role="img">
            <div className={`h-full rounded-full ${progressClass}`} style={{ width: `${Math.min(100, Math.max(0, subject.correctRate))}%` }} />
          </div>
          <p className="mt-4 text-xs leading-5 text-[#64748b]">{helper}</p>
        </article>
      ))}
    </div>
  );
}

import React from 'react';
import type { ParentDashboardPayload } from '../../../../shared/parent-portal.contract';

const confidenceLabel = { low: 'Ít dữ liệu', medium: 'Đủ dữ liệu', high: 'Tin cậy cao' } as const;

export default function ParentSubjectSummary({ subjects }: { subjects: ParentDashboardPayload['subjects'] }) {
  if (!subjects.length) return <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">Tuần này chưa có đủ dữ liệu theo môn.</p>;
  const strongest = [...subjects].sort((a, b) => b.correctRate - a.correctRate)[0];
  const weakest = [...subjects].sort((a, b) => a.correctRate - b.correctRate)[0];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-semibold text-emerald-700">Môn đang làm tốt</p>
        <h3 className="mt-1 text-xl font-bold text-slate-900">{strongest.subject}</h3>
        <p className="mt-2 text-sm text-slate-600">Chính xác {strongest.correctRate}% · {confidenceLabel[strongest.confidence]}</p>
      </article>
      <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-semibold text-amber-800">Môn cần cải thiện</p>
        <h3 className="mt-1 text-xl font-bold text-slate-900">{weakest.subject}</h3>
        <p className="mt-2 text-sm font-semibold text-amber-800">Cần ôn thêm</p>
        <p className="mt-1 text-sm text-slate-600">Chính xác {weakest.correctRate}% · {confidenceLabel[weakest.confidence]}</p>
      </article>
    </div>
  );
}

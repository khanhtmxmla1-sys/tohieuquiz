import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ParentDashboardPayload } from '../../../../shared/parent-portal.contract';

const Delta = ({ value, suffix = '' }: { value: number; suffix?: string }) => {
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return <span className="inline-flex items-center gap-1 font-bold text-slate-800"><Icon className="h-4 w-4" />{value > 0 ? '+' : ''}{value}{suffix}</span>;
};

export default function ParentProgressPanel({ comparison }: { comparison: ParentDashboardPayload['comparison'] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900">So với tuần trước</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Điểm trung bình</p><Delta value={comparison.averageScoreDelta} /></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Số bài hoàn thành</p><Delta value={comparison.completedQuizzesDelta} suffix=" bài" /></div>
      </div>
    </section>
  );
}

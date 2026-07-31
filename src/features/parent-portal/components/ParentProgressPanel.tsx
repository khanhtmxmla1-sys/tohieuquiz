import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, TrendingUp } from 'lucide-react';
import type { ParentDashboardPayload } from '../../../../shared/parent-portal.contract';

const getTone = (value: number) => {
  if (value > 0) return { text: 'text-[#15803d]', bg: 'bg-[#ecfdf5]', bar: 'bg-[#22c55e]', label: 'Tăng' };
  if (value < 0) return { text: 'text-[#b45309]', bg: 'bg-[#fffbeb]', bar: 'bg-[#f59e0b]', label: 'Giảm' };
  return { text: 'text-[#475569]', bg: 'bg-[#f1f5f9]', bar: 'bg-[#94a3b8]', label: 'Ổn định' };
};

const Delta = ({ value, suffix = '' }: { value: number; suffix?: string }) => {
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  const tone = getTone(value);
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-bold ${tone.bg} ${tone.text}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {value > 0 ? '+' : ''}{value}{suffix}
      <span className="sr-only">{tone.label}</span>
    </span>
  );
};

export default function ParentProgressPanel({ comparison }: { comparison: ParentDashboardPayload['comparison'] }) {
  const rows = [
    { label: 'Điểm trung bình', value: comparison.averageScoreDelta, suffix: '', max: 2 },
    { label: 'Số bài hoàn thành', value: comparison.completedQuizzesDelta, suffix: ' bài', max: 5 },
  ];

  return (
    <section className="h-full rounded-[22px] border border-[#e2e8f0] bg-white p-5 shadow-[0_18px_44px_-38px_rgba(30,58,138,0.7)] sm:p-6" aria-labelledby="weekly-comparison-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2563eb]">Xu hướng học tập</p>
          <h2 id="weekly-comparison-title" className="mt-1 text-lg font-bold tracking-[-0.02em] text-[#0f172a]">So với tuần trước</h2>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#eff6ff] text-[#2563eb]"><TrendingUp className="h-5 w-5" aria-hidden="true" /></span>
      </div>
      <div className="mt-5 space-y-5">
        {rows.map(row => {
          const tone = getTone(row.value);
          const width = Math.min(100, Math.max(12, Math.abs(row.value) / row.max * 100));
          return (
            <div key={row.label}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#475569]">{row.label}</p>
                <Delta value={row.value} suffix={row.suffix} />
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f1f5f9]" aria-hidden="true">
                <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-5 rounded-[13px] bg-[#f8fafc] px-3.5 py-3 text-xs leading-5 text-[#64748b]">So sánh giúp gia đình nhận ra thay đổi theo tuần; hãy ưu tiên sự tiến bộ đều đặn hơn một kết quả đơn lẻ.</p>
    </section>
  );
}

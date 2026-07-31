import React from 'react';
import { Bell, BookCheck, BookOpenCheck, Clock3, Percent, Star } from 'lucide-react';
import type { ParentDashboardPayload } from '../../../../shared/parent-portal.contract';

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} phút` : `${Math.floor(minutes / 60)}g ${minutes % 60}p`;
};

const accents = [
  { icon: 'bg-[#fff7d6] text-[#a16207]', bar: 'bg-[#facc15]' },
  { icon: 'bg-[#eff6ff] text-[#2563eb]', bar: 'bg-[#2563eb]' },
  { icon: 'bg-[#ecfdf5] text-[#15803d]', bar: 'bg-[#22c55e]' },
  { icon: 'bg-[#f5f3ff] text-[#7c3aed]', bar: 'bg-[#8b5cf6]' },
  { icon: 'bg-[#fff7ed] text-[#c2410c]', bar: 'bg-[#f97316]' },
  { icon: 'bg-[#fef2f2] text-[#dc2626]', bar: 'bg-[#ef4444]' },
] as const;

export default function ParentMetricGrid({ metrics }: { metrics: ParentDashboardPayload['metrics'] }) {
  const items = [
    { label: 'Điểm trung bình', value: metrics.averageScore.toFixed(1), helper: 'Thang điểm 10', icon: Star },
    { label: 'Bài đã hoàn thành', value: String(metrics.completedQuizzes), helper: 'Trong tuần này', icon: BookCheck },
    { label: 'Tỷ lệ chính xác', value: `${metrics.correctRate}%`, helper: 'Tổng số câu đã làm', icon: Percent },
    { label: 'Thời gian học', value: formatDuration(metrics.learningSeconds), helper: 'Hoạt động ghi nhận', icon: Clock3 },
    { label: 'Bài tập đang chờ', value: String(metrics.pendingAssignments), helper: 'Cần hoàn thành', icon: BookOpenCheck },
    { label: 'Thông báo chưa đọc', value: String(metrics.unreadNotifications), helper: 'Từ giáo viên và nhà trường', icon: Bell },
  ];

  return (
    <section aria-labelledby="parent-metrics-title">
      <div className="mb-3">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2563eb]">Chỉ số tuần này</p>
        <h2 id="parent-metrics-title" className="mt-1 text-lg font-bold tracking-[-0.02em] text-[#0f172a]">Những con số cần quan tâm</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {items.map(({ label, value, helper, icon: Icon }, index) => (
          <article key={label} className="relative overflow-hidden rounded-[20px] border border-[#e2e8f0] bg-white p-4 shadow-[0_16px_38px_-34px_rgba(30,58,138,0.7)] sm:p-5">
            <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${accents[index].bar}`} />
            <div className={`flex h-10 w-10 items-center justify-center rounded-[12px] ${accents[index].icon}`}>
              <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
            </div>
            <p className="mt-4 text-xs font-semibold leading-5 text-[#64748b] sm:text-sm">{label}</p>
            <p className="mt-1 text-xl font-bold tracking-[-0.03em] text-[#0f172a] sm:text-2xl">{value}</p>
            <p className="mt-1 hidden text-xs text-[#94a3b8] sm:block">{helper}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

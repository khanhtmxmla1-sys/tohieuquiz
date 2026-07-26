import React from 'react';
import { BookCheck, BookOpenCheck, Clock3, Percent, Star, Bell } from 'lucide-react';
import type { ParentDashboardPayload } from '../../../../shared/parent-portal.contract';

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} phút` : `${Math.floor(minutes / 60)}g ${minutes % 60}p`;
};

export default function ParentMetricGrid({ metrics }: { metrics: ParentDashboardPayload['metrics'] }) {
  const items = [
    { label: 'Điểm trung bình', value: metrics.averageScore.toFixed(1), icon: Star },
    { label: 'Bài đã hoàn thành', value: String(metrics.completedQuizzes), icon: BookCheck },
    { label: 'Tỷ lệ chính xác', value: `${metrics.correctRate}%`, icon: Percent },
    { label: 'Thời gian học', value: formatDuration(metrics.learningSeconds), icon: Clock3 },
    { label: 'Bài tập đang chờ', value: String(metrics.pendingAssignments), icon: BookOpenCheck },
    { label: 'Thông báo chưa đọc', value: String(metrics.unreadNotifications), icon: Bell },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {items.map(({ label, value, icon: Icon }) => (
        <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><Icon className="h-5 w-5" /></div>
          <p className="mt-3 text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
        </article>
      ))}
    </div>
  );
}

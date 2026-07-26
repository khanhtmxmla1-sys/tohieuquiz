import React, { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react';
import ParentMetricGrid from '../components/ParentMetricGrid';
import ParentProgressPanel from '../components/ParentProgressPanel';
import ParentRecentActivity from '../components/ParentRecentActivity';
import ParentSubjectSummary from '../components/ParentSubjectSummary';
import { useParentPortalStore } from '../useParentPortalStore';

const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export default function ParentDashboardPage() {
  const session = useParentPortalStore(state => state.session);
  const dashboard = useParentPortalStore(state => state.dashboard);
  const isLoading = useParentPortalStore(state => state.isLoading);
  const error = useParentPortalStore(state => state.error);
  const loadDashboard = useParentPortalStore(state => state.loadDashboard);
  const [weekStart, setWeekStart] = useState<string | undefined>(dashboard?.period.weekStart);

  useEffect(() => {
    if (!dashboard) void loadDashboard(weekStart);
  }, [dashboard, loadDashboard, weekStart]);

  if (isLoading && !dashboard) {
    return (
      <div role="status" aria-label="Đang tải tổng quan" className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Tổng quan tuần</h1>
        <div className="h-28 animate-pulse rounded-3xl bg-slate-200" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }
  if (error && !dashboard) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Tổng quan tuần</h1>
        <div className="rounded-3xl border border-red-200 bg-white p-8 text-center">
          <p className="font-semibold text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => loadDashboard(weekStart)}
            className="mt-4 min-h-11 rounded-xl bg-indigo-600 px-5 font-bold text-white"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }
  if (!dashboard) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Tổng quan tuần</h1>
        <p role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">
          Đang tải dữ liệu tổng quan…
        </p>
      </div>
    );
  }

  const changeWeek = (days: number) => {
    const next = addDays(dashboard.period.weekStart, days);
    setWeekStart(next);
    void loadDashboard(next);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Tổng quan tuần</h1>
      <section className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white shadow-lg shadow-indigo-200">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div><p className="text-sm text-indigo-100">Xin chào gia đình của</p><h2 className="mt-1 text-2xl font-bold">{session?.fullName}</h2><p className="mt-1 text-sm text-indigo-100">Lớp {session?.className}</p></div>
          <div className="flex items-center gap-2 rounded-2xl bg-white/10 p-2">
            <button type="button" aria-label="Tuần trước" onClick={() => changeWeek(-7)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/10"><ChevronLeft /></button>
            <div className="min-w-36 text-center text-sm font-semibold"><CalendarDays className="mr-1 inline h-4 w-4" />{new Date(`${dashboard.period.weekStart}T00:00:00`).toLocaleDateString('vi-VN')} – {new Date(`${dashboard.period.weekEnd}T00:00:00`).toLocaleDateString('vi-VN')}</div>
            <button type="button" aria-label="Tuần sau" onClick={() => changeWeek(7)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/10"><ChevronRight /></button>
          </div>
        </div>
      </section>

      {dashboard.metrics.completedQuizzes === 0 && dashboard.recentActivity.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">Tuần này chưa có hoạt động học tập. Hãy động viên con bắt đầu một bài nhé.</p>}
      <ParentMetricGrid metrics={dashboard.metrics} />
      <ParentProgressPanel comparison={dashboard.comparison} />
      <section><h2 className="mb-3 text-lg font-bold">Môn học nổi bật</h2><ParentSubjectSummary subjects={dashboard.subjects} /></section>
      {dashboard.importantNotifications.length > 0 && <section><h2 className="mb-3 text-lg font-bold">Thông báo quan trọng</h2><div className="space-y-3">{dashboard.importantNotifications.slice(0, 3).map(item => <article key={item.id} className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><p className="font-bold">{item.title}</p><p className="mt-1 text-sm text-slate-600">{item.body}</p></article>)}</div></section>}
      <section><h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Lightbulb className="h-5 w-5 text-amber-600" />Gợi ý cho phụ huynh</h2><div className="space-y-2">{dashboard.recommendations.map((item, index) => <p key={`${index}-${item}`} className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{item}</p>)}</div></section>
      <section><h2 className="mb-3 text-lg font-bold">Hoạt động gần đây</h2><ParentRecentActivity items={dashboard.recentActivity} /></section>
    </div>
  );
}

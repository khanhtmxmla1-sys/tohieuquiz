import React, { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { DataFreshnessNotice } from '../../../components/common';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
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

const formatDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('vi-VN', {
  day: '2-digit',
  month: '2-digit',
});

export default function ParentDashboardPage() {
  const { isOnline } = useOnlineStatus();
  const session = useParentPortalStore(state => state.session);
  const dashboard = useParentPortalStore(state => state.dashboard);
  const dashboardUpdatedAt = useParentPortalStore(state => state.dashboardUpdatedAt);
  const isLoading = useParentPortalStore(state => state.isLoading);
  const error = useParentPortalStore(state => state.error);
  const loadDashboard = useParentPortalStore(state => state.loadDashboard);
  const [weekStart, setWeekStart] = useState<string | undefined>(dashboard?.period.weekStart);

  useEffect(() => {
    if (!dashboard && isOnline) void loadDashboard(weekStart);
  }, [dashboard, isOnline, loadDashboard, weekStart]);

  const strongestSubject = useMemo(() => {
    if (!dashboard?.subjects.length) return null;
    return [...dashboard.subjects].sort((a, b) => b.correctRate - a.correctRate)[0];
  }, [dashboard]);

  if (isLoading && !dashboard) {
    return (
      <div role="status" aria-label="Đang tải tổng quan" className="space-y-5">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2563eb]">Báo cáo học tập</p><h1 className="mt-1 text-2xl font-bold text-[#0f172a]">Tổng quan tuần</h1></div>
        <div className="h-44 animate-pulse rounded-[24px] bg-[#e2e8f0] motion-reduce:animate-none" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-[20px] bg-[#e2e8f0] motion-reduce:animate-none" />)}
        </div>
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="space-y-5">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2563eb]">Báo cáo học tập</p><h1 className="mt-1 text-2xl font-bold text-[#0f172a]">Tổng quan tuần</h1></div>
        <div className="rounded-[24px] border border-[#fecaca] bg-white p-8 text-center shadow-[0_18px_44px_-38px_rgba(30,58,138,0.7)]">
          <p className="font-semibold text-[#b91c1c]">{error}</p>
          <button type="button" onClick={() => { if (isOnline) void loadDashboard(weekStart); }} disabled={!isOnline} title={!isOnline ? 'Cần kết nối mạng để thử lại.' : undefined} className="mt-4 min-h-11 rounded-[13px] bg-[#2563eb] px-5 font-bold text-white hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2563eb]/25 disabled:cursor-not-allowed disabled:opacity-50">Thử lại</button>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="space-y-5">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2563eb]">Báo cáo học tập</p><h1 className="mt-1 text-2xl font-bold text-[#0f172a]">Tổng quan tuần</h1></div>
        <p role="status" className="rounded-[22px] border border-[#e2e8f0] bg-white p-6 text-[#64748b]">{isOnline ? 'Đang tải dữ liệu tổng quan…' : 'Chưa có dữ liệu đã tải để xem ngoại tuyến.'}</p>
      </div>
    );
  }

  const changeWeek = (days: number) => {
    if (!isOnline) return;
    const next = addDays(dashboard.period.weekStart, days);
    setWeekStart(next);
    void loadDashboard(next);
  };

  const hasNoActivity = dashboard.metrics.completedQuizzes === 0 && dashboard.recentActivity.length === 0;
  const insightText = strongestSubject
    ? `Con đang thể hiện tốt ở môn ${strongestSubject.subject} với tỷ lệ chính xác ${strongestSubject.correctRate}%.`
    : dashboard.metrics.completedQuizzes > 0
      ? `Con đã hoàn thành ${dashboard.metrics.completedQuizzes} hoạt động học tập trong tuần.`
      : 'Tuần này chưa có đủ dữ liệu để đưa ra nhận định nổi bật.';

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2563eb]">Báo cáo học tập</p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#0f172a] sm:text-3xl">Tổng quan tuần</h1>
          <p className="mt-1 text-sm text-[#64748b]">Những thông tin quan trọng để gia đình đồng hành cùng con.</p>
        </div>
        <div className="flex items-center gap-1 rounded-[15px] border border-[#e2e8f0] bg-white p-1.5 shadow-[0_14px_36px_-32px_rgba(30,58,138,0.8)]">
          <button type="button" aria-label="Tuần trước" disabled={!isOnline || isLoading} title={!isOnline ? 'Cần kết nối mạng để đổi tuần.' : undefined} onClick={() => changeWeek(-7)} className="inline-flex h-11 w-11 items-center justify-center rounded-[11px] text-[#64748b] hover:bg-[#eff6ff] hover:text-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button>
          <div className="min-w-[142px] px-2 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94a3b8]">Tuần đang xem</p>
            <p className="mt-0.5 text-sm font-bold text-[#1e293b]"><CalendarDays className="mr-1 inline h-4 w-4 text-[#2563eb]" aria-hidden="true" />{formatDate(dashboard.period.weekStart)} – {formatDate(dashboard.period.weekEnd)}</p>
          </div>
          <button type="button" aria-label="Tuần sau" disabled={!isOnline || isLoading} title={!isOnline ? 'Cần kết nối mạng để đổi tuần.' : undefined} onClick={() => changeWeek(7)} className="inline-flex h-11 w-11 items-center justify-center rounded-[11px] text-[#64748b] hover:bg-[#eff6ff] hover:text-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
        </div>
      </div>

      {error ? <p role="alert" className="rounded-[16px] border border-[#fde68a] bg-[#fffbeb] p-4 text-sm font-medium text-[#92400e]">{error}</p> : null}
      <DataFreshnessNotice staleAt={dashboardUpdatedAt} isOffline={!isOnline} isRefreshing={isLoading} />

      <section className="relative overflow-hidden rounded-[24px] border border-[#bfdbfe] bg-white p-5 shadow-[0_24px_58px_-44px_rgba(37,99,235,0.75)] sm:p-6" aria-labelledby="weekly-insight-title">
        <div aria-hidden="true" className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#dbeafe]/55" />
        <div aria-hidden="true" className="absolute right-16 top-6 h-12 w-12 rounded-[16px] bg-[#fef3c7]/80 rotate-12" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-[670px]">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#2563eb]"><Sparkles className="h-4 w-4" aria-hidden="true" />Điểm đáng chú ý</div>
            <h2 id="weekly-insight-title" className="mt-3 text-xl font-bold tracking-[-0.025em] text-[#1e3a8a] sm:text-2xl">Chào gia đình của {session?.fullName}</h2>
            <p className="mt-2 text-sm leading-6 text-[#475569] sm:text-base">{insightText}</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-[12px] bg-[#eff6ff] px-3 py-2 text-sm font-semibold text-[#1d4ed8]"><TrendingUp className="h-4 w-4" aria-hidden="true" />Lớp {session?.className} · Cập nhật theo tuần</div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-[230px]">
            <div className="rounded-[16px] border border-[#e2e8f0] bg-[#f8fafc]/90 p-3.5"><p className="text-xs font-semibold text-[#64748b]">Điểm trung bình</p><p className="mt-1 text-2xl font-bold text-[#1e3a8a]">{dashboard.metrics.averageScore.toFixed(1)}</p></div>
            <div className="rounded-[16px] border border-[#e2e8f0] bg-[#f8fafc]/90 p-3.5"><p className="text-xs font-semibold text-[#64748b]">Đã hoàn thành</p><p className="mt-1 text-2xl font-bold text-[#1e3a8a]">{dashboard.metrics.completedQuizzes}</p></div>
          </div>
        </div>
      </section>

      {hasNoActivity && <p className="rounded-[18px] border border-dashed border-[#cbd5e1] bg-white p-5 text-sm text-[#64748b]">Tuần này chưa có hoạt động học tập. Hãy động viên con bắt đầu một bài nhé.</p>}

      <ParentMetricGrid metrics={dashboard.metrics} />

      <div className="grid gap-5 xl:grid-cols-[0.88fr_1.12fr]">
        <ParentProgressPanel comparison={dashboard.comparison} />
        <section aria-labelledby="subject-focus-title">
          <div className="mb-3"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2563eb]">Theo từng môn học</p><h2 id="subject-focus-title" className="mt-1 text-lg font-bold tracking-[-0.02em] text-[#0f172a]">Môn học nổi bật</h2></div>
          <ParentSubjectSummary subjects={dashboard.subjects} />
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-[22px] border border-[#e2e8f0] bg-white p-5 shadow-[0_18px_44px_-38px_rgba(30,58,138,0.7)] sm:p-6" aria-labelledby="important-notifications-title">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#dc2626]">Cần lưu ý</p><h2 id="important-notifications-title" className="mt-1 text-lg font-bold text-[#0f172a]">Thông báo quan trọng</h2></div>
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#fef2f2] text-[#dc2626]"><BellRing className="h-5 w-5" aria-hidden="true" /></span>
          </div>
          {dashboard.importantNotifications.length > 0 ? (
            <div className="mt-4 space-y-3">{dashboard.importantNotifications.slice(0, 3).map(item => <article key={item.id} className="rounded-[15px] border border-[#fee2e2] bg-[#fffafa] p-4"><p className="font-bold text-[#1e293b]">{item.title}</p><p className="mt-1 text-sm leading-6 text-[#64748b]">{item.body}</p></article>)}</div>
          ) : <p className="mt-4 rounded-[15px] bg-[#f8fafc] p-4 text-sm text-[#64748b]">Hiện không có thông báo quan trọng cần xử lý.</p>}
        </section>

        <section className="rounded-[22px] border border-[#fde68a] bg-[#fffdf5] p-5 shadow-[0_18px_44px_-38px_rgba(146,64,14,0.45)] sm:p-6" aria-labelledby="parent-recommendations-title">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#b45309]">Đồng hành tích cực</p><h2 id="parent-recommendations-title" className="mt-1 text-lg font-bold text-[#0f172a]">Gợi ý cho phụ huynh</h2></div>
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#fef3c7] text-[#b45309]"><Lightbulb className="h-5 w-5" aria-hidden="true" /></span>
          </div>
          <div className="mt-4 space-y-3">{dashboard.recommendations.length > 0 ? dashboard.recommendations.map((item, index) => <div key={`${index}-${item}`} className="flex gap-3 rounded-[15px] bg-white/80 p-4"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#facc15] text-xs font-bold text-[#713f12]">{index + 1}</span><p className="text-sm leading-6 text-[#713f12]">{item}</p></div>) : <p className="rounded-[15px] bg-white/80 p-4 text-sm text-[#64748b]">Chưa có gợi ý mới trong tuần này.</p>}</div>
        </section>
      </div>

      <section aria-labelledby="recent-activity-title">
        <div className="mb-3"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2563eb]">Hoạt động học tập</p><h2 id="recent-activity-title" className="mt-1 text-lg font-bold tracking-[-0.02em] text-[#0f172a]">Hoạt động gần đây</h2></div>
        <ParentRecentActivity items={dashboard.recentActivity} />
      </section>
    </div>
  );
}

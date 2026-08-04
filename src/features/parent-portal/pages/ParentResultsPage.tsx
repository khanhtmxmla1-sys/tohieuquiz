import { formatSystemDate } from '../../../utils/dateTime';
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Filter, SlidersHorizontal } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import type { ParentResultHistoryItem } from '../../../../shared/parent-portal.contract';
import { listResults } from '../parentPortalService';

const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const periodRange = (period: string) => {
  if (period === 'week') return { from: isoDaysAgo(7) };
  if (period === 'month') return { from: isoDaysAgo(30) };
  if (period === 'semester') return { from: isoDaysAgo(180) };
  return {};
};

export default function ParentResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get('period') || 'all';
  const subject = searchParams.get('subject') || '';
  const [items, setItems] = useState<ParentResultHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(() => ({ ...periodRange(period), subject: subject || undefined, page: 1, limit: 50 }), [period, subject]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void listResults(filters)
      .then(page => { if (active) setItems(page.items); })
      .catch(loadError => { if (active) setError(loadError instanceof Error ? loadError.message : 'Không tải được kết quả.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== 'all') next.set(key, value); else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const subjects = [...new Set(items.map(item => item.subject))].sort((a, b) => a.localeCompare(b, 'vi'));
  const averageScore = items.length ? items.reduce((sum, item) => sum + item.score, 0) / items.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2563eb]">Kết quả học tập</p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#0f172a] sm:text-3xl">Kết quả học tập</h1>
          <p className="mt-1 text-sm text-[#64748b]">Theo dõi điểm số, phân loại và nhận xét của giáo viên.</p>
        </div>
        {!loading && items.length > 0 && <div className="rounded-[16px] border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3"><p className="text-xs font-semibold text-[#64748b]">Điểm trung bình bộ lọc</p><p className="mt-0.5 text-xl font-bold text-[#1e3a8a]">{averageScore.toFixed(1)}/10</p></div>}
      </div>

      <section className="rounded-[22px] border border-[#e2e8f0] bg-white p-4 shadow-[0_18px_44px_-38px_rgba(30,58,138,0.7)] sm:p-5" aria-labelledby="results-filter-title">
        <div className="mb-4 flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#eff6ff] text-[#2563eb]"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" /></span><div><h2 id="results-filter-title" className="font-bold text-[#1e293b]">Bộ lọc kết quả</h2><p className="text-xs text-[#64748b]">Chọn khoảng thời gian hoặc môn học cần xem.</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-[#475569]"><Filter className="mr-1 inline h-4 w-4 text-[#2563eb]" aria-hidden="true" />Khoảng thời gian
            <select aria-label="Khoảng thời gian" value={period} onChange={event => update('period', event.target.value)} className="mt-2 min-h-12 w-full rounded-[13px] border border-[#dbe4f0] bg-[#f8fafc] px-3 text-base text-[#1e293b] outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10">
              <option value="week">7 ngày gần đây</option><option value="month">30 ngày gần đây</option><option value="semester">Học kỳ gần đây</option><option value="all">Toàn bộ năm học</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-[#475569]">Môn học
            <select aria-label="Môn học" value={subject} onChange={event => update('subject', event.target.value)} className="mt-2 min-h-12 w-full rounded-[13px] border border-[#dbe4f0] bg-[#f8fafc] px-3 text-base text-[#1e293b] outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10">
              <option value="">Tất cả môn</option>{subjects.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>
      </section>

      {loading && <p role="status" className="rounded-[20px] border border-[#e2e8f0] bg-white p-6 text-[#64748b]">Đang tải kết quả…</p>}
      {error && <p role="alert" className="rounded-[16px] border border-[#fecaca] bg-[#fef2f2] p-4 text-[#b91c1c]">{error}</p>}
      {!loading && !items.length && <p className="rounded-[20px] border border-dashed border-[#cbd5e1] bg-white p-8 text-center text-[#64748b]">Chưa có kết quả trong khoảng thời gian này.</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        {items.map(item => (
          <Link key={item.id} to={`/results/${item.id}`} className="group flex min-h-[112px] items-center justify-between gap-4 rounded-[22px] border border-[#e2e8f0] bg-white p-4 shadow-[0_18px_44px_-38px_rgba(30,58,138,0.7)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[#93c5fd] hover:shadow-[0_22px_48px_-34px_rgba(37,99,235,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 sm:p-5">
            <div className="min-w-0"><p className="truncate font-bold text-[#1e293b]">{item.title}</p><p className="mt-1 text-sm text-[#64748b]">{item.subject} · {formatSystemDate(item.submittedAt)}</p><span className="mt-3 inline-flex rounded-[9px] bg-[#eff6ff] px-2.5 py-1 text-xs font-bold text-[#1d4ed8]">{item.classification}{item.hasTeacherReport ? ' · Có nhận xét' : ''}</span></div>
            <div className="flex shrink-0 items-center gap-3"><span className={`text-2xl font-bold ${item.score >= 8 ? 'text-[#15803d]' : item.score >= 5 ? 'text-[#b45309]' : 'text-[#dc2626]'}`}>{item.score.toFixed(1)}</span><ChevronRight className="h-5 w-5 text-[#cbd5e1] transition-transform group-hover:translate-x-0.5 group-hover:text-[#2563eb]" aria-hidden="true" /></div>
          </Link>
        ))}
      </div>
    </div>
  );
}

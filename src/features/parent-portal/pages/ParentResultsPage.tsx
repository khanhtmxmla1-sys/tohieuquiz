import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Filter } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import type { ParentResultHistoryItem } from '../../../../shared/parent-portal.contract';
import { listResults } from '../parentPortalService';

const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
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
    void listResults(filters).then(page => { if (active) setItems(page.items); }).catch(error => { if (active) setError(error instanceof Error ? error.message : 'Không tải được kết quả.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== 'all') next.set(key, value); else next.delete(key);
    setSearchParams(next, { replace: true });
  };
  const subjects = [...new Set(items.map(item => item.subject))].sort((a, b) => a.localeCompare(b, 'vi'));

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold">Kết quả học tập</h1><p className="mt-1 text-sm text-slate-500">Theo dõi điểm số và nhận xét trong năm học.</p></div>
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700"><Filter className="mr-1 inline h-4 w-4" />Khoảng thời gian<select aria-label="Khoảng thời gian" value={period} onChange={event => update('period', event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="week">7 ngày gần đây</option><option value="month">30 ngày gần đây</option><option value="semester">Học kỳ gần đây</option><option value="all">Toàn bộ năm học</option></select></label>
        <label className="text-sm font-semibold text-slate-700">Môn học<select aria-label="Môn học" value={subject} onChange={event => update('subject', event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="">Tất cả môn</option>{subjects.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      </div>
      {loading && <p role="status" className="rounded-2xl bg-white p-6 text-slate-500">Đang tải kết quả…</p>}
      {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>}
      {!loading && !items.length && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Chưa có kết quả trong khoảng thời gian này.</p>}
      <div className="space-y-3">{items.map(item => <Link key={item.id} to={`/results/${item.id}`} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md"><div className="min-w-0"><p className="truncate font-bold text-slate-900">{item.title}</p><p className="mt-1 text-sm text-slate-500">{item.subject} · {new Date(item.submittedAt).toLocaleDateString('vi-VN')}</p><p className="mt-2 text-xs font-semibold text-indigo-700">{item.classification}{item.hasTeacherReport ? ' · Có nhận xét' : ''}</p></div><div className="flex items-center gap-3"><span className="text-2xl font-bold text-indigo-700">{item.score.toFixed(1)}</span><ChevronRight className="h-5 w-5 text-slate-400" /></div></Link>)}</div>
    </div>
  );
}

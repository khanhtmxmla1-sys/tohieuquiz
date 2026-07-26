import React, { useEffect, useMemo, useState } from 'react';
import type { ParentHomeworkHistoryItem } from '../../../../shared/parent-portal.contract';
import { listAssignments } from '../parentPortalService';

const tabs = [
  { id: 'pending', label: 'Đang làm' },
  { id: 'submitted', label: 'Đã nộp' },
  { id: 'graded', label: 'Đã chấm' },
  { id: 'overdue', label: 'Quá hạn' },
] as const;

export default function ParentAssignmentsPage() {
  const [items, setItems] = useState<ParentHomeworkHistoryItem[]>([]);
  const [tab, setTab] = useState<ParentHomeworkHistoryItem['status']>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; void listAssignments({ page: 1, limit: 50 }).then(page => { if (active) setItems(page.items); }).catch(error => { if (active) setError(error instanceof Error ? error.message : 'Không tải được bài tập.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const visible = useMemo(() => items.filter(item => item.status === tab), [items, tab]);
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold">Bài tập</h1><p className="mt-1 text-sm text-slate-500">Theo dõi hạn nộp và kết quả bài tập của con.</p></div>
      <div className="flex gap-2 overflow-x-auto pb-1">{tabs.map(item => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`min-h-11 whitespace-nowrap rounded-xl px-4 text-sm font-bold ${tab === item.id ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{item.label}</button>)}</div>
      {loading && <p role="status" className="rounded-2xl bg-white p-6 text-slate-500">Đang tải bài tập…</p>}
      {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>}
      {!loading && !visible.length && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Không có bài tập ở trạng thái này.</p>}
      <div className="space-y-3">{visible.map(item => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h2 className="font-bold text-slate-900">{item.title}</h2><p className="mt-1 text-sm text-slate-500">{item.subject} · Hạn {new Date(item.deadline).toLocaleString('vi-VN')}</p></div>{item.score !== null && <span className="rounded-xl bg-indigo-50 px-3 py-2 font-bold text-indigo-700">{item.score.toFixed(1)}/10</span>}</div>{item.teacherFeedback && <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">Nhận xét: {item.teacherFeedback}</p>}</article>)}</div>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2 } from 'lucide-react';
import type { ParentHomeworkHistoryItem } from '../../../../shared/parent-portal.contract';
import { listAssignments } from '../parentPortalService';

const tabs = [
  { id: 'pending', label: 'Đang làm', icon: Clock3 },
  { id: 'submitted', label: 'Đã nộp', icon: FileCheck2 },
  { id: 'graded', label: 'Đã chấm', icon: CheckCircle2 },
  { id: 'overdue', label: 'Quá hạn', icon: AlertTriangle },
] as const;

const statusTone: Record<ParentHomeworkHistoryItem['status'], string> = {
  pending: 'bg-[#eff6ff] text-[#1d4ed8]',
  submitted: 'bg-[#f5f3ff] text-[#7c3aed]',
  graded: 'bg-[#ecfdf5] text-[#15803d]',
  overdue: 'bg-[#fef2f2] text-[#dc2626]',
};

export default function ParentAssignmentsPage() {
  const [items, setItems] = useState<ParentHomeworkHistoryItem[]>([]);
  const [tab, setTab] = useState<ParentHomeworkHistoryItem['status']>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listAssignments({ page: 1, limit: 50 })
      .then(page => { if (active) setItems(page.items); })
      .catch(loadError => { if (active) setError(loadError instanceof Error ? loadError.message : 'Không tải được bài tập.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => items.filter(item => item.status === tab), [items, tab]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2563eb]">Kế hoạch học tập</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#0f172a] sm:text-3xl">Bài tập</h1>
        <p className="mt-1 text-sm text-[#64748b]">Theo dõi hạn nộp, trạng thái và phản hồi bài tập của con.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-[18px] border border-[#e2e8f0] bg-white p-2 shadow-[0_16px_38px_-34px_rgba(30,58,138,0.7)]" role="tablist" aria-label="Trạng thái bài tập">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)} className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-[12px] px-3.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${tab === id ? 'bg-[#2563eb] text-white shadow-[0_10px_24px_-18px_rgba(37,99,235,0.9)]' : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1e3a8a]'}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />{label}
            <span aria-hidden="true" className={`rounded-md px-1.5 py-0.5 text-[10px] ${tab === id ? 'bg-white/15 text-white' : 'bg-[#f1f5f9] text-[#64748b]'}`}>{items.filter(item => item.status === id).length}</span>
          </button>
        ))}
      </div>

      {loading && <p role="status" className="rounded-[20px] border border-[#e2e8f0] bg-white p-6 text-[#64748b]">Đang tải bài tập…</p>}
      {error && <p role="alert" className="rounded-[16px] border border-[#fecaca] bg-[#fef2f2] p-4 text-[#b91c1c]">{error}</p>}
      {!loading && !visible.length && <p className="rounded-[20px] border border-dashed border-[#cbd5e1] bg-white p-8 text-center text-[#64748b]">Không có bài tập ở trạng thái này.</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        {visible.map(item => (
          <article key={item.id} className="rounded-[22px] border border-[#e2e8f0] bg-white p-5 shadow-[0_18px_44px_-38px_rgba(30,58,138,0.7)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <span className={`inline-flex rounded-[9px] px-2.5 py-1 text-xs font-bold ${statusTone[item.status]}`}>{tabs.find(value => value.id === item.status)?.label}</span>
                <h2 className="mt-3 truncate text-lg font-bold tracking-[-0.02em] text-[#1e293b]">{item.title}</h2>
                <p className="mt-1 text-sm text-[#64748b]">{item.subject} · Hạn {new Date(item.deadline).toLocaleString('vi-VN')}</p>
              </div>
              {item.score !== null && <span className={`shrink-0 rounded-[12px] px-3 py-2 text-lg font-bold ${item.score >= 8 ? 'bg-[#ecfdf5] text-[#15803d]' : 'bg-[#fff7ed] text-[#b45309]'}`}>{item.score.toFixed(1)}/10</span>}
            </div>
            {item.teacherFeedback && <div className="mt-4 rounded-[14px] bg-[#f8fafc] px-4 py-3"><p className="text-xs font-bold uppercase tracking-[0.1em] text-[#94a3b8]">Nhận xét giáo viên</p><p className="mt-1 text-sm leading-6 text-[#475569]">{item.teacherFeedback}</p></div>}
          </article>
        ))}
      </div>
    </div>
  );
}

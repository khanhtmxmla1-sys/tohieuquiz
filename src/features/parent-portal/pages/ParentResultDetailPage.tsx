import { formatSystemDate } from '../../../utils/dateTime';
import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Heart, ShieldCheck, Target } from 'lucide-react';
import { Link, useParams } from 'react-router';
import type { ParentResultHistoryItem } from '../../../../shared/parent-portal.contract';
import { getResult } from '../parentPortalService';

export default function ParentResultDetailPage() {
  const { resultId = '' } = useParams();
  const [item, setItem] = useState<ParentResultHistoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getResult(resultId)
      .then(value => { if (active) setItem(value); })
      .catch(loadError => { if (active) setError(loadError instanceof Error ? loadError.message : 'Không tải được kết quả.'); });
    return () => { active = false; };
  }, [resultId]);

  if (error) return <p role="alert" className="rounded-[16px] border border-[#fecaca] bg-[#fef2f2] p-5 text-[#b91c1c]">{error}</p>;
  if (!item) return <p role="status" className="rounded-[20px] border border-[#e2e8f0] bg-white p-6 text-[#64748b]">Đang tải chi tiết…</p>;

  return (
    <div className="space-y-6">
      <Link to="/results" className="inline-flex min-h-11 items-center gap-2 rounded-[13px] px-3 font-semibold text-[#1d4ed8] transition-colors hover:bg-[#eff6ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Quay lại kết quả</Link>

      <section className="relative overflow-hidden rounded-[24px] border border-[#bfdbfe] bg-white p-5 shadow-[0_24px_58px_-44px_rgba(37,99,235,0.75)] sm:p-6">
        <div aria-hidden="true" className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#dbeafe]/60" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2563eb]">{item.subject}</p><h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-[#1e3a8a] sm:text-3xl">{item.title}</h1><p className="mt-2 text-sm text-[#64748b]">Hoàn thành ngày {formatSystemDate(item.submittedAt)}</p></div>
          <div className="flex items-end gap-5">
            <p className={`text-5xl font-bold tracking-[-0.05em] ${item.score >= 8 ? 'text-[#15803d]' : item.score >= 5 ? 'text-[#b45309]' : 'text-[#dc2626]'}`}>{item.score.toFixed(1)}<span className="text-xl text-[#64748b]">/10</span></p>
            <div className="pb-1"><p className="font-semibold text-[#1e293b]">{item.correctCount}/{item.totalQuestions} câu đúng</p><p className="mt-1 text-sm text-[#64748b]">Chính xác {item.correctRate}% · {item.classification}</p></div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[22px] border border-[#bbf7d0] bg-white p-5 shadow-[0_18px_44px_-38px_rgba(21,128,61,0.35)]"><span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#ecfdf5] text-[#15803d]"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /></span><h2 className="mt-4 font-bold text-[#1e293b]">Nhận xét giáo viên</h2><p className="mt-2 text-sm leading-6 text-[#475569]">{item.comment || 'Giáo viên chưa thêm nhận xét.'}</p></article>
        <article className="rounded-[22px] border border-[#fed7aa] bg-white p-5 shadow-[0_18px_44px_-38px_rgba(180,83,9,0.32)]"><span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#fff7ed] text-[#c2410c]"><Target className="h-5 w-5" aria-hidden="true" /></span><h2 className="mt-4 font-bold text-[#1e293b]">Nội dung cần cố gắng</h2><p className="mt-2 text-sm leading-6 text-[#475569]">{item.needsImprovement || 'Tiếp tục duy trì thói quen học tập.'}</p></article>
        <article className="rounded-[22px] border border-[#bfdbfe] bg-white p-5 shadow-[0_18px_44px_-38px_rgba(37,99,235,0.35)]"><span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#eff6ff] text-[#2563eb]"><Heart className="h-5 w-5" aria-hidden="true" /></span><h2 className="mt-4 font-bold text-[#1e293b]">Lời động viên</h2><p className="mt-2 text-sm leading-6 text-[#475569]">{item.encouragement || 'Hãy tiếp tục phát huy nhé!'}</p></article>
      </div>

      <p className="flex items-start gap-2.5 rounded-[15px] border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-xs leading-5 text-[#64748b]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#15803d]" aria-hidden="true" />Cổng phụ huynh chỉ hiển thị điểm tổng hợp và nhận xét; không hiển thị câu hỏi hoặc đáp án.</p>
    </div>
  );
}

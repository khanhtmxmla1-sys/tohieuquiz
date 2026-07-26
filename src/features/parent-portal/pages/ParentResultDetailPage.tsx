import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Heart, Target } from 'lucide-react';
import { Link, useParams } from 'react-router';
import type { ParentResultHistoryItem } from '../../../../shared/parent-portal.contract';
import { getResult } from '../parentPortalService';

export default function ParentResultDetailPage() {
  const { resultId = '' } = useParams();
  const [item, setItem] = useState<ParentResultHistoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; void getResult(resultId).then(value => { if (active) setItem(value); }).catch(error => { if (active) setError(error instanceof Error ? error.message : 'Không tải được kết quả.'); }); return () => { active = false; }; }, [resultId]);
  if (error) return <p role="alert" className="rounded-2xl bg-red-50 p-5 text-red-700">{error}</p>;
  if (!item) return <p role="status" className="rounded-2xl bg-white p-6 text-slate-500">Đang tải chi tiết…</p>;
  return (
    <div className="space-y-5">
      <Link to="/results" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 font-semibold text-indigo-700 hover:bg-indigo-50"><ArrowLeft className="h-4 w-4" />Quay lại kết quả</Link>
      <section className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white"><p className="text-sm text-indigo-100">{item.subject}</p><h1 className="mt-1 text-2xl font-bold">{item.title}</h1><div className="mt-5 flex flex-wrap items-end gap-5"><p className="text-5xl font-bold">{item.score.toFixed(1)}<span className="text-xl">/10</span></p><div><p className="font-semibold">{item.correctCount}/{item.totalQuestions} câu đúng</p><p className="text-sm text-indigo-100">Chính xác {item.correctRate}% · {item.classification}</p></div></div></section>
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><CheckCircle2 className="h-5 w-5 text-emerald-700" /><h2 className="mt-3 font-bold">Nhận xét giáo viên</h2><p className="mt-2 text-sm text-slate-700">{item.comment || 'Giáo viên chưa thêm nhận xét.'}</p></article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><Target className="h-5 w-5 text-amber-700" /><h2 className="mt-3 font-bold">Nội dung cần cố gắng</h2><p className="mt-2 text-sm text-slate-700">{item.needsImprovement || 'Tiếp tục duy trì thói quen học tập.'}</p></article>
        <article className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5"><Heart className="h-5 w-5 text-indigo-700" /><h2 className="mt-3 font-bold">Lời động viên</h2><p className="mt-2 text-sm text-slate-700">{item.encouragement || 'Hãy tiếp tục phát huy nhé!'}</p></article>
      </div>
      <p className="rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-500">Cổng phụ huynh chỉ hiển thị điểm tổng hợp và nhận xét; không hiển thị câu hỏi hoặc đáp án.</p>
    </div>
  );
}

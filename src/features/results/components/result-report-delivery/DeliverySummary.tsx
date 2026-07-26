import React from 'react';
import { CheckCircle2, Copy, Download, RotateCcw, Unlink } from 'lucide-react';
import type { ResultReportBatchDetail } from '../../../../../shared/result-reports.contract';
import { buildResultReportCsv, buildResultReportZaloMessage } from '../../utils/resultReportExport';

interface DeliverySummaryProps {
  detail: ResultReportBatchDetail;
  isSubmitting: boolean;
  onRetry: () => void;
  onRevoke: (itemIds?: string[]) => void;
  onClose: () => void;
}

const downloadCsv = (detail: ResultReportBatchDetail) => {
  const csv = buildResultReportCsv(detail.items.map((item) => ({
    studentName: item.studentName,
    className: detail.batch.className,
    score: item.score,
    attemptLabel: `Lần ${Math.max(1, item.attemptCount)}`,
    parentPhone: item.parentPhone,
    publicUrl: item.publicUrl,
    studentStatus: item.studentStatus,
    parentStatus: item.parentStatus,
  })), detail.batch.quizTitle);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `phieu-ket-qua-${detail.batch.className}-${detail.batch.quizId}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const DeliverySummary: React.FC<DeliverySummaryProps> = ({ detail, isSubmitting, onRetry, onRevoke, onClose }) => {
  const failed = detail.items.filter((item) => item.studentStatus === 'failed' || item.studentStatus === 'unresolved' || item.parentStatus === 'failed');
  const complete = failed.length === 0;
  const copyAll = async () => {
    const messages = detail.items.filter((item) => item.publicUrl).map((item) => buildResultReportZaloMessage({ studentName: item.studentName, publicUrl: item.publicUrl }, detail.batch.quizTitle)).join('\n\n');
    if (messages) await navigator.clipboard?.writeText(messages);
  };
  return (
    <section className="space-y-5 px-4 py-5 sm:px-6" aria-labelledby="result-report-summary-heading">
      <div className="text-center">
        <CheckCircle2 className={`mx-auto h-10 w-10 ${complete ? 'text-emerald-600' : 'text-amber-600'}`} />
        <h3 id="result-report-summary-heading" className="mt-2 text-xl font-semibold text-slate-900">
          {complete ? `Đã gửi đủ ${detail.batch.counts.total} phiếu` : `Có ${failed.length} phiếu cần thử lại`}
        </h3>
        <p className="mt-1 text-sm text-slate-600">{detail.batch.quizTitle} · Lớp {detail.batch.className.replace(/^Lớp\s+/i, '')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ['Đã gửi học sinh', detail.batch.counts.studentSent],
          ['Học sinh đã xem', detail.batch.counts.studentViewed],
          ['Link phụ huynh', detail.batch.counts.parentLinks],
          ['Phụ huynh đã mở', detail.batch.counts.parentOpened],
          ['Gửi lỗi', detail.batch.counts.failed],
          ['Tổng phiếu', detail.batch.counts.total],
        ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-slate-900">{value}</p></div>)}
      </div>

      <div className="max-h-60 divide-y divide-slate-200 overflow-y-auto rounded-xl border border-slate-200">
        {detail.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{item.studentName}</p><p className="text-xs text-slate-500">{item.studentStatus} · {item.parentStatus}</p></div>
            {item.lastError && <span className="max-w-52 text-right text-xs text-rose-700">{item.lastError}</span>}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void copyAll()} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold"><Copy className="mr-2 inline h-4 w-4" />Sao chép tin nhắn Zalo</button>
        <button type="button" onClick={() => downloadCsv(detail)} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold"><Download className="mr-2 inline h-4 w-4" />Xuất Excel</button>
        {failed.length > 0 && <button type="button" onClick={onRetry} disabled={isSubmitting} className="min-h-11 rounded-lg bg-amber-600 px-3 text-sm font-semibold text-white disabled:opacity-50"><RotateCcw className="mr-2 inline h-4 w-4" />{isSubmitting ? 'Đang thử lại...' : `Thử gửi lại ${failed.length} phiếu`}</button>}
        {detail.batch.counts.parentLinks > 0 && <button type="button" onClick={() => onRevoke()} disabled={isSubmitting} className="min-h-11 rounded-lg border border-rose-300 px-3 text-sm font-semibold text-rose-700"><Unlink className="mr-2 inline h-4 w-4" />Thu hồi toàn bộ link</button>}
      </div>

      <div className="flex justify-end border-t border-slate-200 pt-4">
        <button type="button" onClick={onClose} className="min-h-11 rounded-lg bg-sky-600 px-5 font-semibold text-white">Hoàn tất</button>
      </div>
    </section>
  );
};

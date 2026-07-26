import React from 'react';
import { ChevronRight, FileText } from 'lucide-react';
import type { StudentResultReportSummary } from '../../../../../shared/result-reports.contract';

interface StudentResultReportCardProps {
  report: StudentResultReportSummary;
  onOpen: (phieuId: string) => void;
}

const formatDate = (value: string): string => {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('vi-VN')
    : value;
};

export const StudentResultReportCard: React.FC<StudentResultReportCardProps> = ({ report, onOpen }) => (
  <button
    type="button"
    onClick={() => onOpen(report.id)}
    aria-label={`Xem phiếu ${report.quizTitle}, ${report.score}/10 điểm`}
    className="flex min-h-24 w-full items-center gap-4 rounded-[14px] border border-slate-200 bg-white p-4 text-left transition-colors hover:border-sky-300 hover:bg-sky-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
  >
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-sky-50 text-sky-700">
      <FileText className="h-5 w-5" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate font-semibold text-slate-900">{report.quizTitle}</span>
      <span className="mt-1 block text-sm text-slate-600">
        {report.score}/10 điểm · {report.classification || 'Đã có kết quả'}
      </span>
      <span className="mt-1 block text-xs text-slate-500">
        {report.teacherName || 'Giáo viên'} · Gửi ngày {formatDate(report.publishedAt)}
      </span>
    </span>
    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
  </button>
);

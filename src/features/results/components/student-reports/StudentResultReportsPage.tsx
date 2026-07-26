import React from 'react';
import { ArrowLeft, FileText, RefreshCw } from 'lucide-react';
import MathSpan from '../../../../components/common/MathSpan';
import type { StudentResultReportDetail } from '../../../../../shared/result-reports.contract';
import { useStudentResultReports } from '../../hooks/useStudentResultReports';
import { StudentResultReportCard } from './StudentResultReportCard';

interface StudentResultReportsPageProps {
  selectedReportId?: string | null;
}

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString('vi-VN')
    : value;
};

const Metric = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
  </div>
);

const ReportDetail = ({
  report,
  onBack,
}: {
  report: StudentResultReportDetail;
  onBack: () => void;
}) => (
  <section aria-labelledby="student-result-report-detail-title" className="mx-auto max-w-4xl">
    <button
      type="button"
      onClick={onBack}
      className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      <ArrowLeft className="h-4 w-4" /> Quay lại danh sách phiếu
    </button>

    <article className="mt-4 overflow-hidden rounded-[14px] border border-slate-200 bg-white">
      <header className="border-b border-slate-200 bg-sky-50 px-5 py-5 sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Phiếu kết quả học tập</p>
        <h2 id="student-result-report-detail-title" className="mt-2 text-2xl font-semibold text-slate-900">
          {report.quizTitle}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {report.studentName} · {report.teacherName || 'Giáo viên'} · {formatDateTime(report.publishedAt)}
        </p>
      </header>

      <div className="space-y-6 p-5 sm:p-7">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Điểm số" value={`${report.score}/10`} />
          <Metric label="Xếp loại" value={report.classification || 'Đã hoàn thành'} />
          <Metric label="Câu đúng" value={`${report.correctCount}/${report.totalQuestions}`} />
          <Metric label="Câu cần xem lại" value={report.incorrectCount} />
        </div>

        <div className="space-y-4">
          <section className="rounded-[12px] border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Nhận xét của giáo viên</h3>
            <MathSpan content={report.comment || 'Giáo viên chưa thêm nhận xét.'} as="p" className="mt-2 whitespace-pre-wrap leading-7 text-slate-700" />
          </section>
          <section className="rounded-[12px] border border-amber-200 bg-amber-50/50 p-4">
            <h3 className="text-sm font-semibold text-amber-950">Nội dung cần cố gắng</h3>
            <MathSpan content={report.needsImprovement || 'Tiếp tục ôn luyện đều đặn.'} as="p" className="mt-2 whitespace-pre-wrap leading-7 text-amber-950" />
          </section>
          <section className="rounded-[12px] border border-emerald-200 bg-emerald-50/50 p-4">
            <h3 className="text-sm font-semibold text-emerald-950">Lời động viên</h3>
            <MathSpan content={report.encouragement || 'Em hãy tiếp tục phát huy nhé.'} as="p" className="mt-2 whitespace-pre-wrap leading-7 text-emerald-950" />
          </section>
        </div>
      </div>
    </article>
  </section>
);

export const StudentResultReportsPage: React.FC<StudentResultReportsPageProps> = ({ selectedReportId }) => {
  const controller = useStudentResultReports(selectedReportId);

  if (controller.selectedReportId) {
    if (controller.isLoadingDetail) {
      return (
        <div aria-label="Đang tải chi tiết phiếu kết quả" aria-busy="true" className="flex min-h-64 items-center justify-center rounded-[14px] border border-slate-200 bg-white text-sm text-slate-600">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Đang tải phiếu...
        </div>
      );
    }
    if (controller.detail) {
      return <ReportDetail report={controller.detail} onBack={controller.closeDetail} />;
    }
    if (controller.error) {
      return (
        <div role="alert" className="mx-auto max-w-2xl rounded-[14px] border border-rose-200 bg-rose-50 p-6 text-center text-rose-800">
          <p>{controller.error}</p>
          <div className="mt-4 flex justify-center gap-3">
            <button type="button" onClick={() => void controller.openReport(controller.selectedReportId!)} className="min-h-11 rounded-[10px] bg-rose-700 px-4 font-semibold text-white">Thử lại</button>
            <button type="button" onClick={controller.closeDetail} className="min-h-11 rounded-[10px] border border-rose-300 bg-white px-4 font-semibold">Quay lại</button>
          </div>
        </div>
      );
    }
  }

  return (
    <section aria-labelledby="student-result-reports-title" className="mx-auto max-w-4xl">
      <div className="mb-5">
        <p className="text-sm font-medium text-sky-700">Theo dõi học tập</p>
        <h1 id="student-result-reports-title" className="mt-1 text-2xl font-semibold text-slate-900">Phiếu kết quả</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Xem lại nhận xét mà giáo viên đã gửi cho từng bài kiểm tra.</p>
      </div>

      {controller.isLoadingList && (
        <div aria-label="Đang tải phiếu kết quả" aria-busy="true" className="flex min-h-52 items-center justify-center rounded-[14px] border border-slate-200 bg-white text-sm text-slate-600">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Đang tải phiếu kết quả...
        </div>
      )}

      {!controller.isLoadingList && controller.error && (
        <div role="alert" className="rounded-[14px] border border-rose-200 bg-rose-50 p-6 text-center text-rose-800">
          <p>{controller.error}</p>
          <button type="button" onClick={() => void controller.loadReports()} className="mt-4 min-h-11 rounded-[10px] bg-rose-700 px-4 font-semibold text-white">Thử lại</button>
        </div>
      )}

      {!controller.isLoadingList && !controller.error && controller.reports.length === 0 && (
        <div role="status" className="rounded-[14px] border border-dashed border-slate-300 bg-white p-10 text-center">
          <FileText className="mx-auto h-9 w-9 text-slate-400" />
          <h2 className="mt-3 font-semibold text-slate-800">Em chưa có phiếu kết quả nào.</h2>
          <p className="mt-1 text-sm text-slate-500">Khi giáo viên gửi phiếu, em sẽ thấy ở đây và trong chuông thông báo.</p>
        </div>
      )}

      {!controller.isLoadingList && !controller.error && controller.reports.length > 0 && (
        <div className="space-y-3">
          {controller.reports.map((report) => (
            <StudentResultReportCard key={report.id} report={report} onOpen={(id) => void controller.openReport(id)} />
          ))}
        </div>
      )}
    </section>
  );
};

export default StudentResultReportsPage;

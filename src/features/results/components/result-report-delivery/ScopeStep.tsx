import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import type { ResultReportAttemptPolicy, ResultReportCohortResponse } from '../../../../../shared/result-reports.contract';

interface ScopeStepProps {
  className: string;
  quizTitle: string;
  attemptPolicy: ResultReportAttemptPolicy;
  onAttemptPolicyChange: (policy: ResultReportAttemptPolicy) => void;
  cohort: ResultReportCohortResponse | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onContinue: () => void;
}

const Metric = ({ label, value, marker }: { label: string; value: number; marker?: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <p data-metric={marker} className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
  </div>
);

export const ScopeStep: React.FC<ScopeStepProps> = (props) => {
  const [showSkipped, setShowSkipped] = useState(true);
  return (
    <section className="space-y-5 px-4 py-5 sm:px-6" aria-labelledby="result-report-scope-heading">
      <div>
        <h3 id="result-report-scope-heading" className="text-lg font-semibold text-slate-900">Chọn phạm vi</h3>
        <p className="mt-1 text-sm text-slate-600">Kiểm tra lớp, bài và cách chọn lần làm trước khi tạo phiếu.</p>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <p className="text-xs font-medium text-slate-500">Lớp</p>
          <p className="mt-1 font-semibold text-slate-900">{props.className}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Bài kiểm tra</p>
          <p className="mt-1 font-semibold text-slate-900">{props.quizTitle}</p>
        </div>
        <label className="text-xs font-medium text-slate-500">
          Chọn lần làm
          <select
            aria-label="Chọn lần làm"
            value={props.attemptPolicy}
            onChange={(event) => props.onAttemptPolicyChange(event.target.value as ResultReportAttemptPolicy)}
            className="mt-1 block min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-sky-500"
          >
            <option value="latest">Lần làm mới nhất</option>
            <option value="highest">Điểm cao nhất</option>
            <option value="first">Lần đầu tiên</option>
          </select>
        </label>
      </div>

      {props.isLoading && (
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-600">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Đang tải danh sách lớp...
        </div>
      )}

      {!props.isLoading && props.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{props.error}</span></div>
          <button onClick={props.onRetry} className="mt-3 min-h-11 rounded-lg border border-rose-300 bg-white px-4 font-semibold">Thử lại</button>
        </div>
      )}

      {!props.isLoading && props.cohort && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Tổng số học sinh" value={props.cohort.summary.totalStudents} marker="total" />
            <Metric label="Đã hoàn thành" value={props.cohort.summary.completedStudents} marker="completed" />
            <Metric label="Chưa làm" value={props.cohort.summary.notCompletedStudents} marker="not-completed" />
            <Metric label="Phiếu sẽ tạo" value={props.cohort.summary.reportCount} marker="report-count" />
          </div>

          {(props.cohort.notCompleted.length > 0 || props.cohort.unresolved.length > 0) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50">
              <button
                type="button"
                onClick={() => setShowSkipped((value) => !value)}
                className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-amber-900"
                aria-expanded={showSkipped}
              >
                <span>{props.cohort.notCompleted.length + props.cohort.unresolved.length} học sinh sẽ được bỏ qua</span>
                {showSkipped ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showSkipped && (
                <ul className="border-t border-amber-200 px-4 py-3 text-sm text-amber-900">
                  {props.cohort.notCompleted.map((student) => <li key={student.id} className="py-1">{student.fullName} — chưa làm bài</li>)}
                  {props.cohort.unresolved.map((item) => <li key={item.student.id} className="py-1">{item.student.fullName} — thiếu định danh</li>)}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      <div className="sticky bottom-0 -mx-4 flex justify-end border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <button
          type="button"
          onClick={props.onContinue}
          disabled={!props.cohort || props.cohort.summary.reportCount === 0 || props.isLoading}
          className="min-h-11 rounded-lg bg-sky-600 px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Tiếp tục
        </button>
      </div>
    </section>
  );
};

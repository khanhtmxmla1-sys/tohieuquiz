import { formatSystemTime } from '../../../utils/dateTime';
import React from 'react';
import { ArrowRight, CheckCircle2, Clock3, Inbox, TriangleAlert } from 'lucide-react';
import type { StudentResult } from '../../../types';

interface RecentSubmissionsPanelProps {
  submissions: StudentResult[];
  isLoading: boolean;
  hasError: boolean;
  onViewAll: () => void;
}

const formatSubmissionTime = (value: string): string => formatSystemTime(value, 'Không rõ giờ');

const RecentSubmissionsPanel: React.FC<RecentSubmissionsPanelProps> = ({
  submissions,
  isLoading,
  hasError,
  onViewAll,
}) => (
  <section
    aria-labelledby="recent-submissions-heading"
    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--dashboard-card-shadow)] sm:p-5"
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-blue-700">Hoạt động hôm nay</p>
        <h2 id="recent-submissions-heading" className="mt-1 text-xl font-bold tracking-tight text-slate-900">
          Bài vừa nộp
        </h2>
      </div>
      <button
        type="button"
        onClick={onViewAll}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        Xem tất cả
        <ArrowRight aria-hidden="true" className="size-4" />
      </button>
    </div>

    {isLoading ? (
      <div className="mt-5 space-y-3" aria-label="Đang tải hoạt động gần đây">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="flex animate-pulse items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="size-10 rounded-xl bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-4/5 rounded bg-slate-200" />
              <div className="h-3 w-2/5 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    ) : submissions.length > 0 ? (
      <ol className="mt-4 space-y-1">
        {submissions.map((result) => {
          const score = Number(result.score || 0);
          const isPass = score >= 5;
          return (
            <li key={result.id} className="flex items-start gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-slate-50">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700">
                {result.studentName.trim().charAt(0).toUpperCase() || '?'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{result.studentName}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                      <span>vừa nộp</span> {result.quizTitle || 'Bài kiểm tra'}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-bold tabular-nums ${isPass ? 'text-emerald-700' : 'text-orange-700'}`}>
                    {score} điểm
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${isPass ? 'text-emerald-700' : 'text-orange-700'}`}>
                    {isPass
                      ? <CheckCircle2 aria-hidden="true" className="size-3.5" />
                      : <TriangleAlert aria-hidden="true" className="size-3.5" />}
                    {isPass ? 'Đạt' : 'Chưa đạt'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    <Clock3 aria-hidden="true" className="size-3.5" />
                    {formatSubmissionTime(result.submittedAt)}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    ) : (
      <div className="mt-4 rounded-xl bg-slate-50 px-4 py-9 text-center">
        <Inbox aria-hidden="true" className="mx-auto size-8 text-slate-400" />
        <p className="mt-3 text-sm font-semibold text-slate-900">
          {hasError ? 'Không thể tải hoạt động' : 'Chưa có bài nộp hôm nay'}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {hasError ? 'Thử tải lại dữ liệu để xem các bài mới nhất.' : 'Các lượt nộp mới sẽ xuất hiện tại đây.'}
        </p>
      </div>
    )}
  </section>
);

export default RecentSubmissionsPanel;

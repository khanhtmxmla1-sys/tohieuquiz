import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { AiQuestionQualitySummary } from '../../../../shared/ai-question-quality.contract';

interface QuestionQualityReviewProps {
  summary: AiQuestionQualitySummary;
  acknowledgedWarningIds: ReadonlySet<string>;
  onToggleWarning: (issueId: string) => void;
}

const QuestionQualityReview: React.FC<QuestionQualityReviewProps> = ({
  summary,
  acknowledgedWarningIds,
  onToggleWarning,
}) => {
  if (summary.issues.length === 0) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4" aria-label="Kiểm tra chất lượng câu hỏi">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          Đã kiểm tra {summary.questionCount} câu — chưa phát hiện lỗi chất lượng.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4" aria-labelledby="question-quality-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 id="question-quality-title" className="font-bold text-slate-900">Kiểm tra chất lượng câu hỏi</h4>
          <p className="text-sm text-slate-600">
            {summary.blockingCount} lỗi bắt buộc · {summary.warningCount} cảnh báo cần xác nhận
          </p>
        </div>
        {summary.blockingCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" /> Chưa thể lưu
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Cần xác nhận
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {summary.issues.map((issue) => {
          const isWarning = issue.severity === 'warning';
          const content = (
            <>
              <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${isWarning ? 'bg-amber-500' : 'bg-red-600'}`} aria-hidden="true" />
              <span className="text-sm text-slate-800">{issue.message}</span>
            </>
          );
          return isWarning ? (
            <label key={issue.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-amber-400"
                checked={acknowledgedWarningIds.has(issue.id)}
                onChange={() => onToggleWarning(issue.id)}
                aria-label={`Xác nhận: ${issue.message}`}
              />
              <span className="flex min-w-0 items-start gap-2">{content}</span>
            </label>
          ) : (
            <div key={issue.id} className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default QuestionQualityReview;

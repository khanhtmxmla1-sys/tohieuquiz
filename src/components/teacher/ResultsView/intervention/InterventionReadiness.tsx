import React from 'react';
import { AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import type { InterventionDataReadiness } from '../../../../../shared/intervention.contract';
import { getInterventionReadinessCopy } from './interventionReadinessCopy';

export interface InterventionReadinessProps {
  readiness: InterventionDataReadiness;
  minimumSampleSize: number;
  minimumConfidence: number;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  compact?: boolean;
}

export const InterventionReadiness: React.FC<InterventionReadinessProps> = ({
  readiness,
  minimumSampleSize,
  minimumConfidence,
  hasActiveFilters = false,
  onClearFilters,
  compact = false,
}) => {
  const copy = getInterventionReadinessCopy(readiness);
  const minimumConfidencePercent = Math.round(minimumConfidence * 100);

  return (
    <div className={compact
      ? 'rounded-xl border border-slate-200 bg-slate-50/70 p-4'
      : 'rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5'}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{copy.primary}</p>
            {readiness.eligibleSignals === 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                Chưa đủ dữ liệu
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Đã phân tích {readiness.studentsInScope} học sinh · {readiness.resultsInWindow} bài làm · {readiness.skillMetadataCoveragePercent}% câu có gắn kỹ năng
          </p>
        </div>
      </div>

      <details className="group mt-3">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-1 text-sm font-semibold text-blue-700 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
          <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
          Xem chi tiết
        </summary>
        <div className="mt-2 border-t border-slate-200 pt-3">
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
              <span>{readiness.studentsInScope} học sinh trong phạm vi</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
              <span>{readiness.resultsInWindow} bài làm hợp lệ</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
              <span>{readiness.questionsWithSkillMetadata}/{readiness.questionsInScope} câu có gắn kỹ năng</span>
            </li>
            {readiness.excludedSignals.insufficientSamples > 0 && (
              <li className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                <span>{readiness.excludedSignals.insufficientSamples} tín hiệu chưa đủ {minimumSampleSize} mẫu</span>
              </li>
            )}
            {readiness.excludedSignals.lowConfidence > 0 && (
              <li className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                <span>{readiness.excludedSignals.lowConfidence} tín hiệu có độ tin cậy dưới {minimumConfidencePercent}%</span>
              </li>
            )}
          </ul>

          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-800">Gợi ý tiếp theo</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
              {copy.guidance.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>

          {hasActiveFilters && onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </details>
    </div>
  );
};

export default InterventionReadiness;

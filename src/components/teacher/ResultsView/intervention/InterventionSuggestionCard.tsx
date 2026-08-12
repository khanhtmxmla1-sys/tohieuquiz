import React from 'react';
import { RefreshCw, Users } from 'lucide-react';
import type { InterventionSuggestion } from '../../../../../shared/intervention.contract';

export interface InterventionSuggestionCardProps {
  suggestion: InterventionSuggestion;
  busy: boolean;
  onCreate: () => void;
}

const percentage = (value: number): string => `${Math.round(value * 100)}%`;
const scoreDeltaLabel = (value: number): string => `${value > 0 ? '+' : ''}${value.toFixed(1)}`;

export const InterventionSuggestionCard: React.FC<InterventionSuggestionCardProps> = ({
  suggestion,
  busy,
  onCreate,
}) => (
  <article className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold text-slate-900">{suggestion.title}</h4>
          <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-amber-800">
            Tin cậy {percentage(suggestion.confidence)}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {suggestion.className} · {suggestion.studentCount} học sinh · {suggestion.sampleSize} lượt trả lời
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Điểm trung bình lần đầu {suggestion.averageFirstScore.toFixed(1)} → gần nhất {suggestion.averageLatestScore.toFixed(1)}
          <span className="ml-2 font-semibold">({scoreDeltaLabel(suggestion.averageScoreDelta)})</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestion.students.slice(0, 6).map((student) => (
            <span key={student.studentId} className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs text-slate-700">
              {student.studentName} · {student.skillAccuracy}%
            </span>
          ))}
          {suggestion.students.length > 6 && (
            <span className="px-2 py-1 text-xs text-slate-500">+{suggestion.students.length - 6} em</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onCreate}
        disabled={busy}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <RefreshCw size={16} className="animate-spin" aria-hidden="true" /> : <Users size={16} aria-hidden="true" />}
        Tạo nhóm hỗ trợ
      </button>
    </div>
  </article>
);

export default InterventionSuggestionCard;

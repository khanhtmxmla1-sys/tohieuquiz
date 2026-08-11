import React, { useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Users } from 'lucide-react';
import type { InterventionSuggestion } from '../../../../../shared/intervention.contract';
import { CreateInterventionGroupForm } from './CreateInterventionGroupForm';

export interface InterventionSuggestionCardProps {
  suggestion: InterventionSuggestion;
  busy: boolean;
  onCreate: (input: { name: string; studentIds: string[] }) => Promise<'created' | 'stale' | 'failed'>;
}

const percentage = (value: number): string => `${Math.round(value * 100)}%`;
const scoreDeltaLabel = (value: number): string => `${value > 0 ? '+' : ''}${value.toFixed(1)}`;

const evidenceCopy = (suggestion: InterventionSuggestion): string => {
  const evidence = suggestion.evidence;
  if (evidence.reason === 'DECLINING_TREND') {
    return `Độ chính xác kỹ năng trung bình ${evidence.averageSkillAccuracy}%; ${evidence.decliningStudentCount}/${suggestion.studentCount} học sinh có điểm gần nhất giảm so với lần đầu.`;
  }
  if (evidence.reason === 'PERSISTENT_WEAKNESS') {
    return `Độ chính xác kỹ năng trung bình ${evidence.averageSkillAccuracy}% sau ${evidence.recentAttemptCount} lượt trả lời có gắn kỹ năng; mức chính xác vẫn còn thấp.`;
  }
  const notImproving = evidence.unchangedStudentCount + evidence.decliningStudentCount;
  return `Độ chính xác kỹ năng trung bình ${evidence.averageSkillAccuracy}%; ${notImproving}/${suggestion.studentCount} học sinh chưa cho thấy cải thiện rõ trong dữ liệu hiện có.`;
};

export const InterventionSuggestionCard: React.FC<InterventionSuggestionCardProps> = ({
  suggestion,
  busy,
  onCreate,
}) => {
  const [reviewOpen, setReviewOpen] = useState(false);

  return (
    <article className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-slate-900">{suggestion.title}</h4>
            <span
              className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-amber-800"
              title="Độ tin cậy dữ liệu phản ánh mức độ đầy đủ và nhất quán của dữ liệu hiện có, không phải xác suất khoa học."
            >
              Độ tin cậy dữ liệu {percentage(suggestion.confidence)}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {suggestion.className} · {suggestion.studentCount} học sinh · {suggestion.sampleSize} lượt trả lời
          </p>
          <div className="mt-3 rounded-lg border border-amber-200/80 bg-white/80 p-3">
            <p className="text-sm font-semibold text-slate-900">Vì sao được gợi ý?</p>
            <p className="mt-1 text-sm leading-6 text-slate-700">{evidenceCopy(suggestion)}</p>
            <p className="mt-1 text-xs text-slate-500">
              Mức thấp nhất {suggestion.evidence.minimumSkillAccuracy}% · {suggestion.evidence.recentAttemptCount} mẫu kỹ năng gần đây
            </p>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Điểm trung bình lần đầu {suggestion.averageFirstScore.toFixed(1)} → gần nhất {suggestion.averageLatestScore.toFixed(1)}
            <span className="ml-2 font-semibold text-slate-700">({scoreDeltaLabel(suggestion.averageScoreDelta)})</span>
          </p>
          {!reviewOpen && (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestion.students.slice(0, 6).map((student) => (
                <span key={student.studentId} className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs text-slate-700">
                  {student.studentName} · {student.skillAccuracy}% · {student.skillSampleSize} mẫu
                </span>
              ))}
              {suggestion.students.length > 6 && (
                <span className="px-2 py-1 text-xs text-slate-500">+{suggestion.students.length - 6} em</span>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setReviewOpen((value) => !value)}
          disabled={busy}
          aria-expanded={reviewOpen}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <RefreshCw size={16} className="animate-spin" aria-hidden="true" /> : <Users size={16} aria-hidden="true" />}
          Tạo nhóm hỗ trợ
          {reviewOpen ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
        </button>
      </div>

      {reviewOpen && (
        <CreateInterventionGroupForm
          suggestion={suggestion}
          busy={busy}
          onCancel={() => setReviewOpen(false)}
          onSubmit={onCreate}
        />
      )}
    </article>
  );
};

export default InterventionSuggestionCard;

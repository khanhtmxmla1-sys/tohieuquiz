import {
  CircleAlert,
  ClipboardList,
  Clock3,
  Minus,
  TrendingUp,
} from 'lucide-react';
import type {
  InterventionGroupProgress,
  InterventionProgressStatus,
} from '../../../../../shared/intervention.contract';

const STATUS_LABELS: Record<InterventionProgressStatus, string> = {
  NO_ASSIGNMENT: 'Chưa giao bài',
  WAITING_FOR_RESULTS: 'Chờ kết quả mới',
  IMPROVING: 'Đang tiến bộ',
  NEEDS_ATTENTION: 'Cần tiếp tục hỗ trợ',
  STABLE: 'Ổn định',
};

const STATUS_PRIORITY: Record<InterventionProgressStatus, number> = {
  NEEDS_ATTENTION: 0,
  WAITING_FOR_RESULTS: 1,
  NO_ASSIGNMENT: 1,
  STABLE: 2,
  IMPROVING: 3,
};

const numberFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

export const getInterventionProgressLabel = (status: InterventionProgressStatus): string => STATUS_LABELS[status];
export const getInterventionProgressPriority = (status: InterventionProgressStatus): number => STATUS_PRIORITY[status];
export const formatInterventionDelta = (value: number): string => (
  `${value > 0 ? '+' : ''}${numberFormatter.format(value)}`
);

const ProgressIcon = ({ status }: { status: InterventionProgressStatus }) => {
  if (status === 'NEEDS_ATTENTION') return <CircleAlert size={16} aria-hidden="true" />;
  if (status === 'WAITING_FOR_RESULTS') return <Clock3 size={16} aria-hidden="true" />;
  if (status === 'IMPROVING') return <TrendingUp size={16} aria-hidden="true" />;
  if (status === 'STABLE') return <Minus size={16} aria-hidden="true" />;
  return <ClipboardList size={16} aria-hidden="true" />;
};

export const InterventionProgressSummary = ({ progress }: { progress: InterventionGroupProgress }) => {
  const hasEvaluatedProgress = progress.status !== 'NO_ASSIGNMENT'
    && progress.status !== 'WAITING_FOR_RESULTS';

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white/80 p-3" aria-label="Tiến bộ của nhóm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <ProgressIcon status={progress.status} />
          {getInterventionProgressLabel(progress.status)}
        </span>
        <span className="text-xs text-slate-500">
          Đã giao {progress.assignedCount} bài · Hoàn thành {progress.completedCount}/{progress.assignedCount} ({progress.completionPercent}%)
        </span>
      </div>

      {hasEvaluatedProgress && progress.averageSkillAccuracyDelta !== null ? (
        <div className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
          <p>Độ chính xác kỹ năng: {formatInterventionDelta(progress.averageSkillAccuracyDelta)} điểm %</p>
          {progress.averageScoreDelta !== null && (
            <p>Điểm bài luyện: {formatInterventionDelta(progress.averageScoreDelta)}</p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-600">Chưa đủ dữ liệu mới</p>
      )}
    </div>
  );
};

export default InterventionProgressSummary;

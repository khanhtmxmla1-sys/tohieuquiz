import type {
  InterventionGroup,
  InterventionMemberProgress,
} from '../../../../../shared/intervention.contract';
import {
  formatInterventionDelta,
  getInterventionProgressLabel,
  getInterventionProgressPriority,
} from './InterventionProgressSummary';

const isEvaluated = (member: InterventionMemberProgress): boolean => (
  member.status !== 'NO_ASSIGNMENT'
  && member.status !== 'WAITING_FOR_RESULTS'
  && member.currentSkillAccuracy !== null
  && member.skillAccuracyDelta !== null
);

export const InterventionMemberProgressList = ({ group }: { group: InterventionGroup }) => {
  const namesByStudentId = new Map(group.members.map((member) => [member.studentId, member.studentName]));
  const members = [...group.progress.members].sort((left, right) => {
    const priority = getInterventionProgressPriority(left.status) - getInterventionProgressPriority(right.status);
    if (priority !== 0) return priority;
    return (namesByStudentId.get(left.studentId) || '').localeCompare(namesByStudentId.get(right.studentId) || '', 'vi');
  });

  return (
    <ul aria-label="Tiến bộ từng học sinh" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {members.map((member) => {
        const studentName = namesByStudentId.get(member.studentId) || member.studentId;
        const evaluated = isEvaluated(member);
        return (
          <li key={member.studentId} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="font-semibold text-slate-900">{studentName}</span>
              <span className="text-xs font-semibold text-slate-600">
                {getInterventionProgressLabel(member.status)}
              </span>
            </div>

            {evaluated ? (
              <p className="mt-2 text-slate-700">
                Kỹ năng {member.baselineSkillAccuracy}% → {member.currentSkillAccuracy}% ({formatInterventionDelta(member.skillAccuracyDelta!)} điểm %) · {member.postInterventionSampleSize} mẫu mới
              </p>
            ) : (
              <p className="mt-2 text-slate-600">
                Chưa đủ dữ liệu mới · {member.postInterventionSampleSize} mẫu mới
              </p>
            )}

            {evaluated && member.currentScore !== null && member.scoreDelta !== null && (
              <p className="mt-1 text-slate-600">
                Điểm {member.baselineScore.toFixed(1)} → {member.currentScore.toFixed(1)} ({formatInterventionDelta(member.scoreDelta)})
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Hoàn thành {member.completedCount}/{member.assignedCount} bài
            </p>
          </li>
        );
      })}
    </ul>
  );
};

export default InterventionMemberProgressList;

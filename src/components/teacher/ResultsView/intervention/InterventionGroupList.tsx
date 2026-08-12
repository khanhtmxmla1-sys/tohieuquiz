import { useMemo, useState } from 'react';
import type { Quiz } from '../../../../types';
import type {
  InterventionGroup,
  InterventionProgressStatus,
} from '../../../../../shared/intervention.contract';
import { InterventionGroupCard } from './InterventionGroupCard';
import { getInterventionProgressPriority } from './InterventionProgressSummary';

const INTERVENTION_GROUP_FILTER_THRESHOLD = 4;

type GroupProgressFilter = 'ALL' | 'NEEDS_ATTENTION' | 'WAITING' | 'IMPROVING';

const FILTERS: Array<{ value: GroupProgressFilter; label: string }> = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'NEEDS_ATTENTION', label: 'Cần hỗ trợ' },
  { value: 'WAITING', label: 'Chờ kết quả' },
  { value: 'IMPROVING', label: 'Đang tiến bộ' },
];

const matchesFilter = (status: InterventionProgressStatus, filter: GroupProgressFilter): boolean => {
  if (filter === 'ALL') return true;
  if (filter === 'WAITING') return status === 'WAITING_FOR_RESULTS' || status === 'NO_ASSIGNMENT';
  return status === filter;
};

export const InterventionGroupList = ({
  groups,
  quizzes,
  onSaved,
}: {
  groups: InterventionGroup[];
  quizzes: Quiz[];
  onSaved: () => Promise<void>;
}) => {
  const [filter, setFilter] = useState<GroupProgressFilter>('ALL');
  const orderedGroups = useMemo(() => [...groups].sort((left, right) => {
    const progressPriority = getInterventionProgressPriority(left.progress.status)
      - getInterventionProgressPriority(right.progress.status);
    if (progressPriority !== 0) return progressPriority;
    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  }), [groups]);
  const showFilters = orderedGroups.length > INTERVENTION_GROUP_FILTER_THRESHOLD;
  const effectiveFilter = showFilters ? filter : 'ALL';
  const visibleGroups = orderedGroups.filter((group) => matchesFilter(group.progress.status, effectiveFilter));

  return (
    <>
      {showFilters && (
        <div className="mb-3 flex flex-wrap gap-2" aria-label="Lọc nhóm theo tiến bộ">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 aria-pressed:border-blue-600 aria-pressed:bg-blue-50 aria-pressed:text-blue-800"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {visibleGroups.map((group) => (
          <InterventionGroupCard
            key={group.id}
            group={group}
            quizzes={quizzes}
            onSaved={onSaved}
          />
        ))}
      </div>

      {visibleGroups.length === 0 && (
        <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Không có nhóm phù hợp với bộ lọc tiến bộ này.
        </p>
      )}
    </>
  );
};

export default InterventionGroupList;

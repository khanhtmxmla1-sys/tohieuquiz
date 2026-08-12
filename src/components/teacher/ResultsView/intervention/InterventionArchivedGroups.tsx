import { Archive, ChevronDown } from 'lucide-react';
import type { Quiz } from '../../../../types';
import type { InterventionGroup } from '../../../../../shared/intervention.contract';
import { InterventionGroupCard } from './InterventionGroupCard';

export const InterventionArchivedGroups = ({
  groups,
  quizzes,
  onSaved,
}: {
  groups: InterventionGroup[];
  quizzes: Quiz[];
  onSaved: () => Promise<void>;
}) => {
  if (groups.length === 0) return null;

  return (
    <details className="group rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-1 text-sm font-semibold text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
        <Archive size={17} aria-hidden="true" />
        Đã kết thúc ({groups.length})
        <ChevronDown size={16} className="ml-auto transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
        {groups.map((group) => (
          <InterventionGroupCard
            key={group.id}
            group={group}
            quizzes={quizzes}
            onSaved={onSaved}
          />
        ))}
      </div>
    </details>
  );
};

export default InterventionArchivedGroups;

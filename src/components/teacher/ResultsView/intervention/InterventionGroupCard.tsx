import React, { useState } from 'react';
import {
  Archive,
  ChevronDown,
  ChevronUp,
  BookOpenCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Quiz } from '../../../../types';
import type { InterventionGroup } from '../../../../../shared/intervention.contract';
import { InterventionArchiveDialog } from './InterventionArchiveDialog';
import { InterventionAssignmentForm } from './InterventionAssignmentForm';
import { InterventionMemberProgressList } from './InterventionMemberProgressList';
import { InterventionNotes } from './InterventionNotes';
import { InterventionProgressSummary } from './InterventionProgressSummary';

export interface InterventionGroupCardProps {
  group: InterventionGroup;
  quizzes: Quiz[];
  onSaved: () => Promise<void>;
}

const percentage = (value: number): string => `${Math.round(value * 100)}%`;

export const InterventionGroupCard: React.FC<InterventionGroupCardProps> = ({
  group,
  quizzes,
  onSaved,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showAssignment, setShowAssignment] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const archived = group.status === 'ARCHIVED';

  const archiveAndReload = async () => {
    toast.success('Đã lưu trữ nhóm hỗ trợ.');
    await onSaved();
  };

  return (
    <article
      id={`intervention-group-${group.id}`}
      tabIndex={-1}
      className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 className="font-semibold text-slate-900">{group.name}</h4>
          <p className="mt-1 text-sm text-slate-600">
            {group.className} · {group.members.length} học sinh · độ tin cậy dữ liệu {percentage(group.confidence)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!archived && (
            <button
              type="button"
              onClick={() => setShowAssignment((value) => !value)}
              aria-expanded={showAssignment}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <BookOpenCheck size={16} aria-hidden="true" /> Tạo bài luyện
            </button>
          )}
          {!archived && (
            <button
              type="button"
              onClick={() => setShowArchive(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Archive size={16} aria-hidden="true" /> Lưu trữ nhóm
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
            Chi tiết
          </button>
        </div>
      </div>

      {archived && (
        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Nhóm đã được lưu trữ và chỉ còn chế độ xem.
        </p>
      )}
      <InterventionProgressSummary progress={group.progress} />

      {showArchive && !archived && (
        <InterventionArchiveDialog
          group={group}
          onClose={() => setShowArchive(false)}
          onArchived={archiveAndReload}
        />
      )}

      {showAssignment && !archived && (
        <InterventionAssignmentForm
          group={group}
          quizzes={quizzes}
          onSaved={onSaved}
          onClose={() => setShowAssignment(false)}
        />
      )}

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-blue-100 pt-4">
          <InterventionMemberProgressList group={group} />
          <InterventionNotes group={group} onSaved={onSaved} />
        </div>
      )}
    </article>
  );
};

export default InterventionGroupCard;

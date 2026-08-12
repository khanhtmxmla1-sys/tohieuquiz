import React, { useState } from 'react';
import {
  BookOpenCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatSystemDateTime } from '../../../../utils/dateTime';
import type { Quiz } from '../../../../types';
import type { InterventionGroup } from '../../../../../shared/intervention.contract';
import { addInterventionNote } from '../../../../services/results/interventionService';
import { InterventionAssignmentForm } from './InterventionAssignmentForm';

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
  const [note, setNote] = useState('');
  const [showAssignment, setShowAssignment] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const saveNote = async () => {
    if (!note.trim() || savingNote) return;
    setSavingNote(true);
    try {
      await addInterventionNote(group.id, { note: note.trim() });
      setNote('');
      toast.success('Đã lưu ghi chú nội bộ.');
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu ghi chú nội bộ.');
    } finally {
      setSavingNote(false);
    }
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
          <button
            type="button"
            onClick={() => setShowAssignment((value) => !value)}
            aria-expanded={showAssignment}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <BookOpenCheck size={16} aria-hidden="true" /> Tạo bài luyện
          </button>
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

      {showAssignment && (
        <InterventionAssignmentForm
          group={group}
          quizzes={quizzes}
          onSaved={onSaved}
          onClose={() => setShowAssignment(false)}
        />
      )}

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-blue-100 pt-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {group.members.map((member) => (
              <div key={member.studentId} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <p className="font-semibold text-slate-800">{member.studentName}</p>
                <p className="mt-1 text-slate-600">
                  Lần đầu {member.firstAttemptScore.toFixed(1)} → gần nhất {member.latestAttemptScore.toFixed(1)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Mức chính xác kỹ năng: {member.skillAccuracy}% · {member.skillSampleSize} mẫu
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-violet-900">
              <ShieldCheck size={16} aria-hidden="true" />
              Ghi chú nội bộ — giáo viên phụ trách và quản trị viên có quyền truy cập
            </div>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Ghi lại hoàn cảnh, cách hỗ trợ hoặc điều cần theo dõi..."
              className="mt-2 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => void saveNote()}
                disabled={!note.trim() || savingNote}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {savingNote && <RefreshCw size={16} className="animate-spin" aria-hidden="true" />}
                Lưu ghi chú
              </button>
            </div>
            {group.notes.length > 0 && (
              <div className="mt-3 space-y-2">
                {group.notes.slice(0, 3).map((item) => (
                  <div key={item.id} className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
                    {item.note}
                    <span className="ml-2 text-xs text-slate-400">{formatSystemDateTime(item.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
};

export default InterventionGroupCard;

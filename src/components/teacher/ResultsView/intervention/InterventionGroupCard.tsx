import React, { useMemo, useState } from 'react';
import {
  BookOpenCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatSystemDateTime, getSystemDefaultDeadline, systemDateTimeLocalToIso } from '../../../../utils/dateTime';
import type { Quiz } from '../../../../types';
import type { InterventionGroup } from '../../../../../shared/intervention.contract';
import {
  addInterventionNote,
  createInterventionAssignments,
} from '../../../../services/results/interventionService';

export interface InterventionGroupCardProps {
  group: InterventionGroup;
  quizzes: Quiz[];
  onSaved: () => Promise<void>;
}

const defaultDeadline = (): string => getSystemDefaultDeadline(7);
const percentage = (value: number): string => `${Math.round(value * 100)}%`;

export const InterventionGroupCard: React.FC<InterventionGroupCardProps> = ({
  group,
  quizzes,
  onSaved,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');
  const [showAssignment, setShowAssignment] = useState(false);
  const [quizId, setQuizId] = useState('');
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [creatingAssignments, setCreatingAssignments] = useState(false);
  const recommendedQuizIds = useMemo(
    () => new Set(group.recommendedQuizzes.map((quiz) => quiz.quizId)),
    [group.recommendedQuizzes],
  );
  const orderedQuizzes = useMemo(() => [...quizzes].sort((left, right) => {
    const leftRecommended = recommendedQuizIds.has(left.id);
    const rightRecommended = recommendedQuizIds.has(right.id);
    if (leftRecommended !== rightRecommended) return leftRecommended ? -1 : 1;
    return left.title.localeCompare(right.title);
  }), [quizzes, recommendedQuizIds]);

  const openAssignment = () => {
    setQuizId((current) => current || orderedQuizzes[0]?.id || '');
    setDeadline(defaultDeadline());
    setIdempotencyKey(`intervention-${group.id}-${crypto.randomUUID()}`);
    setShowAssignment(true);
  };

  const saveNote = async () => {
    if (!note.trim() || savingNote) return;
    setSavingNote(true);
    try {
      await addInterventionNote(group.id, { note: note.trim() });
      setNote('');
      toast.success('Đã lưu ghi chú riêng cho giáo viên.');
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu ghi chú riêng.');
    } finally {
      setSavingNote(false);
    }
  };

  const assign = async () => {
    if (!quizId || !deadline || !idempotencyKey || creatingAssignments) return;
    setCreatingAssignments(true);
    try {
      const result = await createInterventionAssignments(group.id, {
        quizId,
        deadline: systemDateTimeLocalToIso(deadline),
        maxAttempts,
        idempotencyKey,
      });
      toast.success(result.assignmentIds.length
        ? `Đã tạo ${result.assignmentIds.length} bài luyện tập cá nhân.`
        : 'Các học sinh trong nhóm đã có bài luyện tập đang mở.');
      setShowAssignment(false);
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể giao bài cho nhóm.');
    } finally {
      setCreatingAssignments(false);
    }
  };

  return (
    <article className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 className="font-semibold text-slate-900">{group.name}</h4>
          <p className="mt-1 text-sm text-slate-600">
            {group.className} · {group.members.length} học sinh · độ tin cậy {percentage(group.confidence)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openAssignment}
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
        <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4" aria-label={`Tạo bài luyện cho ${group.name}`}>
          <p className="mb-3 text-sm font-semibold text-slate-800">Bước cuối: kiểm tra bài luyện và xác nhận giao</p>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Bài kiểm tra
              <select value={quizId} onChange={(event) => setQuizId(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="">Chọn bài</option>
                {orderedQuizzes.map((quiz) => (
                  <option key={quiz.id} value={quiz.id}>
                    {recommendedQuizIds.has(quiz.id) ? '★ ' : ''}{quiz.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Hạn hoàn thành
              <input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2" />
              <span className="mt-1 block text-xs font-normal text-slate-500">Giờ Hà Nội (GMT+7)</span>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Số lượt làm
              <input type="number" min={1} max={10} value={maxAttempts} onChange={(event) => setMaxAttempts(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setShowAssignment(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Hủy</button>
            <button
              type="button"
              onClick={assign}
              disabled={!quizId || !deadline || creatingAssignments}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {creatingAssignments && <RefreshCw size={16} className="animate-spin" aria-hidden="true" />}
              Giao bài cho nhóm
            </button>
          </div>
        </div>
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
                <p className="mt-1 text-xs text-slate-500">Mức chính xác kỹ năng: {member.skillAccuracy}% · {member.skillSampleSize} mẫu</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-violet-900">
              <ShieldCheck size={16} aria-hidden="true" /> Ghi chú riêng — chỉ giáo viên nhìn thấy
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
                onClick={saveNote}
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

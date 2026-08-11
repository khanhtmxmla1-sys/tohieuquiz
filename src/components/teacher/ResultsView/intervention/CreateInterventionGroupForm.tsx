import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, RefreshCw } from 'lucide-react';
import type { InterventionStudentSignal, InterventionSuggestion } from '../../../../../shared/intervention.contract';

export interface CreateInterventionGroupFormProps {
  suggestion: InterventionSuggestion;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: { name: string; studentIds: string[] }) => Promise<'created' | 'stale' | 'failed'>;
}

const trendLabel = (student: InterventionStudentSignal): string => {
  const scored = student.fourWeekTrend
    .map((point) => point.averageScore)
    .filter((score): score is number => score !== null && Number.isFinite(score));
  if (scored.length < 2) return 'Chưa đủ dữ liệu xu hướng';
  const delta = scored[scored.length - 1] - scored[scored.length - 2];
  if (delta >= 0.5) return 'Xu hướng gần đây: tăng';
  if (delta <= -0.5) return 'Xu hướng gần đây: giảm';
  return 'Xu hướng gần đây: ổn định';
};

export const CreateInterventionGroupForm: React.FC<CreateInterventionGroupFormProps> = ({
  suggestion,
  busy,
  onCancel,
  onSubmit,
}) => {
  const defaultName = `Hỗ trợ ${suggestion.skillLabel} — ${suggestion.className}`;
  const [name, setName] = useState(defaultName);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(suggestion.students.map((student) => student.studentId)),
  );
  const [submitting, setSubmitting] = useState(false);
  const suggestionKeyRef = useRef(suggestion.key);
  const allStudentIds = useMemo(
    () => suggestion.students.map((student) => student.studentId),
    [suggestion.students],
  );

  useEffect(() => {
    const validIds = new Set(allStudentIds);
    if (suggestionKeyRef.current !== suggestion.key) {
      suggestionKeyRef.current = suggestion.key;
      setName(defaultName);
      setSelectedIds(new Set(allStudentIds));
      return;
    }
    setSelectedIds((current) => new Set([...current].filter((studentId) => validIds.has(studentId))));
  }, [allStudentIds, defaultName, suggestion.key]);

  const allSelected = allStudentIds.length > 0 && selectedIds.size === allStudentIds.length;
  const isBusy = busy || submitting;
  const canSubmit = name.trim().length > 0 && selectedIds.size > 0 && !isBusy;

  const toggleStudent = (studentId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(studentId);
      else next.delete(studentId);
      return next;
    });
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    let result: 'created' | 'stale' | 'failed' = 'failed';
    try {
      result = await onSubmit({
        name: name.trim(),
        studentIds: suggestion.students
          .map((student) => student.studentId)
          .filter((studentId) => selectedIds.has(studentId)),
      });
    } finally {
      setSubmitting(false);
    }
    if (result === 'created') onCancel();
  };

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-white p-4" aria-label={`Xem lại thành viên ${suggestion.title}`}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h5 className="font-semibold text-slate-900">Xem lại học sinh trước khi tạo nhóm</h5>
          <p className="mt-1 text-sm text-slate-600">
            {suggestion.className} · {suggestion.skillLabel} · {selectedIds.size}/{suggestion.students.length} học sinh được chọn
          </p>
        </div>
      </div>

      <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor={`intervention-group-name-${suggestion.key}`}>
        Tên nhóm hỗ trợ
      </label>
      <input
        id={`intervention-group-name-${suggestion.key}`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={160}
        className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
      />

      <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800">
        <input
          type="checkbox"
          aria-label="Chọn tất cả học sinh"
          checked={allSelected}
          onChange={(event) => setSelectedIds(new Set(event.target.checked ? allStudentIds : []))}
          className="h-4 w-4 rounded border-slate-300"
        />
        <CheckSquare size={16} aria-hidden="true" />
        Chọn tất cả học sinh
      </label>

      <div className="mt-2 grid gap-2 md:grid-cols-2">
        {suggestion.students.map((student) => (
          <label
            key={student.studentId}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(student.studentId)}
              onChange={(event) => toggleStudent(student.studentId, event.target.checked)}
              aria-label={`${student.studentName} · ${student.skillAccuracy}% · ${student.skillSampleSize} mẫu`}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
            />
            <span className="min-w-0">
              <span className="block font-semibold text-slate-900">{student.studentName}</span>
              <span className="mt-0.5 block text-slate-600">
                Chính xác kỹ năng {student.skillAccuracy}% · {student.skillSampleSize} mẫu
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">{trendLabel(student)}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isBusy}
          className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit}
          aria-busy={isBusy}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy && <RefreshCw size={16} className="animate-spin" aria-hidden="true" />}
          Xác nhận tạo nhóm
        </button>
      </div>
    </div>
  );
};

export default CreateInterventionGroupForm;

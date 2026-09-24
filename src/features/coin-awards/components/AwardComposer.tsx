import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CoinAwardCreateInput,
  CoinAwardSelectionMode,
  CoinAwardSettings,
} from '../../../../shared/coin-awards.contract';
import type { Student } from '../../../types/classroom.types';
import * as classroomService from '../../../services/classroomService';
import type { CoinAwardPreview } from '../coinAwardsService';
import { StudentRecipientPicker } from './StudentRecipientPicker';
import { useModalFocusTrap } from './useModalFocusTrap';

export type CoinAwardDraft = Omit<CoinAwardCreateInput, 'idempotencyKey'>;

interface AwardComposerProps {
  classes: Array<{ id: string; name: string }>;
  initialClassId?: string;
  initialStudentIds?: string[];
  initialSelectionMode?: CoinAwardSelectionMode;
  settings: CoinAwardSettings | null;
  submitting: boolean;
  onPreview: (draft: CoinAwardDraft) => Promise<CoinAwardPreview | null>;
  onSubmit: (draft: CoinAwardDraft) => Promise<unknown>;
}

const PRESETS = [5, 10, 20, 50] as const;
const SUGGESTED_REASONS = ['Tích cực phát biểu', 'Hoàn thành bài tập', 'Giúp đỡ bạn bè'] as const;
const SELECTION_OPTIONS: Array<{ value: CoinAwardSelectionMode; label: string }> = [
  { value: 'STUDENT', label: 'Một học sinh' },
  { value: 'SELECTED', label: 'Nhiều học sinh' },
  { value: 'CLASS', label: 'Cả lớp' },
];

const initialModeFor = (
  initialSelectionMode: CoinAwardSelectionMode | undefined,
  initialStudentIds: string[],
): CoinAwardSelectionMode => {
  if (initialSelectionMode) return initialSelectionMode;
  return initialStudentIds.length > 1 ? 'SELECTED' : 'STUDENT';
};

export const AwardComposer = ({
  classes,
  initialClassId,
  initialStudentIds = [],
  initialSelectionMode,
  settings,
  submitting,
  onPreview,
  onSubmit,
}: AwardComposerProps) => {
  const fallbackClassId = initialClassId || classes[0]?.id || '';
  const [classId, setClassId] = useState(fallbackClassId);
  const [selectionMode, setSelectionMode] = useState<CoinAwardSelectionMode>(
    initialModeFor(initialSelectionMode, initialStudentIds),
  );
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    Array.from(new Set(initialStudentIds)),
  );
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [coinsPerStudent, setCoinsPerStudent] = useState(10);
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<CoinAwardPreview | null>(null);
  const [frozenDraft, setFrozenDraft] = useState<CoinAwardDraft | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const closeConfirmationRef = useRef<HTMLButtonElement>(null);
  const awardTriggerRef = useRef<HTMLButtonElement>(null);
  const confirmationDialogRef = useRef<HTMLDivElement>(null);
  const previewingRef = useRef(false);
  const confirmingRef = useRef(false);
  const submittingRef = useRef(false);
  const rosterRequestRef = useRef(0);
  const initialStudentKey = initialStudentIds.join('\u0000');

  const loadStudents = useCallback(async (targetClassId: string) => {
    const requestId = rosterRequestRef.current + 1;
    rosterRequestRef.current = requestId;

    if (!targetClassId) {
      setStudents([]);
      setStudentsError(null);
      setLoadingStudents(false);
      return;
    }

    setLoadingStudents(true);
    setStudentsError(null);
    try {
      const roster = await classroomService.getStudents(targetClassId, 'teacher');
      if (rosterRequestRef.current !== requestId) return;
      setStudents(roster);
      const activeIds = new Set(roster.map((student) => student.id));
      setSelectedStudentIds((current) => current.filter((studentId) => activeIds.has(studentId)));
    } catch (error) {
      if (rosterRequestRef.current !== requestId) return;
      setStudents([]);
      setStudentsError(error instanceof Error ? error.message : 'Không thể tải danh sách học sinh.');
    } finally {
      if (rosterRequestRef.current === requestId) setLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    if (initialClassId) setClassId(initialClassId);
  }, [initialClassId]);

  useEffect(() => {
    setSelectedStudentIds(Array.from(new Set(initialStudentIds)));
  }, [initialStudentKey]);

  useEffect(() => {
    setSelectionMode(initialModeFor(initialSelectionMode, initialStudentIds));
  }, [initialSelectionMode, initialStudentKey]);

  useEffect(() => {
    void loadStudents(classId);
  }, [classId, loadStudents]);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  const selectedClass = classes.find((item) => item.id === classId);
  const recipientCount = confirmation?.recipientCount
    ?? (selectionMode === 'CLASS' ? students.length : selectedStudentIds.length);
  const totalCoins = confirmation?.totalCoins ?? recipientCount * coinsPerStudent;
  const amountLimit = settings?.maxCoinsPerStudent ?? 100;
  const selectedStudentNames = useMemo(() => {
    const selectedIds = new Set(frozenDraft?.studentIds || selectedStudentIds);
    return students.filter((student) => selectedIds.has(student.id)).map((student) => student.fullName);
  }, [frozenDraft, selectedStudentIds, students]);

  const closeConfirmation = useCallback(() => {
    if (submittingRef.current) return false;
    setConfirmation(null);
    setFrozenDraft(null);
    return true;
  }, []);
  const { closeDialog: closeConfirmationDialog, handleKeyDown: handleConfirmationKeyDown } = useModalFocusTrap({
    open: Boolean(confirmation),
    dialogRef: confirmationDialogRef,
    initialFocusRef: closeConfirmationRef,
    triggerRef: awardTriggerRef,
    onEscape: closeConfirmation,
  });

  const handleClassChange = (nextClassId: string) => {
    setClassId(nextClassId);
    setStudents([]);
    setSelectedStudentIds([]);
    setValidationError(null);
  };

  const handleSelectionModeChange = (nextMode: CoinAwardSelectionMode) => {
    setSelectionMode(nextMode);
    setValidationError(null);
    if (nextMode === 'CLASS') {
      setSelectedStudentIds([]);
      return;
    }
    if (nextMode === 'STUDENT' && selectedStudentIds.length !== 1) {
      setSelectedStudentIds([]);
    }
  };

  const createDraft = (): CoinAwardDraft | null => {
    if (!classId) {
      setValidationError('Vui lòng chọn lớp học.');
      return null;
    }
    if (!Number.isInteger(coinsPerStudent) || coinsPerStudent <= 0 || coinsPerStudent > amountLimit) {
      setValidationError(`Số xu mỗi học sinh phải từ 1 đến ${amountLimit}.`);
      return null;
    }
    if (reason.trim().length < 3 || reason.trim().length > 200) {
      setValidationError('Lý do cộng xu phải dài từ 3 đến 200 ký tự.');
      return null;
    }
    if (selectionMode === 'STUDENT' && selectedStudentIds.length !== 1) {
      setValidationError('Vui lòng chọn một học sinh.');
      return null;
    }
    if (selectionMode === 'SELECTED' && selectedStudentIds.length === 0) {
      setValidationError('Vui lòng chọn ít nhất một học sinh.');
      return null;
    }
    setValidationError(null);
    return {
      classId,
      studentIds: selectionMode === 'CLASS' ? [] : selectedStudentIds,
      selectionMode,
      coinsPerStudent,
      reason: reason.trim(),
    };
  };

  const submit = async () => {
    if (previewingRef.current || confirmingRef.current) return;
    const draft = createDraft();
    if (!draft) return;
    setFrozenDraft(draft);
    previewingRef.current = true;
    setPreviewing(true);
    try {
      const preview = await onPreview(draft);
      if (preview) setConfirmation(preview);
      else setFrozenDraft(null);
    } finally {
      previewingRef.current = false;
      setPreviewing(false);
    }
  };

  const confirmDraft = async () => {
    if (!frozenDraft || previewingRef.current || confirmingRef.current) return;
    confirmingRef.current = true;
    try {
      const result = await onSubmit(frozenDraft);
      if (result) {
        submittingRef.current = false;
        closeConfirmationDialog();
      }
    } finally {
      confirmingRef.current = false;
    }
  };

  return (
    <section aria-labelledby="coin-award-composer-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 id="coin-award-composer-title" className="text-lg font-semibold text-slate-900">Cộng xu cho học sinh</h2>
        <p className="mt-1 text-sm text-slate-500">Chọn người nhận, mức xu và ghi rõ lý do để lưu vào lịch sử.</p>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Lớp học
        <select
          aria-label="Lớp học"
          value={classId}
          onChange={(event) => handleClassChange(event.target.value)}
          className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">Chọn lớp học</option>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-slate-700">Người nhận</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SELECTION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={selectionMode === option.value}
              onClick={() => handleSelectionModeChange(option.value)}
              className={`min-h-10 rounded-xl border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                selectionMode === option.value
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {classId ? (
        <StudentRecipientPicker
          students={students}
          selectionMode={selectionMode}
          selectedStudentIds={selectedStudentIds}
          className={selectedClass?.name || classId}
          loading={loadingStudents}
          error={studentsError}
          onSelectionChange={setSelectedStudentIds}
          onRetry={() => void loadStudents(classId)}
        />
      ) : (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Chọn lớp học trước khi chọn học sinh.</p>
      )}

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-slate-700">Số xu mỗi học sinh</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button key={preset} type="button" onClick={() => setCoinsPerStudent(preset)} aria-pressed={coinsPerStudent === preset} className={`min-h-10 rounded-xl border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${coinsPerStudent === preset ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
              +{preset}
            </button>
          ))}
          <label className="sr-only" htmlFor="coin-award-custom-amount">Số xu tùy chỉnh</label>
          <input id="coin-award-custom-amount" aria-label="Số xu tùy chỉnh" type="number" min="1" max={amountLimit} value={coinsPerStudent} onChange={(event) => setCoinsPerStudent(Number(event.target.value))} className="min-h-10 w-28 rounded-xl border border-slate-300 px-3 text-sm" />
        </div>
      </fieldset>

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Lý do
        <textarea aria-label="Lý do" value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Ví dụ: Tích cực phát biểu" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        <span className="mt-1 block text-xs font-normal text-slate-500">Bắt buộc 3–200 ký tự.</span>
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Lý do gợi ý">
          {SUGGESTED_REASONS.map((suggestion) => (
            <button key={suggestion} type="button" aria-label={`Gợi ý: ${suggestion}`} onClick={() => setReason(suggestion)} className="min-h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100">{suggestion}</button>
          ))}
        </div>
      </label>

      <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700" aria-live="polite">
        <span className="font-semibold">{totalCoins} xu cho {recipientCount} học sinh</span>
        {selectionMode === 'CLASS' && <span className="ml-2 text-slate-500">({selectedClass?.name || 'cả lớp'})</span>}
      </div>

      {validationError && <p role="alert" className="mt-3 text-sm text-rose-700">{validationError}</p>}

      <button ref={awardTriggerRef} type="button" onClick={() => { awardTriggerRef.current?.focus(); void submit(); }} disabled={submitting || previewing} className="mt-5 min-h-11 w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:w-auto">
        {submitting ? 'Đang cộng xu…' : previewing ? 'Đang kiểm tra…' : 'Xác nhận thưởng xu'}
      </button>

      {confirmation && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" role="presentation" onMouseDown={(event) => { if (!submitting && event.currentTarget === event.target) closeConfirmationDialog(); }}>
          <div ref={confirmationDialogRef} role="dialog" aria-modal="true" aria-labelledby="coin-award-confirm-title" onKeyDown={handleConfirmationKeyDown} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 id="coin-award-confirm-title" className="text-lg font-semibold text-slate-900">{frozenDraft?.selectionMode === 'CLASS' ? 'Xác nhận thưởng cho cả lớp' : 'Xác nhận thưởng'}</h3>
            <dl className="mt-4 space-y-2 text-sm text-slate-700">
              <div className="flex justify-between gap-4"><dt>Lớp</dt><dd className="font-semibold">{confirmation.className || selectedClass?.name || 'Cả lớp'}</dd></div>
              {frozenDraft?.selectionMode === 'STUDENT' && selectedStudentNames[0] && <div className="flex justify-between gap-4"><dt>Học sinh</dt><dd className="font-semibold">{selectedStudentNames[0]}</dd></div>}
              {frozenDraft?.selectionMode === 'SELECTED' && selectedStudentNames.length > 0 && <div className="flex justify-between gap-4"><dt>Học sinh</dt><dd className="max-w-[70%] text-right font-semibold">{selectedStudentNames.slice(0, 3).join(', ')}{selectedStudentNames.length > 3 ? ` và ${selectedStudentNames.length - 3} em khác` : ''}</dd></div>}
              <div className="flex justify-between gap-4"><dt>Số người nhận</dt><dd className="font-semibold">{confirmation.recipientCount} học sinh</dd></div>
              <div className="flex justify-between gap-4"><dt>Xu mỗi người</dt><dd className="font-semibold">{confirmation.coinsPerStudent} xu/người</dd></div>
              <div className="flex justify-between gap-4"><dt>Tổng cộng</dt><dd className="font-semibold">{confirmation.totalCoins} xu</dd></div>
              {confirmation.remainingTeacherDailyCoins !== null && <div className="flex justify-between gap-4"><dt>Còn lại trong ngày</dt><dd className="font-semibold">{confirmation.remainingTeacherDailyCoins} xu</dd></div>}
              <div className="border-t border-slate-100 pt-2"><dt>Lý do</dt><dd className="mt-1">{confirmation.reason}</dd></div>
            </dl>
            <div className="mt-5 flex justify-end gap-2">
              <button ref={closeConfirmationRef} type="button" aria-label="Đóng" onClick={closeConfirmationDialog} disabled={submitting} className="min-h-10 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Đóng</button>
              <button type="button" onClick={() => void confirmDraft()} disabled={submitting} className="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60">Xác nhận cộng xu</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RotateCcw, X } from 'lucide-react';
import type { Assignment } from '../../../types/classroom.types';

const DEFAULT_REASON = 'Phát hiện câu hỏi hoặc đáp án chưa chính xác';

interface AssignmentRevokeDialogProps {
  assignment: Assignment;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<boolean>;
}

const AssignmentRevokeDialog = ({ assignment, onClose, onConfirm }: AssignmentRevokeDialogProps) => {
  const [reason, setReason] = useState(DEFAULT_REASON);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittedCount = assignment.submittedCount ?? 0;
  const blocked = submittedCount > 0;
  const validReason = reason.trim().length >= 5 && reason.trim().length <= 300;

  useEffect(() => {
    setReason(DEFAULT_REASON);
    setIsSubmitting(false);
  }, [assignment.id]);

  const handleConfirm = async () => {
    if (blocked || !validReason || isSubmitting) return;
    setIsSubmitting(true);
    const ok = await onConfirm(reason.trim());
    setIsSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-revoke-title"
        aria-describedby="assignment-revoke-description"
        aria-label="Thu hồi bài đã giao"
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600">
              <RotateCcw className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id="assignment-revoke-title" className="text-lg font-bold text-slate-900">Thu hồi bài đã giao</h2>
              <p id="assignment-revoke-description" className="mt-1 text-sm text-slate-500">
                Bài sẽ biến mất khỏi danh sách làm bài của học sinh nhưng vẫn được giữ lại trong lịch sử.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thu hồi bài"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">{assignment.quizTitle || assignment.quizId}</p>
            <p className="mt-1 text-sm text-slate-600">
              Lớp {assignment.className || assignment.classId}
              {assignment.studentName ? ` · ${assignment.studentName}` : ' · Toàn lớp'}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-700">
              Đã nộp: {submittedCount}/{assignment.totalStudents ?? 0} học sinh
            </p>
          </div>

          {blocked ? (
            <div role="alert" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Bài đã có {submittedCount} học sinh nộp.</p>
                <p className="mt-1 text-sm">Không thể thu hồi vì sẽ ảnh hưởng kết quả. Hãy đóng bài để ngăn lượt nộp mới và giữ nguyên dữ liệu đã có.</p>
              </div>
            </div>
          ) : (
            <label className="block">
              <span className="text-sm font-semibold text-slate-800">Lý do thu hồi</span>
              <textarea
                aria-label="Lý do thu hồi"
                rows={3}
                maxLength={300}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
              <span className="mt-1 block text-xs text-slate-500">{reason.trim().length}/300 ký tự</span>
            </label>
          )}
        </div>

        <footer className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            aria-label="Xác nhận thu hồi bài"
            onClick={() => { void handleConfirm(); }}
            disabled={blocked || !validReason || isSubmitting}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Thu hồi bài
          </button>
        </footer>
      </section>
    </div>
  );
};

export default AssignmentRevokeDialog;

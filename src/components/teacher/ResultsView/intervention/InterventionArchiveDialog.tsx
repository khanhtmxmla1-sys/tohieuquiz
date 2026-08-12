import { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { InterventionArchiveReason, InterventionGroup } from '../../../../../shared/intervention.contract';
import { archiveInterventionGroup } from '../../../../services/results/interventionService';
import { Modal } from '../../../common/Modal';

const REASONS: Array<{ value: InterventionArchiveReason; label: string }> = [
  { value: 'GOAL_REACHED', label: 'Đã đạt mục tiêu hỗ trợ' },
  { value: 'MOVED_TO_OTHER_SUPPORT', label: 'Chuyển sang hình thức hỗ trợ khác' },
  { value: 'CREATED_BY_MISTAKE', label: 'Nhóm được tạo nhầm' },
  { value: 'OTHER', label: 'Lý do khác' },
];

export const InterventionArchiveDialog = ({
  group,
  onClose,
  onArchived,
}: {
  group: InterventionGroup;
  onClose: () => void;
  onArchived: () => Promise<void>;
}) => {
  const [reason, setReason] = useState<InterventionArchiveReason | ''>('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const reasonRef = useRef<HTMLSelectElement>(null);

  const submit = async () => {
    if (!reason || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await archiveInterventionGroup(group.id, {
        reason,
        note: note.trim() || undefined,
      });
      await onArchived();
      onClose();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : 'Không thể lưu trữ nhóm hỗ trợ.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Lưu trữ nhóm hỗ trợ"
      description="Lưu trữ sẽ dừng các thao tác mới nhưng vẫn giữ thành viên, ghi chú, bài đã giao và lịch sử để xem lại khi cần."
      size="lg"
      initialFocusRef={reasonRef}
    >
      <label htmlFor={`archive-reason-${group.id}`} className="block text-sm font-medium text-slate-700">
        Lý do lưu trữ
      </label>
      <select
        ref={reasonRef}
        id={`archive-reason-${group.id}`}
        value={reason}
        onChange={(event) => setReason(event.target.value as InterventionArchiveReason | '')}
        className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        <option value="">Chọn lý do</option>
        {REASONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>

      <label htmlFor={`archive-note-${group.id}`} className="mt-4 block text-sm font-medium text-slate-700">
        Ghi chú lưu trữ
      </label>
      <textarea
        id={`archive-note-${group.id}`}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={2000}
        rows={3}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        placeholder="Không bắt buộc"
      />

      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!reason || submitting}
          aria-busy={submitting}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <RefreshCw size={16} className="animate-spin" aria-hidden="true" />}
          Xác nhận lưu trữ
        </button>
      </div>
    </Modal>
  );
};

export default InterventionArchiveDialog;

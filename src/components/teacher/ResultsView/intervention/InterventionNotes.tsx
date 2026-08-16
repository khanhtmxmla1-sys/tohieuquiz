import { useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { showError, showSuccess } from '@/src/utils/toast';
import type { InterventionGroup } from '../../../../../shared/intervention.contract';
import { addInterventionNote } from '../../../../services/results/interventionService';
import { formatSystemDateTime } from '../../../../utils/dateTime';

const MAX_NOTE_LENGTH = 2000;
const GROUP_SCOPE = '__group__';

export const InterventionNotes = ({
  group,
  onSaved,
}: {
  group: InterventionGroup;
  onSaved: () => Promise<void>;
}) => {
  const [scope, setScope] = useState(GROUP_SCOPE);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const archived = group.status === 'ARCHIVED';
  const namesByStudentId = useMemo(
    () => new Map(group.members.map((member) => [member.studentId, member.studentName])),
    [group.members],
  );

  const save = async () => {
    if (archived || !note.trim() || saving) return;
    setSaving(true);
    try {
      await addInterventionNote(group.id, {
        note: note.trim(),
        ...(scope === GROUP_SCOPE ? {} : { studentId: scope }),
      });
      setNote('');
      showSuccess('Đã lưu ghi chú nội bộ.');
      await onSaved();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Không thể lưu ghi chú nội bộ.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-violet-200 bg-violet-50 p-3" aria-label="Ghi chú nội bộ">
      <div className="flex items-center gap-2 text-sm font-semibold text-violet-900">
        <ShieldCheck size={16} aria-hidden="true" />
        Ghi chú nội bộ
      </div>
      <p className="mt-1 text-xs leading-5 text-violet-800">
        Chỉ giáo viên phụ trách và quản trị viên được phép mới xem được
      </p>

      {!archived && (
        <>
          <label htmlFor={`intervention-note-scope-${group.id}`} className="mt-3 block text-sm font-medium text-slate-700">
            Phạm vi ghi chú
          </label>
          <select
            id={`intervention-note-scope-${group.id}`}
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm"
          >
            <option value={GROUP_SCOPE}>Cả nhóm</option>
            {group.members.map((member) => (
              <option key={member.studentId} value={member.studentId}>{member.studentName}</option>
            ))}
          </select>

          <label htmlFor={`intervention-note-text-${group.id}`} className="sr-only">Nội dung ghi chú</label>
          <textarea
            id={`intervention-note-text-${group.id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={MAX_NOTE_LENGTH}
            rows={3}
            placeholder="Ghi lại hoàn cảnh, cách hỗ trợ hoặc điều cần theo dõi..."
            className="mt-2 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm"
          />
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-500">{note.length.toLocaleString('vi-VN')}/2.000</span>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!note.trim() || saving}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving && <RefreshCw size={16} className="animate-spin" aria-hidden="true" />}
              Lưu ghi chú
            </button>
          </div>
        </>
      )}

      {group.notes.length > 0 ? (
        <div className="mt-3 space-y-2" aria-label="Lịch sử ghi chú nội bộ">
          {group.notes.map((item) => (
            <article key={item.id} className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-600">
                  {item.studentId ? namesByStudentId.get(item.studentId) || 'Học sinh trong nhóm' : 'Cả nhóm'}
                </span>
                <span>{formatSystemDateTime(item.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap break-words">{item.note}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">Chưa có ghi chú nội bộ.</p>
      )}
    </section>
  );
};

export default InterventionNotes;

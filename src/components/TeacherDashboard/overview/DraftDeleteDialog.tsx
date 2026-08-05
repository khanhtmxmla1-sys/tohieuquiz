import React, { useRef } from 'react';
import { FilePenLine, Loader2, Trash2 } from 'lucide-react';
import type { TeacherActionMutation } from '../../../../shared/teacher-action-center.contract';
import Modal from '../../common/Modal';

interface DraftDeleteDialogProps {
  action: TeacherActionMutation | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const DraftDeleteDialog: React.FC<DraftDeleteDialogProps> = ({
  action,
  isDeleting,
  onClose,
  onConfirm,
}) => {
  const keepButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      isOpen={Boolean(action)}
      onClose={() => {
        if (!isDeleting) onClose();
      }}
      title="Xóa bản nháp này?"
      description="Kiểm tra lại trước khi xóa nội dung đang soạn."
      size="sm"
      showCloseButton={!isDeleting}
      closeOnBackdrop={!isDeleting}
      closeOnEscape={!isDeleting}
      initialFocusRef={keepButtonRef}
    >
      {action ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-sky-700 shadow-sm">
              <FilePenLine className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-500">Bản nháp sẽ bị xóa</p>
              <p className="mt-1 break-words font-bold text-slate-900">{action.resourceLabel}</p>
            </div>
          </div>

          <p className="text-sm leading-6 text-slate-600">
            Bản nháp sẽ bị xóa khỏi máy chủ. Đề đã xuất bản và dữ liệu học sinh không bị ảnh hưởng.
            Thao tác này không thể hoàn tác.
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              ref={keepButtonRef}
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Giữ lại
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-rose-300"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              )}
              Xóa bản nháp
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};

export default DraftDeleteDialog;

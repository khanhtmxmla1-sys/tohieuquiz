import { useId, useRef } from 'react';
import { Key, Save, X } from 'lucide-react';
import { useDialogFocus } from '../../../hooks/useDialogFocus';
import { Button } from '../../common';

interface AccessCodeDialogProps {
  editingAccessCode: { quizId: string; currentCode: string } | null;
  newAccessCode: string;
  setNewAccessCode: (value: string) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
}

export const AccessCodeDialog = ({
  editingAccessCode,
  newAccessCode,
  setNewAccessCode,
  onClose,
  onSave,
}: AccessCodeDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const currentCodeLabelId = useId();

  useDialogFocus({
    isOpen: Boolean(editingAccessCode),
    dialogRef,
    initialFocusRef: inputRef,
    onClose,
  });

  if (!editingAccessCode) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-xl"><Key className="w-6 h-6 text-purple-600" aria-hidden="true" /></div>
            <h2 id={titleId} className="text-xl font-bold text-gray-800">Cập nhật mã làm bài</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại cập nhật mã làm bài"
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <p id={currentCodeLabelId} className="block text-sm font-medium text-gray-700 mb-1">Mã hiện tại</p>
            <div aria-labelledby={currentCodeLabelId} className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600 font-mono">
              {editingAccessCode.currentCode || '(Chưa có mã)'}
            </div>
          </div>
          <div>
            <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">Mã mới</label>
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              aria-describedby={descriptionId}
              value={newAccessCode}
              onChange={event => setNewAccessCode(event.target.value.toUpperCase())}
              placeholder="Nhập mã mới (VD: TOAN3A)"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase font-mono transition-all"
              maxLength={10}
            />
            <p id={descriptionId} className="text-xs text-gray-500 mt-2">
              Để trống nếu muốn xóa mã. Học sinh cần nhập đúng mã này để làm bài.
            </p>
          </div>
          <div className="flex gap-3 pt-4">
            <Button onClick={onClose} variant="secondary" className="flex-1">Hủy</Button>
            <Button
              onClick={onSave}
              variant="primary"
              className="flex-1"
              icon={<Save className="w-4 h-4" aria-hidden="true" />}
            >
              Lưu mã
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

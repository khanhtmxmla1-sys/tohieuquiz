import { Key, Save, X } from 'lucide-react';
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
  if (!editingAccessCode) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-xl"><Key className="w-6 h-6 text-purple-600" /></div>
            <h2 className="text-xl font-bold text-gray-800">Cập nhật mã làm bài</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mã hiện tại</label>
            <div className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600 font-mono">
              {editingAccessCode.currentCode || '(Chưa có mã)'}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mã mới</label>
            <input
              type="text"
              value={newAccessCode}
              onChange={event => setNewAccessCode(event.target.value.toUpperCase())}
              placeholder="Nhập mã mới (VD: TOAN3A)"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none uppercase font-mono transition-all"
              maxLength={10}
            />
            <p className="text-xs text-gray-500 mt-2">
              Để trống nếu muốn xóa mã. Học sinh cần nhập đúng mã này để làm bài.
            </p>
          </div>
          <div className="flex gap-3 pt-4">
            <Button onClick={onClose} variant="secondary" className="flex-1">Hủy</Button>
            <Button
              onClick={onSave}
              variant="primary"
              className="flex-1"
              icon={<Save className="w-4 h-4" />}
            >
              Lưu mã
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

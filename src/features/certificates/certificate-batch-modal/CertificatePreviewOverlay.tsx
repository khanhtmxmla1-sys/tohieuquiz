import { Send, X } from 'lucide-react';

interface CertificatePreviewOverlayProps {
  previewUrl: string;
  studentName: string;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const CertificatePreviewOverlay = (props: CertificatePreviewOverlayProps) => {
  if (!props.previewUrl) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4" onClick={props.onClose}>
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <h3 className="font-bold text-slate-800">Xem trước chứng nhận</h3>
            <p className="text-xs text-slate-500">Dữ liệu mẫu: {props.studentName}. Chưa gửi cho học sinh.</p>
          </div>
          <button onClick={props.onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Đóng xem trước">
            <X size={18} />
          </button>
        </div>
        <div className="bg-slate-100 p-3 sm:p-5">
          <img
            src={props.previewUrl}
            alt={`Xem trước chứng nhận của ${props.studentName}`}
            className="mx-auto max-h-[70vh] w-full object-contain shadow-lg"
          />
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-3">
          <button onClick={props.onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
            Quay lại chỉnh sửa
          </button>
          <button
            onClick={props.onConfirm}
            disabled={props.isSubmitting}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Send size={15} /> Xác nhận gửi
          </button>
        </div>
      </div>
    </div>
  );
};

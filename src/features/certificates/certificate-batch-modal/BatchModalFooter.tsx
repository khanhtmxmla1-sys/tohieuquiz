import { Eye, Loader2, Send } from 'lucide-react';

interface BatchModalFooterProps {
  selectedCount: number;
  hasTemplates: boolean;
  isPreviewing: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onPreview: () => void;
  onSubmit: () => void;
}

export const BatchModalFooter = (props: BatchModalFooterProps) => (
  <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
    <button
      onClick={props.onClose}
      className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
    >
      Hủy
    </button>
    <button
      onClick={props.onPreview}
      disabled={props.isPreviewing || props.isSubmitting || !props.hasTemplates || props.selectedCount === 0}
      className="flex items-center gap-2 px-4 py-2 border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50 text-sm font-semibold rounded-xl transition-colors"
    >
      {props.isPreviewing
        ? <><Loader2 size={15} className="animate-spin" /> Đang dựng ảnh...</>
        : <><Eye size={15} /> Xem trước ảnh</>}
    </button>
    <button
      onClick={props.onSubmit}
      disabled={props.isSubmitting || !props.hasTemplates || props.selectedCount === 0}
      className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
    >
      {props.isSubmitting
        ? <><Loader2 size={15} className="animate-spin" /> Đang tạo...</>
        : <><Send size={15} /> Cấp cho {props.selectedCount} học sinh</>}
    </button>
  </div>
);

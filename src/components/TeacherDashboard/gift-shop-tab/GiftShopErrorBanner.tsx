import { AlertCircle, RotateCcw, X } from 'lucide-react';

interface Props {
  error: string | null;
  onClose: () => void;
  onRetry?: () => Promise<void>;
}

export const GiftShopErrorBanner = ({ error, onClose, onRetry }: Props) => error ? (
  <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">Không thể tải đầy đủ dữ liệu</p>
          <p className="mt-0.5 text-sm">{error}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng thông báo lỗi"
        className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={() => void onRetry()}
        className="mt-3 min-h-11 inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Thử lại
      </button>
    )}
  </div>
) : null;

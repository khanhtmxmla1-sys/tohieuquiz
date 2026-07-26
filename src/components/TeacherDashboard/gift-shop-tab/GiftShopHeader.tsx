import { Plus, RefreshCw } from 'lucide-react';

interface Props {
  isAdmin: boolean;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onAddGift: () => void;
}

export const GiftShopHeader = ({ isAdmin, isLoading, onRefresh, onAddGift }: Props) => (
  <header className="flex items-start justify-between gap-4 flex-wrap">
    <div>
      <p className="text-sm font-semibold text-sky-700">Tiện ích / Tiệm tạp hóa</p>
      <h2 className="mt-1 text-2xl md:text-3xl font-bold text-slate-900">Tiệm tạp hóa</h2>
      <p className="mt-1 text-sm md:text-base text-slate-600">
        Quản lý đơn đổi quà và danh mục phần thưởng.
      </p>
    </div>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void onRefresh()}
        className="min-h-11 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
      >
        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
        Làm mới dữ liệu
      </button>
      {isAdmin && (
        <button
          type="button"
          onClick={onAddGift}
          className="min-h-11 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Thêm quà mới
        </button>
      )}
    </div>
    {isLoading && <span role="status" className="sr-only">Đang tải dữ liệu tiệm tạp hóa</span>}
  </header>
);

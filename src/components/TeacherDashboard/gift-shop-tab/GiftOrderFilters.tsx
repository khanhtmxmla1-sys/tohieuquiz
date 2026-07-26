import { Search, X } from 'lucide-react';
import type { GiftOrderStatus } from '../../../types/giftShop.types';
import { STATUS_OPTIONS } from './giftShopConfig';

interface Props {
  isAdmin: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  statusFilter: GiftOrderStatus | 'ALL';
  setStatusFilter: (status: GiftOrderStatus | 'ALL') => void;
  classFilter: string;
  setClassFilter: (classId: string) => void;
}

export const GiftOrderFilters = ({
  isAdmin,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  classFilter,
  setClassFilter,
}: Props) => {
  const hasFilters = Boolean(searchTerm || classFilter || statusFilter !== 'VOUCHER_ISSUED');
  const clearFilters = () => {
    setSearchTerm('');
    setClassFilter('');
    setStatusFilter('VOUCHER_ISSUED');
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(240px,1fr)_220px_auto]">
        <label className="relative block">
          <span className="sr-only">Tìm học sinh hoặc mã nhận quà</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm text-slate-800 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
            placeholder="Tìm học sinh, quà, mã nhận quà…"
          />
        </label>
        {isAdmin ? (
          <label>
            <span className="sr-only">Lọc theo lớp</span>
            <input
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
              placeholder="Tên lớp, ví dụ 3A"
            />
          </label>
        ) : <div />}
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Xóa bộ lọc
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Lọc trạng thái đơn">
        {STATUS_OPTIONS.map((option) => {
          const selected = statusFilter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setStatusFilter(option.value)}
              className={`min-h-11 shrink-0 rounded-full border px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 ${
                selected
                  ? 'border-sky-600 bg-sky-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

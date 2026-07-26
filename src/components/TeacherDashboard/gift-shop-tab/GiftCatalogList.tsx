import { Gift, Pencil, Trash2 } from 'lucide-react';
import type { GiftCatalogItem } from '../../../types/giftShop.types';
import { CATEGORY_LABEL_MAP } from './giftShopConfig';

interface Props {
  catalog: GiftCatalogItem[];
  onEdit: (item: GiftCatalogItem) => void;
  onDelete: (item: GiftCatalogItem) => void;
}

export const GiftCatalogList = ({ catalog, onEdit, onDelete }: Props) => (
  <div className="mt-5 space-y-2">
    {catalog.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center">
        <Gift className="mx-auto h-9 w-9 text-slate-300" aria-hidden="true" />
        <p className="mt-2 text-sm font-semibold text-slate-700">Chưa có phần thưởng nào</p>
      </div>
    ) : catalog.map(item => (
      <article key={item.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-3 sm:flex-row sm:items-center">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 text-slate-300">
          <Gift className="h-6 w-6" aria-hidden="true" />
          <img
            src={item.imageUrl}
            alt={item.name}
            className="absolute inset-0 h-full w-full bg-white object-contain p-1"
            onError={(event) => { event.currentTarget.style.display = 'none'; }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{item.name}</p>
          <p className="mt-1 text-sm text-slate-500">{CATEGORY_LABEL_MAP[item.category]} · {item.priceCoins.toLocaleString('vi-VN')} xu</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" /> Sửa
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Ngừng
          </button>
        </div>
      </article>
    ))}
  </div>
);

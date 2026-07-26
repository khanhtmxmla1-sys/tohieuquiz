import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { Gift, PlusCircle } from 'lucide-react';
import type { GiftCategory } from '../../../types/giftShop.types';
import { CATEGORY_OPTIONS } from './giftShopConfig';
import type { GiftCatalogFormState } from './types';

interface Props {
  form: GiftCatalogFormState;
  setForm: Dispatch<SetStateAction<GiftCatalogFormState>>;
  editingItemId: string | null;
  onSubmit: (event: FormEvent) => Promise<void>;
  onCancelEdit: () => void;
}

const inputClassName = 'mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100';

export const GiftCatalogForm = ({ form, setForm, editingItemId, onSubmit, onCancelEdit }: Props) => (
  <form onSubmit={(event) => void onSubmit(event)} className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_180px]">
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <label className="text-sm font-semibold text-slate-700">
        Tên phần thưởng
        <input
          value={form.name}
          onChange={(event) => setForm(prev => ({ ...prev, name: event.target.value }))}
          className={inputClassName}
          placeholder="Tên quà"
          autoComplete="off"
        />
      </label>
      <label className="text-sm font-semibold text-slate-700">
        Danh mục
        <select
          value={form.category}
          onChange={(event) => setForm(prev => ({ ...prev, category: event.target.value as GiftCategory }))}
          className={inputClassName}
        >
          {CATEGORY_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold text-slate-700">
        Giá đổi bằng xu
        <input
          value={form.priceCoins}
          onChange={(event) => setForm(prev => ({ ...prev, priceCoins: event.target.value }))}
          className={inputClassName}
          placeholder="Giá xu"
          type="number"
          inputMode="numeric"
          min={1}
        />
      </label>
      <label className="text-sm font-semibold text-slate-700 md:col-span-2">
        Đường dẫn ảnh
        <input
          value={form.imageUrl}
          onChange={(event) => setForm(prev => ({ ...prev, imageUrl: event.target.value }))}
          className={inputClassName}
          placeholder="Link ảnh (Cloudinary/CDN)"
          type="url"
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">Nên dùng ảnh vuông, nền sáng và dung lượng nhỏ.</span>
      </label>
      <div className="flex flex-wrap items-center gap-2 md:col-span-2">
        <button
          type="submit"
          className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
        >
          <PlusCircle className="h-4 w-4" aria-hidden="true" />
          {editingItemId ? 'Cập nhật quà' : 'Thêm quà'}
        </button>
        {editingItemId && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            Hủy sửa
          </button>
        )}
      </div>
    </div>
    <div>
      <p className="text-sm font-semibold text-slate-700">Xem trước ảnh</p>
      <div className="relative mt-1 flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-300">
        <Gift className="h-10 w-10" aria-hidden="true" />
        {form.imageUrl.trim() && (
          <img
            src={form.imageUrl.trim()}
            alt="Xem trước phần thưởng"
            className="absolute inset-0 h-full w-full bg-white object-contain p-3"
            onError={(event) => { event.currentTarget.style.display = 'none'; }}
            onLoad={(event) => { event.currentTarget.style.display = 'block'; }}
          />
        )}
      </div>
    </div>
  </form>
);

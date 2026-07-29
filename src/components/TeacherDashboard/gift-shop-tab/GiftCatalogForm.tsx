import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { Gift, PlusCircle } from 'lucide-react';
import type { GiftCatalogScope, GiftCategory } from '../../../types/giftShop.types';
import { CATEGORY_OPTIONS } from './giftShopConfig';
import type { GiftCatalogFormState } from './types';
interface Props { form: GiftCatalogFormState; setForm: Dispatch<SetStateAction<GiftCatalogFormState>>; editingItemId: string | null; onSubmit: (event: FormEvent) => Promise<void>; onCancelEdit: () => void; }
const inputClassName = 'mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100';
export const GiftCatalogForm = ({ form, setForm, editingItemId, onSubmit, onCancelEdit }: Props) => (
  <form onSubmit={(event) => void onSubmit(event)} className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_180px]">
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm font-semibold text-slate-700">Tên phần thưởng<input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputClassName} placeholder="Tên quà" autoComplete="off" /></label>
      <label className="text-sm font-semibold text-slate-700">Danh mục<select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as GiftCategory }))} className={inputClassName}>{CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">Giá đổi bằng xu<input value={form.priceCoins} onChange={e => setForm(p => ({ ...p, priceCoins: e.target.value }))} className={inputClassName} placeholder="Giá xu" type="number" min={1} /></label>
      <label className="text-sm font-semibold text-slate-700">Tổng tồn kho<input value={form.stockTotal} onChange={e => setForm(p => ({ ...p, stockTotal: e.target.value }))} className={inputClassName} aria-label="Tổng tồn kho" type="number" min={0} /></label>
      <label className="text-sm font-semibold text-slate-700">Ngưỡng sắp hết<input value={form.lowStockThreshold} onChange={e => setForm(p => ({ ...p, lowStockThreshold: e.target.value }))} className={inputClassName} aria-label="Ngưỡng sắp hết" type="number" min={0} /></label>
      <label className="text-sm font-semibold text-slate-700">Giới hạn mỗi tuần<input value={form.weeklyLimitPerStudent} onChange={e => setForm(p => ({ ...p, weeklyLimitPerStudent: e.target.value }))} className={inputClassName} aria-label="Giới hạn mỗi tuần" type="number" min={0} /></label>
      <label className="text-sm font-semibold text-slate-700">Phạm vi<select value={form.scopeType} onChange={e => setForm(p => ({ ...p, scopeType: e.target.value as GiftCatalogScope }))} className={inputClassName}><option value="SCHOOL">Toàn trường</option><option value="GRADE">Theo khối</option><option value="CLASS">Theo lớp</option></select></label>
      <label className="text-sm font-semibold text-slate-700">Mã trường<input value={form.schoolId} onChange={e => setForm(p => ({ ...p, schoolId: e.target.value }))} className={inputClassName} placeholder="Để trống dùng trường hiện tại" /></label>
      {form.scopeType === 'CLASS' && <label className="text-sm font-semibold text-slate-700">Mã lớp<input value={form.classId} onChange={e => setForm(p => ({ ...p, classId: e.target.value }))} className={inputClassName} placeholder="Ví dụ class-3a" /></label>}
      {form.scopeType === 'GRADE' && <label className="text-sm font-semibold text-slate-700">Khối<input value={form.gradeLevel} onChange={e => setForm(p => ({ ...p, gradeLevel: e.target.value }))} className={inputClassName} type="number" min={1} max={9} /></label>}
      <label className="text-sm font-semibold text-slate-700 md:col-span-2 lg:col-span-3">Đường dẫn ảnh<input value={form.imageUrl} onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))} className={inputClassName} placeholder="Link ảnh (Cloudinary/CDN)" type="url" /></label>
      <div className="flex flex-wrap items-center gap-2 md:col-span-2 lg:col-span-3"><button type="submit" className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white"><PlusCircle className="h-4 w-4" />{editingItemId ? 'Cập nhật quà' : 'Thêm quà'}</button>{editingItemId && <button type="button" onClick={onCancelEdit} className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold">Hủy sửa</button>}</div>
    </div>
    <div><p className="text-sm font-semibold text-slate-700">Xem trước ảnh</p><div className="relative mt-1 flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-300"><Gift className="h-10 w-10" />{form.imageUrl.trim() && <img src={form.imageUrl.trim()} alt="Xem trước phần thưởng" className="absolute inset-0 h-full w-full bg-white object-contain p-3" />}</div></div>
  </form>
);

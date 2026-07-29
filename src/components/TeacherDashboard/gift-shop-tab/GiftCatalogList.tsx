import { AlertTriangle, Gift, Pencil, Trash2 } from 'lucide-react';
import type { GiftCatalogItem } from '../../../types/giftShop.types';
import { CATEGORY_LABEL_MAP } from './giftShopConfig';
interface Props { catalog: GiftCatalogItem[]; onEdit: (item: GiftCatalogItem) => void; onDelete: (item: GiftCatalogItem) => void; }
const scopeLabel = (item: GiftCatalogItem) => item.scopeType === 'CLASS' ? `Lớp ${item.classId}` : item.scopeType === 'GRADE' ? `Khối ${item.gradeLevel}` : 'Toàn trường';
export const GiftCatalogList = ({ catalog, onEdit, onDelete }: Props) => (
  <div className="mt-5 space-y-2">
    {catalog.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center"><Gift className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-2 text-sm font-semibold">Chưa có phần thưởng nào</p></div> : catalog.map(item => {
      const low = item.stockRemaining <= item.lowStockThreshold;
      return <article key={item.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-3 sm:flex-row sm:items-center">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50"><Gift className="h-6 w-6 text-slate-300" /><img src={item.imageUrl} alt={item.name} className="absolute inset-0 h-full w-full bg-white object-contain p-1" /></div>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{item.name}</p>{low && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"><AlertTriangle className="h-3 w-3" />Sắp hết</span>}</div><p className="mt-1 text-sm text-slate-500">{CATEGORY_LABEL_MAP[item.category]} · {item.priceCoins.toLocaleString('vi-VN')} xu · {scopeLabel(item)}</p><p className="mt-1 text-xs text-slate-500">Còn {item.stockRemaining}/{item.stockTotal} · tối đa {item.weeklyLimitPerStudent || 'không giới hạn'} lần/tuần</p></div>
        <div className="grid grid-cols-2 gap-2 sm:flex"><button type="button" onClick={() => onEdit(item)} className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold"><Pencil className="h-4 w-4" />Sửa</button><button type="button" onClick={() => onDelete(item)} className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 px-3 text-sm font-semibold text-rose-700"><Trash2 className="h-4 w-4" />Ngừng</button></div>
      </article>;
    })}
  </div>
);

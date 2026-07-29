import { AlertTriangle, Gift } from 'lucide-react';
import type { GiftCatalogItem } from '../../../types/giftShop.types';
import { CATEGORY_LABEL_MAP } from './giftShopConfig';

interface Props {
  catalog: GiftCatalogItem[];
  lowStockOnly: boolean;
}

const scopeLabel = (item: GiftCatalogItem) => {
  if (item.scopeType === 'CLASS') return `Lớp ${item.classId || 'chưa xác định'}`;
  if (item.scopeType === 'GRADE') return `Khối ${item.gradeLevel || 'chưa xác định'}`;
  return 'Toàn trường';
};

export const GiftStockOverviewSection = ({ catalog, lowStockOnly }: Props) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5" aria-label="Tồn kho phần thưởng">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Tồn kho phần thưởng</h2>
        <p className="mt-1 text-sm text-slate-600">
          {lowStockOnly ? 'Chỉ hiển thị các món đã chạm ngưỡng sắp hết.' : 'Danh mục đang áp dụng cho lớp hoặc khối của giáo viên.'}
        </p>
      </div>
      {lowStockOnly && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
          <AlertTriangle className="h-4 w-4" /> Cần bổ sung
        </span>
      )}
    </div>

    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {catalog.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center md:col-span-2 xl:col-span-3">
          <Gift className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-2 font-semibold text-slate-700">Không có phần thưởng phù hợp</p>
        </div>
      ) : catalog.map((item) => {
        const lowStock = item.stockRemaining <= item.lowStockThreshold;
        return (
          <article key={item.id} className={`rounded-2xl border p-4 ${lowStock ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-start gap-3">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50">
                <Gift className="h-6 w-6 text-slate-300" />
                <img src={item.imageUrl} alt="" className="absolute inset-0 h-full w-full bg-white object-contain p-1" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{item.name}</h3>
                  {lowStock && <AlertTriangle className="h-4 w-4 text-amber-700" aria-label="Sắp hết hàng" />}
                </div>
                <p className="mt-1 text-sm text-slate-500">{CATEGORY_LABEL_MAP[item.category]} · {scopeLabel(item)}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl bg-white/80 p-3"><p className="text-xs text-slate-500">Còn lại</p><p className="mt-1 font-bold text-slate-900">{item.stockRemaining}/{item.stockTotal}</p></div>
              <div className="rounded-xl bg-white/80 p-3"><p className="text-xs text-slate-500">Ngưỡng thấp</p><p className="mt-1 font-bold text-slate-900">{item.lowStockThreshold}</p></div>
            </div>
          </article>
        );
      })}
    </div>
  </section>
);

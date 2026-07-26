import { useMemo, useState } from 'react';
import { AlertTriangle, Clock3, Gift, X } from 'lucide-react';
import type { GiftOrder } from '../../../types/giftShop.types';
import type { GiftShopFiltersState } from './types';
import { GiftOrderCard } from './GiftOrderCard';
import { GiftOrderFilters } from './GiftOrderFilters';

interface PendingAction {
  type: string;
  targetId?: string;
}

interface Props {
  isAdmin: boolean;
  orders: GiftOrder[];
  isLoading: boolean;
  pendingAction: PendingAction | null;
  filters: GiftShopFiltersState;
  onDeliver: (orderId: string) => Promise<void>;
  onCancel: (orderId: string, reason: string) => Promise<void>;
}

const SkeletonOrders = () => (
  <div className="space-y-3" role="status" aria-label="Đang tải danh sách đơn">
    {[0, 1, 2].map((item) => (
      <div key={item} className="animate-pulse rounded-2xl border border-slate-200 p-4">
        <div className="h-4 w-44 rounded bg-slate-200" />
        <div className="mt-3 h-20 rounded-xl bg-slate-100" />
        <div className="mt-3 h-11 rounded-xl bg-slate-200" />
      </div>
    ))}
    <span className="sr-only">Đang tải đơn đổi quà</span>
  </div>
);

export const GiftOrdersSection = ({
  isAdmin,
  orders,
  isLoading,
  pendingAction,
  filters,
  onDeliver,
  onCancel,
}: Props) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deliverOrder, setDeliverOrder] = useState<GiftOrder | null>(null);
  const [cancelOrder, setCancelOrder] = useState<GiftOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase('vi');
  const filteredOrders = useMemo(() => {
    if (!normalizedSearch) return orders;
    return orders.filter((order) => [
      order.studentName,
      order.studentUsername,
      order.className,
      order.classId,
      order.itemSnapshot.name,
      order.voucherCode,
    ].some((value) => String(value || '').toLocaleLowerCase('vi').includes(normalizedSearch)));
  }, [orders, normalizedSearch]);

  const priorityOrders = useMemo(() => orders
    .filter((order) => order.status === 'VOUCHER_ISSUED')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, 3), [orders]);

  const confirmDelivery = async () => {
    if (!deliverOrder) return;
    await onDeliver(deliverOrder.id);
    setDeliverOrder(null);
  };

  const confirmCancellation = async () => {
    if (!cancelOrder || !cancelReason.trim()) return;
    await onCancel(cancelOrder.id, cancelReason.trim());
    setCancelOrder(null);
    setCancelReason('');
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900">Đơn đổi quà</h3>
        <p className="mt-1 text-sm text-slate-500">Ưu tiên kiểm tra tên học sinh và mã nhận quà trước khi xác nhận.</p>
      </div>

      <GiftOrderFilters
        isAdmin={isAdmin}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={filters.statusFilter}
        setStatusFilter={filters.setStatusFilter}
        classFilter={filters.classFilter}
        setClassFilter={filters.setClassFilter}
      />

      {priorityOrders.length > 0 && filters.statusFilter === 'VOUCHER_ISSUED' && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-900">
            <Clock3 className="h-4 w-4" aria-hidden="true" />
            <h4 className="text-sm font-semibold">Ưu tiên xử lý</h4>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {priorityOrders.map((order) => (
              <div key={order.id} className="min-w-52 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm">
                <p className="font-semibold text-slate-800">{order.studentName}</p>
                <p className="truncate text-slate-500">{order.itemSnapshot.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        {isLoading && orders.length === 0 ? (
          <SkeletonOrders />
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center">
            <Gift className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
            <h4 className="mt-3 font-semibold text-slate-800">Chưa có đơn phù hợp</h4>
            <p className="mt-1 text-sm text-slate-500">Thử đổi trạng thái, tên lớp hoặc từ khóa tìm kiếm.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <GiftOrderCard
                key={order.id}
                order={order}
                pending={pendingAction?.targetId === order.id}
                onRequestDeliver={setDeliverOrder}
                onRequestCancel={(selectedOrder) => {
                  setCancelReason('');
                  setCancelOrder(selectedOrder);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {deliverOrder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="deliver-dialog-title">
          <div className="w-full rounded-t-3xl bg-white p-5 sm:max-w-md sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="deliver-dialog-title" className="text-lg font-bold text-slate-900">Đã trao quà?</h3>
                <p className="mt-1 text-sm text-slate-600">Xác nhận sau khi đã đối chiếu đúng học sinh và mã nhận quà.</p>
              </div>
              <button type="button" onClick={() => setDeliverOrder(null)} aria-label="Đóng" className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
              <p><span className="text-slate-500">Học sinh:</span> <strong>{deliverOrder.studentName}</strong></p>
              <p className="mt-1"><span className="text-slate-500">Phần thưởng:</span> <strong>{deliverOrder.itemSnapshot.name}</strong></p>
              <p className="mt-1"><span className="text-slate-500">Mã nhận:</span> <code className="font-bold">{deliverOrder.voucherCode}</code></p>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setDeliverOrder(null)} className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500">Quay lại</button>
              <button type="button" onClick={() => void confirmDelivery()} disabled={pendingAction?.targetId === deliverOrder.id} className="min-h-11 rounded-xl bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60">Xác nhận đã trao</button>
            </div>
          </div>
        </div>
      )}

      {cancelOrder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title">
          <div className="w-full rounded-t-3xl bg-white p-5 sm:max-w-md sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="cancel-dialog-title" className="text-lg font-bold text-slate-900">Hủy đơn đổi quà</h3>
                <p className="mt-1 text-sm text-slate-600">{cancelOrder.studentName} · {cancelOrder.itemSnapshot.name}</p>
              </div>
              <button type="button" onClick={() => setCancelOrder(null)} aria-label="Đóng" className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <label className="mt-4 block text-sm font-semibold text-slate-800">
              Lý do hủy <span className="text-rose-600">(bắt buộc)</span>
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={4}
                autoFocus
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-normal outline-none focus:border-rose-500 focus:bg-white focus:ring-2 focus:ring-rose-100"
                placeholder="Nhập lý do hủy đơn…"
              />
            </label>
            <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Học sinh sẽ được hoàn 100% ({cancelOrder.priceCoins.toLocaleString('vi-VN')} xu).
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setCancelOrder(null)} className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-rose-500">Quay lại</button>
              <button type="button" onClick={() => void confirmCancellation()} disabled={!cancelReason.trim() || pendingAction?.targetId === cancelOrder.id} className="min-h-11 rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-50">Hủy đơn và hoàn xu</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

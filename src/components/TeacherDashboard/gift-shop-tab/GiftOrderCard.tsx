import { formatSystemDateTime } from '../../../utils/dateTime';
import { useState } from 'react';
import { Check, CheckCircle2, Clipboard, Clock3, Coins, Gift, ShieldCheck, XCircle } from 'lucide-react';
import type { GiftOrder } from '../../../types/giftShop.types';
import { STATUS_CLASS_MAP, STATUS_LABEL_MAP } from './giftShopConfig';

interface Props {
  order: GiftOrder;
  pending: boolean;
  onRequestApprove: (order: GiftOrder) => void;
  onRequestDeliver: (order: GiftOrder) => void;
  onRequestCancel: (order: GiftOrder) => void;
}

const formatDateTime = (value: string) => formatSystemDateTime(value, 'Không rõ thời gian');

export const GiftOrderCard = ({
  order,
  pending,
  onRequestApprove,
  onRequestDeliver,
  onRequestCancel,
}: Props) => {
  const [copied, setCopied] = useState(false);
  const copyVoucher = async () => {
    if (!order.voucherCode) return;
    try {
      await navigator.clipboard.writeText(order.voucherCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-800" aria-hidden="true">
            {(order.studentName || order.studentUsername || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h4 className="truncate font-semibold text-slate-900">{order.studentName || order.studentUsername}</h4>
            <p className="text-sm text-slate-500">{order.className || order.classId || 'Chưa có lớp'}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS_MAP[order.status]}`}>
          {STATUS_LABEL_MAP[order.status]}
        </span>
      </div>

      <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-start gap-2"><Gift className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><div><p className="text-xs text-slate-500">Phần thưởng</p><p className="text-sm font-semibold text-slate-800">{order.itemSnapshot.name}</p></div></div>
        <div className="flex items-start gap-2"><Coins className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><div><p className="text-xs text-slate-500">Giá đổi</p><p className="text-sm font-semibold text-slate-800">{order.priceCoins.toLocaleString('vi-VN')} xu</p></div></div>
        <div className="flex items-start gap-2"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><div><p className="text-xs text-slate-500">Thời gian đổi</p><p className="text-sm font-medium text-slate-700">{formatDateTime(order.createdAt)}</p></div></div>
        <div>
          <p className="text-xs text-slate-500">Mã nhận quà</p>
          {order.voucherCode ? (
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-bold tracking-wide text-slate-800">{order.voucherCode}</code>
              <button type="button" onClick={() => void copyVoucher()} aria-label={`Sao chép mã ${order.voucherCode}`} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500">
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Clipboard className="h-4 w-4" />}
              </button>
            </div>
          ) : <p className="mt-1 text-sm font-semibold text-amber-700">Cấp sau khi duyệt</p>}
        </div>
      </div>

      {order.status === 'PENDING' && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => onRequestApprove(order)} disabled={pending} className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            <ShieldCheck className="h-4 w-4" />{pending ? 'Đang xử lý…' : 'Duyệt đơn'}
          </button>
          <button type="button" onClick={() => onRequestCancel(order)} disabled={pending} className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60">
            <XCircle className="h-4 w-4" />Hủy và hoàn xu
          </button>
        </div>
      )}

      {order.status === 'APPROVED' && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => onRequestDeliver(order)} disabled={pending} className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
            <CheckCircle2 className="h-4 w-4" />{pending ? 'Đang xử lý…' : 'Xác nhận đã trao'}
          </button>
          <button type="button" onClick={() => onRequestCancel(order)} disabled={pending} className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60">
            <XCircle className="h-4 w-4" />Hủy và hoàn xu
          </button>
        </div>
      )}
    </article>
  );
};

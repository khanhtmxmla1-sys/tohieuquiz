import { History } from 'lucide-react';
import type { GiftShopEventLog } from '../../../types/giftShop.types';
import { EVENT_LABEL_MAP } from './giftShopConfig';

interface Props {
  events: GiftShopEventLog[];
}

const metadataSummary = (event: GiftShopEventLog) => {
  const amount = Number(event.metadata?.amount);
  if (Number.isFinite(amount) && amount > 0) return `${amount.toLocaleString('vi-VN')} xu`;
  const reason = String(event.metadata?.reason || '').trim();
  if (reason) return reason;
  return event.actor || event.orderId || '';
};

export const GiftShopAuditSection = ({ events }: Props) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
    <div className="flex items-center gap-2">
      <History className="h-5 w-5 text-slate-500" aria-hidden="true" />
      <div>
        <h3 className="text-lg font-bold text-slate-900">Nhật ký hoạt động</h3>
        <p className="text-sm text-slate-500">Tối đa 200 hoạt động gần nhất.</p>
      </div>
    </div>
    <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
          Chưa có hoạt động nào được ghi nhận.
        </div>
      ) : (
        events.map(event => {
          const summary = metadataSummary(event);
          return (
            <article key={event.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800">{EVENT_LABEL_MAP[event.type]}</p>
                <time className="shrink-0 text-xs text-slate-500" dateTime={event.createdAt}>
                  {new Date(event.createdAt).toLocaleString('vi-VN')}
                </time>
              </div>
              {summary && <p className="mt-1 text-xs text-slate-500">{summary}</p>}
            </article>
          );
        })
      )}
    </div>
  </section>
);

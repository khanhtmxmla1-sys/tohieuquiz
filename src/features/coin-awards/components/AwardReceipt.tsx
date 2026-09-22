import { useEffect, useMemo, useState } from 'react';
import type { CoinAwardReceipt } from '../../../../shared/coin-awards.contract';

interface AwardReceiptProps {
  receipt: CoinAwardReceipt;
  submitting: boolean;
  onReverse: (batchId: string, reason: string) => Promise<unknown>;
}

const remainingSeconds = (expiresAt: string | null, now: number): number => {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
};

export const AwardReceipt = ({ receipt, submitting, onReverse }: AwardReceiptProps) => {
  const [now, setNow] = useState(() => Date.now());
  const [reverseReason, setReverseReason] = useState('Trao nhầm xu');
  const seconds = useMemo(() => remainingSeconds(receipt.reversalExpiresAt, now), [now, receipt.reversalExpiresAt]);

  useEffect(() => {
    if (!receipt.reversalExpiresAt || seconds <= 0) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [receipt.reversalExpiresAt, seconds]);

  const minutes = Math.floor(seconds / 60);
  const shortSeconds = String(seconds % 60).padStart(2, '0');
  const isAward = receipt.kind === 'AWARD';
  const kindLabel = isAward ? 'Đã cộng' : receipt.kind === 'REVERSAL' ? 'Đã hoàn tác' : 'Đã điều chỉnh';
  const signedTotal = `${isAward ? '+' : '-'}${Math.abs(receipt.totalCoins)}`;
  const reversalEligible = isAward && !receipt.alreadyProcessed && seconds > 0;

  return (
    <section aria-labelledby="coin-award-receipt-title" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-6">
      <h2 id="coin-award-receipt-title" className="text-lg font-semibold text-emerald-950">{kindLabel} {signedTotal} xu</h2>
      <p className="mt-1 text-sm text-emerald-800">Batch {receipt.batchId} · {receipt.recipientCount} học sinh · {receipt.coinsPerStudent} xu/người</p>
      <p className="mt-3 text-sm text-emerald-900">Lý do: {receipt.reason}</p>
      <p className="mt-2 text-sm text-emerald-900">Người thực hiện: {receipt.actorDisplayName} ({receipt.actorUsername})</p>
      <p className="mt-1 text-xs text-emerald-800">Thời gian: {new Date(receipt.createdAt).toLocaleString('vi-VN')}</p>
      {reversalEligible && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium text-emerald-950">Lý do hoàn tác
            <input aria-label="Lý do hoàn tác" value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} className="mt-1 block min-h-10 rounded-xl border border-emerald-300 bg-white px-3 text-sm" />
          </label>
          <button type="button" onClick={() => void onReverse(receipt.batchId, reverseReason.trim())} disabled={submitting || !reverseReason.trim()} className="min-h-10 rounded-xl border border-emerald-700 px-4 text-sm font-semibold text-emerald-900 disabled:opacity-50">Hoàn tác ({minutes}:{shortSeconds})</button>
        </div>
      )}
      {receipt.alreadyProcessed && <p className="mt-3 text-sm text-emerald-800">Giao dịch này đã được xử lý trước đó.</p>}
    </section>
  );
};

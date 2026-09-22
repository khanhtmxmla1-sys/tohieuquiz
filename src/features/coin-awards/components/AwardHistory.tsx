import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { CoinAwardHistoryEntry } from '../../../../shared/coin-awards.contract';
import type { CoinAwardAdjustmentInput } from '../coinAwardsService';
import { useModalFocusTrap } from './useModalFocusTrap';

interface AwardHistoryProps {
  items: CoinAwardHistoryEntry[];
  loading: boolean;
  nextCursor: string | null;
  onLoadMore: () => Promise<void>;
  isAdmin: boolean;
  onAdjust: (parentBatchId: string, input: CoinAwardAdjustmentInput) => Promise<unknown>;
}

let adjustmentKeyCounter = 0;
const createAdjustmentKey = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `coin-adjust-${uuid}`;
  adjustmentKeyCounter += 1;
  return `coin-adjust-fallback-${adjustmentKeyCounter}`;
};

const parseIds = (value: string): string[] => Array.from(new Set(value.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean)));

export const AwardHistory = ({ items, loading, nextCursor, onLoadMore, isAdmin, onAdjust }: AwardHistoryProps) => {
  const [kindFilter, setKindFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [adjusting, setAdjusting] = useState<CoinAwardHistoryEntry | null>(null);
  const closeAdjustment = useCallback(() => {
    setAdjusting(null);
    return true;
  }, []);
  const adjustmentTriggerRef = useRef<HTMLButtonElement>(null);
  const wasAdjustingRef = useRef(false);

  useEffect(() => {
    if (adjusting) {
      wasAdjustingRef.current = true;
      return;
    }
    if (wasAdjustingRef.current && !loading) {
      adjustmentTriggerRef.current?.focus();
      wasAdjustingRef.current = false;
    }
  }, [adjusting, loading]);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('vi-VN');
  const visibleItems = useMemo(() => items.filter((item) => {
    if (kindFilter !== 'all' && item.kind !== kindFilter) return false;
    if (!normalizedQuery) return true;
    return [item.batchId, item.reason, item.className || '', item.actorDisplayName, item.actorUsername]
      .some((value) => value.toLocaleLowerCase('vi-VN').includes(normalizedQuery));
  }), [items, kindFilter, normalizedQuery]);

  return (
    <section aria-labelledby="coin-award-history-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="coin-award-history-title" className="text-lg font-semibold text-slate-900">Lịch sử thưởng xu</h2>
          <p className="mt-1 text-sm text-slate-500">Các batch do bạn tạo hoặc được quản trị viên điều chỉnh.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="text-sm font-medium text-slate-700">Tìm kiếm
            <input aria-label="Tìm lịch sử thưởng xu" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Batch, lý do, lớp…" className="ml-2 min-h-10 w-44 rounded-xl border border-slate-300 px-3 text-sm" />
          </label>
          <label className="text-sm font-medium text-slate-700">Loại giao dịch
          <select aria-label="Bộ lọc loại giao dịch" value={kindFilter} onChange={(event) => setKindFilter(event.target.value)} className="ml-2 min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm">
            <option value="all">Tất cả</option>
            <option value="AWARD">Cộng xu</option>
            <option value="REVERSAL">Hoàn tác</option>
            <option value="ADJUSTMENT">Điều chỉnh</option>
          </select>
          </label>
        </div>
      </div>

      {loading && <div role="status" className="mt-6 text-sm text-slate-500">Đang tải lịch sử…</div>}
      {!loading && visibleItems.length === 0 && <div role="status" className="mt-6 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">{items.length === 0 ? 'Chưa có giao dịch thưởng xu.' : 'Không tìm thấy giao dịch phù hợp.'}</div>}
      {!loading && visibleItems.length > 0 && (
        <div className="mt-5 divide-y divide-slate-100" role="list">
          {visibleItems.map((item) => (
            <article key={item.batchId} role="listitem" className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="font-semibold text-slate-900">{item.kind === 'AWARD' ? '+' : '-'}{Math.abs(item.totalCoins)} xu · {item.recipientCount} học sinh</p>
                <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
                <p className="mt-1 text-xs text-slate-500">{item.className || 'Toàn trường'} · {new Date(item.createdAt).toLocaleString('vi-VN')}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-500">{item.kind === 'AWARD' ? 'Đã cộng' : item.kind === 'REVERSAL' ? 'Đã hoàn tác' : 'Đã điều chỉnh'}</span>
                {isAdmin && item.kind === 'AWARD' && <button ref={adjustmentTriggerRef} type="button" aria-label={`Điều chỉnh batch ${item.batchId}`} onClick={(event) => { adjustmentTriggerRef.current = event.currentTarget; setAdjusting(item); }} className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700">Điều chỉnh</button>}
              </div>
            </article>
          ))}
        </div>
      )}
      {nextCursor && <button type="button" onClick={() => void onLoadMore()} disabled={loading} className="mt-4 min-h-10 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700">Xem thêm</button>}
      {adjusting && <AdjustmentDialog entry={adjusting} triggerRef={adjustmentTriggerRef} onClose={closeAdjustment} onAdjust={onAdjust} />}
    </section>
  );
};

interface AdjustmentDialogProps {
  entry: CoinAwardHistoryEntry;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onAdjust: (parentBatchId: string, input: CoinAwardAdjustmentInput) => Promise<unknown>;
}

const AdjustmentDialog = ({ entry, triggerRef, onClose, onAdjust }: AdjustmentDialogProps) => {
  const [studentIdsText, setStudentIdsText] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey] = useState(createAdjustmentKey);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  const closeDialog = useCallback(() => {
    if (submittingRef.current) return false;
    onClose();
    return true;
  }, [onClose]);
  const { closeDialog: closeModal, handleKeyDown } = useModalFocusTrap({
    open: true,
    dialogRef,
    initialFocusRef: closeRef,
    triggerRef,
    onEscape: closeDialog,
  });

  const submit = async () => {
    const trimmedReason = reason.trim();
    const studentIds = parseIds(studentIdsText);
    if (studentIds.length === 0) {
      setError('Vui lòng nhập ít nhất một mã học sinh.');
      return;
    }
    if (trimmedReason.length < 3 || trimmedReason.length > 200) {
      setError('Lý do điều chỉnh phải dài từ 3 đến 200 ký tự.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await onAdjust(entry.batchId, { studentIds, reason: trimmedReason, idempotencyKey });
    setSubmitting(false);
    if (result) {
      submittingRef.current = false;
      closeModal();
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" role="presentation" onMouseDown={(event) => { if (!submitting && event.currentTarget === event.target) closeModal(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-busy={submitting} aria-labelledby="coin-adjustment-title" onKeyDown={handleKeyDown} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 id="coin-adjustment-title" className="text-lg font-semibold text-slate-900">Điều chỉnh batch {entry.batchId}</h3>
        <p className="mt-1 text-sm text-slate-600">Điều chỉnh xu cho các học sinh thuộc batch gốc này.</p>
        <label className="mt-4 block text-sm font-medium text-slate-700">Mã học sinh điều chỉnh<textarea aria-label="Mã học sinh điều chỉnh" value={studentIdsText} onChange={(event) => setStudentIdsText(event.target.value)} rows={2} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
        <label className="mt-4 block text-sm font-medium text-slate-700">Lý do điều chỉnh<textarea aria-label="Lý do điều chỉnh" maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
        {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button ref={closeRef} type="button" aria-label="Đóng" onClick={closeModal} disabled={submitting} className="min-h-10 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Đóng</button>
          <button type="button" onClick={() => void submit()} disabled={submitting} className="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{submitting ? 'Đang điều chỉnh…' : 'Xác nhận điều chỉnh'}</button>
        </div>
      </div>
    </div>
  );
};

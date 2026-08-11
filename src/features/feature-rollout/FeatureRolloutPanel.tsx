import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import type {
  FeatureAudience,
  FeatureFlagConfig,
  FeatureRolloutStopConditions,
} from '../../../shared/feature-rollout.contract';
import {
  listFeatureFlags,
  patchRuntimeFeatureFlagBatch,
  rollbackRuntimeFeatureFlag,
} from '../../services/featureRolloutService';
import { showError, showSuccess } from '../../utils/toast';
import { formatSystemDateTime } from '../../utils/dateTime';
import {
  FEATURE_AUDIENCE_LABELS,
  formatFeatureRolloutState,
  getFeatureFlagPresentation,
} from './featureFlagPresentation';
import {
  countFeatureRolloutImpactGroups,
  featureFlagToDraft,
  getFeatureRolloutChanges,
  type FeatureRolloutDraft,
  validateFeatureRolloutDraft,
} from './featureRolloutDraft';
import { FeatureRolloutRollbackDialog } from './FeatureRolloutRollbackDialog';

const AUDIENCES: FeatureAudience[] = ['all', 'admin', 'teacher', 'student', 'parent'];
const QUICK_PERCENTAGES = [10, 50, 100] as const;

const splitLines = (value: string): string[] => value
  .split(/\r?\n/)
  .map((item) => item.trim())
  .filter(Boolean);

const numberOrUndefined = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const updateStopCondition = (
  current: FeatureRolloutStopConditions,
  field: keyof FeatureRolloutStopConditions,
  value: string,
): FeatureRolloutStopConditions => {
  const next = { ...current };
  const parsed = numberOrUndefined(value);
  if (parsed === undefined) delete next[field];
  else next[field] = parsed;
  return next;
};

const isVersionConflict = (error: unknown): boolean => (
  (typeof error === 'object' && error !== null && 'status' in error && (error as { status?: number }).status === 409)
  || (error instanceof Error && /FEATURE_FLAG_VERSION_CONFLICT|version conflict|xung đột/i.test(error.message))
);

const FeatureRolloutSkeleton = () => (
  <div role="status" aria-label="Đang tải cấu hình tính năng" className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
    <span className="sr-only">Đang tải cấu hình tính năng</span>
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      {[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}
    </div>
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="h-7 w-1/3 animate-pulse rounded bg-slate-100" />
      <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
    </div>
  </div>
);

export function FeatureRolloutPanel() {
  const [flags, setFlags] = useState<FeatureFlagConfig[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [draft, setDraft] = useState<FeatureRolloutDraft | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);

  const selected = useMemo(
    () => flags.find((flag) => flag.key === selectedKey) || null,
    [flags, selectedKey],
  );

  const load = async (preferredKey?: string) => {
    setLoading(true);
    setError('');
    try {
      const rows = await listFeatureFlags();
      setFlags(rows);
      const next = rows.find((flag) => flag.key === preferredKey)
        || rows.find((flag) => flag.key === selectedKey)
        || rows[0]
        || null;
      setSelectedKey(next?.key || '');
      setDraft(next ? featureFlagToDraft(next) : null);
      return rows;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải cấu hình tính năng.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const chooseFlag = (flag: FeatureFlagConfig) => {
    setSelectedKey(flag.key);
    setDraft(featureFlagToDraft(flag));
    setReason('');
    setAdvancedOpen(false);
    setRollbackOpen(false);
  };

  const changes = useMemo(
    () => selected && draft ? getFeatureRolloutChanges(selected, draft) : [],
    [selected, draft],
  );
  const validationError = draft ? validateFeatureRolloutDraft(draft) : null;
  const impactGroupCount = countFeatureRolloutImpactGroups(changes);

  const updateDraft = (patch: Partial<FeatureRolloutDraft>) => {
    if (!draft) return;
    setDraft({ ...draft, ...patch });
  };

  const setQuickPercentage = (percentage: number) => {
    if (!draft) return;
    setDraft({ ...draft, enabled: true, percentage });
  };

  const apply = async () => {
    if (!selected || !draft || changes.length === 0 || validationError) return;
    const cleanReason = reason.trim();
    if (!cleanReason) {
      showError('Hãy nhập lý do thay đổi.');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await patchRuntimeFeatureFlagBatch(selected.key, {
        changes,
        reason: cleanReason,
        expectedVersion: selected.version,
      });
      setFlags((current) => current.map((flag) => flag.key === updated.key ? updated : flag));
      setSelectedKey(updated.key);
      setDraft(featureFlagToDraft(updated));
      setReason('');
      showSuccess('Đã áp dụng cấu hình phát hành.');
    } catch (applyError) {
      if (isVersionConflict(applyError)) {
        showError('Cấu hình vừa được cập nhật ở nơi khác. Đã tải lại phiên bản mới nhất.');
        await load(selected.key);
      } else {
        showError(applyError instanceof Error ? applyError.message : 'Không thể áp dụng cấu hình.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const requestRollback = () => {
    if (!selected) return;
    if (!reason.trim()) {
      showError('Hãy nhập lý do hoàn tác.');
      return;
    }
    setRollbackOpen(true);
  };

  const confirmRollback = async () => {
    if (!selected) return;
    const cleanReason = reason.trim();
    setSubmitting(true);
    try {
      const updated = await rollbackRuntimeFeatureFlag(selected.key, cleanReason);
      setFlags((current) => current.map((flag) => flag.key === updated.key ? updated : flag));
      setSelectedKey(updated.key);
      setDraft(featureFlagToDraft(updated));
      setReason('');
      setRollbackOpen(false);
      showSuccess('Đã hoàn tác thay đổi gần nhất.');
    } catch (rollbackError) {
      showError(rollbackError instanceof Error ? rollbackError.message : 'Không thể hoàn tác cấu hình.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && flags.length === 0) return <FeatureRolloutSkeleton />;

  if (error && flags.length === 0) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        <div className="flex items-start gap-3">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-bold">Không thể tải cấu hình phát hành</p>
            <p className="mt-1">{error}</p>
            <button type="button" onClick={() => void load(selectedKey)} className="mt-4 min-h-11 rounded-xl border border-red-200 bg-white px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">Thử lại</button>
          </div>
        </div>
      </div>
    );
  }

  if (!selected || !draft) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Chưa có feature flag nào để quản lý.</div>;
  }

  const selectedPresentation = getFeatureFlagPresentation(selected);
  const draftState = formatFeatureRolloutState(draft);
  const currentState = formatFeatureRolloutState(selected);

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="self-start rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-20">
        <div className="mb-2 flex items-center justify-between gap-2 px-2">
          <div>
            <p className="font-bold text-slate-900">Danh sách tính năng</p>
            <p className="text-xs text-slate-500">{flags.length} cấu hình runtime</p>
          </div>
          <button type="button" aria-label="Làm mới" disabled={loading} onClick={() => void load(selectedKey)} className="inline-flex size-11 items-center justify-center rounded-xl border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50">
            <RefreshCw aria-hidden="true" className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-2">
          {flags.map((flag) => {
            const presentation = getFeatureFlagPresentation(flag);
            const active = flag.key === selected.key;
            return (
              <button
                key={flag.key}
                type="button"
                aria-pressed={active}
                aria-label={presentation.displayName}
                onClick={() => chooseFlag(flag)}
                className={`w-full rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${active ? 'border-blue-200 bg-blue-50' : 'border-transparent hover:border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}><FlaskConical aria-hidden="true" className="size-4" /></span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-slate-900">{presentation.displayName}</span>
                    <code className="mt-1 block truncate text-[11px] text-slate-600">{flag.key}</code>
                    <span className="mt-2 block text-xs text-slate-600">{formatFeatureRolloutState(flag)}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="min-w-0 space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><FlaskConical aria-hidden="true" className="size-5" /></span>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedPresentation.displayName}</h3>
                  <code className="text-xs text-slate-500">{selected.key}</code>
                </div>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{selectedPresentation.summary}</p>
            </div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${selected.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{formatFeatureRolloutState(selected)}</span>
          </div>

          <dl className="mt-5 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3">
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phiên bản</dt><dd className="mt-1 font-bold text-slate-900">v{selected.version}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chủ sở hữu</dt><dd className="mt-1 font-semibold text-slate-900">{selected.owner || 'Chưa chỉ định'}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cập nhật gần nhất</dt><dd className="mt-1 font-semibold text-slate-900">{formatSystemDateTime(selected.updatedAt)}</dd></div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h4 className="text-lg font-bold text-slate-900">Phạm vi thử nghiệm</h4>
            <p className="mt-1 text-sm text-slate-600">Chọn đối tượng rồi dùng mức nhanh để tạo cấu hình dự kiến. Chưa có thay đổi nào được gửi lên server cho tới khi bạn bấm “Áp dụng thay đổi”.</p>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <label className="text-sm font-semibold text-slate-900">
              Đối tượng thử nghiệm
              <select aria-label="Đối tượng thử nghiệm" value={draft.audience} onChange={(event) => updateDraft({ audience: event.target.value as FeatureAudience })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                {AUDIENCES.map((audience) => <option key={audience} value={audience}>{FEATURE_AUDIENCE_LABELS[audience]}</option>)}
              </select>
            </label>

            <div>
              <span className="text-sm font-semibold text-slate-900">Mức phát hành nhanh</span>
              <div className="mt-1 grid grid-cols-4 gap-2" role="group" aria-label="Mức phát hành nhanh">
                <button type="button" aria-pressed={!draft.enabled} onClick={() => updateDraft({ enabled: false })} className="min-h-11 rounded-xl border px-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 aria-pressed:border-slate-500 aria-pressed:bg-slate-100">Tắt</button>
                {QUICK_PERCENTAGES.map((percentage) => (
                  <button key={percentage} type="button" aria-pressed={draft.enabled && draft.percentage === percentage} onClick={() => setQuickPercentage(percentage)} className="min-h-11 rounded-xl border px-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 aria-pressed:border-blue-300 aria-pressed:bg-blue-50 aria-pressed:text-blue-700">{percentage}%</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <button type="button" aria-label="Tùy chỉnh nâng cao" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)} className="flex min-h-12 w-full items-center justify-between gap-3 px-5 text-left font-bold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <span>Tùy chỉnh nâng cao</span>
            {advancedOpen ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
          </button>

          {advancedOpen && (
            <div className="space-y-5 border-t border-slate-200 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold">Người dùng ưu tiên
                  <textarea aria-label="Người dùng ưu tiên" value={draft.allowUsers.join('\n')} onChange={(event) => updateDraft({ allowUsers: splitLines(event.target.value) })} placeholder="Mỗi username một dòng" className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 p-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" />
                </label>
                <label className="text-sm font-semibold">Lớp ưu tiên
                  <textarea aria-label="Lớp ưu tiên" value={draft.allowClasses.join('\n')} onChange={(event) => updateDraft({ allowClasses: splitLines(event.target.value) })} placeholder="Mỗi class ID một dòng" className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 p-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold">Bắt đầu thử nghiệm
                  <input type="datetime-local" aria-label="Bắt đầu thử nghiệm" value={draft.startsAt} onChange={(event) => updateDraft({ startsAt: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" />
                  <span className="mt-1 block text-xs font-normal text-slate-500">Giờ Hà Nội (GMT+7)</span>
                </label>
                <label className="text-sm font-semibold">Kết thúc thử nghiệm
                  <input type="datetime-local" aria-label="Kết thúc thử nghiệm" value={draft.endsAt} onChange={(event) => updateDraft({ endsAt: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" />
                  <span className="mt-1 block text-xs font-normal text-slate-500">Giờ Hà Nội (GMT+7)</span>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold">Chủ sở hữu
                  <input aria-label="Chủ sở hữu" value={draft.owner} onChange={(event) => updateDraft({ owner: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" />
                </label>
                <label className="text-sm font-semibold">Mô tả
                  <input aria-label="Mô tả" value={draft.description} onChange={(event) => updateDraft({ description: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" />
                </label>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-800" />
                  <div>
                    <h5 className="font-bold text-amber-950">Ngưỡng cần theo dõi</h5>
                    <p className="mt-1 text-xs leading-5 text-amber-900">Các số này là tiêu chí để quản trị viên theo dõi và quyết định dừng rollout. Không tự động tắt tính năng khi vượt ngưỡng.</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-amber-950">Tỷ lệ lỗi 5xx tối đa (%)
                    <input type="number" min="0" max="100" step="0.1" aria-label="Tỷ lệ lỗi 5xx tối đa (%)" value={draft.stopConditions.max5xxRatePercent ?? ''} onChange={(event) => updateDraft({ stopConditions: updateStopCondition(draft.stopConditions, 'max5xxRatePercent', event.target.value) })} className="mt-1 h-11 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600" />
                  </label>
                  <label className="text-xs font-semibold text-amber-950">Hệ số lỗi client tối đa
                    <input type="number" min="1" step="0.1" aria-label="Hệ số lỗi client tối đa" value={draft.stopConditions.maxClientErrorMultiplier ?? ''} onChange={(event) => updateDraft({ stopConditions: updateStopCondition(draft.stopConditions, 'maxClientErrorMultiplier', event.target.value) })} className="mt-1 h-11 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600" />
                  </label>
                  <label className="text-xs font-semibold text-amber-950">Mức tăng p95 tối đa (%)
                    <input type="number" min="0" step="1" aria-label="Mức tăng p95 tối đa (%)" value={draft.stopConditions.maxP95IncreasePercent ?? ''} onChange={(event) => updateDraft({ stopConditions: updateStopCondition(draft.stopConditions, 'maxP95IncreasePercent', event.target.value) })} className="mt-1 h-11 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600" />
                  </label>
                  <label className="text-xs font-semibold text-amber-950">Số ticket hỗ trợ tối đa
                    <input type="number" min="0" step="1" aria-label="Số ticket hỗ trợ tối đa" value={draft.stopConditions.maxSupportTickets ?? ''} onChange={(event) => updateDraft({ stopConditions: updateStopCondition(draft.stopConditions, 'maxSupportTickets', event.target.value) })} className="mt-1 h-11 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600" />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="text-lg font-bold text-slate-900">Kiểm tra thay đổi</h4>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Trước khi áp dụng</p>
              <p className="mt-2 font-bold text-slate-900">{currentState}</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Sau khi áp dụng</p>
              <p className="mt-2 font-bold text-slate-900">{draftState}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">{impactGroupCount} nhóm cấu hình sẽ thay đổi · {changes.length} trường thay đổi.</p>
          {validationError && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{validationError}</p>}

          <label className="mt-4 block text-sm font-semibold text-slate-900">Lý do thay đổi
            <textarea aria-label="Lý do thay đổi" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={draft.enabled ? `Ví dụ: Mở thử ${draft.percentage}% cho ${FEATURE_AUDIENCE_LABELS[draft.audience].toLowerCase()}` : 'Ví dụ: Tạm dừng rollout để kiểm tra lỗi'} className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" />
          </label>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" disabled={submitting} onClick={requestRollback} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-200 px-4 font-semibold text-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 disabled:opacity-50">
              <RotateCcw aria-hidden="true" className="size-4" />Hoàn tác thay đổi gần nhất
            </button>
            <button type="button" disabled={submitting || changes.length === 0 || Boolean(validationError)} onClick={() => void apply()} className="min-h-11 rounded-xl bg-blue-600 px-5 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? 'Đang áp dụng…' : 'Áp dụng thay đổi'}
            </button>
          </div>
        </div>
      </section>

      <FeatureRolloutRollbackDialog
        flag={selected}
        open={rollbackOpen}
        submitting={submitting}
        onCancel={() => setRollbackOpen(false)}
        onConfirm={() => void confirmRollback()}
      />
    </div>
  );
}

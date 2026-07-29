import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
import type {
  FeatureFlagConfig,
  FeatureFlagPatchField,
} from '../../../shared/feature-rollout.contract';
import {
  listFeatureFlags,
  patchRuntimeFeatureFlag,
  rollbackRuntimeFeatureFlag,
} from '../../services/featureRolloutService';
import { showError, showSuccess } from '../../utils/toast';

const fields: Array<{ value: FeatureFlagPatchField; label: string }> = [
  { value: 'enabled', label: 'Trạng thái toàn cục' },
  { value: 'audience', label: 'Đối tượng' },
  { value: 'percentage', label: 'Phần trăm rollout' },
  { value: 'allowUsers', label: 'Danh sách tài khoản' },
  { value: 'allowClasses', label: 'Danh sách lớp' },
  { value: 'startsAt', label: 'Bắt đầu' },
  { value: 'endsAt', label: 'Kết thúc' },
  { value: 'owner', label: 'Owner' },
  { value: 'description', label: 'Mô tả' },
  { value: 'stopConditions', label: 'Điều kiện dừng' },
];

const valueForField = (flag: FeatureFlagConfig, field: FeatureFlagPatchField): string => {
  const value = flag[field];
  if (field === 'allowUsers' || field === 'allowClasses') return (value as string[]).join('\n');
  if (field === 'stopConditions') return JSON.stringify(value, null, 2);
  if (field === 'startsAt' || field === 'endsAt') return value ? String(value).slice(0, 16) : '';
  return String(value ?? '');
};

const parsedValue = (field: FeatureFlagPatchField, value: string): unknown => {
  if (field === 'enabled') return value === 'true';
  if (field === 'percentage') return Number(value);
  if (field === 'allowUsers' || field === 'allowClasses') {
    return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  }
  if (field === 'startsAt' || field === 'endsAt') return value ? new Date(value).toISOString() : null;
  if (field === 'stopConditions') return JSON.parse(value || '{}');
  return value;
};

export const FeatureRolloutPanel: React.FC = () => {
  const [flags, setFlags] = useState<FeatureFlagConfig[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [field, setField] = useState<FeatureFlagPatchField>('percentage');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selected = useMemo(
    () => flags.find((flag) => flag.key === selectedKey) || flags[0] || null,
    [flags, selectedKey],
  );

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listFeatureFlags();
      setFlags(data);
      setSelectedKey((current) => current && data.some((flag) => flag.key === current) ? current : data[0]?.key || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải feature flags.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (selected) setValue(valueForField(selected, field));
  }, [selected?.key, selected?.version, field]);

  const replaceFlag = (updated: FeatureFlagConfig) => {
    setFlags((current) => current.map((flag) => flag.key === updated.key ? updated : flag));
  };

  const save = async () => {
    if (!selected || !reason.trim()) return showError('Hãy nhập lý do thay đổi.');
    setSaving(true);
    try {
      const updated = await patchRuntimeFeatureFlag(selected.key, {
        field,
        value: parsedValue(field, value),
        reason: reason.trim(),
      });
      replaceFlag(updated);
      setReason('');
      showSuccess('Đã cập nhật một trường rollout.');
    } catch (saveError) {
      showError(saveError instanceof Error ? saveError.message : 'Không thể cập nhật rollout.');
    } finally {
      setSaving(false);
    }
  };

  const rollback = async () => {
    if (!selected || !reason.trim()) return showError('Hãy nhập lý do rollback.');
    setSaving(true);
    try {
      const updated = await rollbackRuntimeFeatureFlag(selected.key, reason.trim());
      replaceFlag(updated);
      setReason('');
      showSuccess('Đã rollback thay đổi gần nhất mà không cần deploy.');
    } catch (rollbackError) {
      showError(rollbackError instanceof Error ? rollbackError.message : 'Không thể rollback rollout.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error} <button type="button" onClick={() => void load()} className="font-bold underline">Thử lại</button></div>;
  if (!selected) return <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Chưa có feature flag runtime.</div>;

  const summary = `${selected.key}: ${selected.enabled ? 'bật' : 'tắt'}, ${selected.audience}, ${selected.percentage}%`;
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm" aria-labelledby="feature-rollout-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="feature-rollout-title" className="flex items-center gap-2 font-bold text-slate-900"><SlidersHorizontal className="h-5 w-5 text-blue-600" />Feature rollout</h3>
          <p className="mt-1 text-sm text-slate-600">Thay đổi từng trường, có audit và rollback runtime; không ghi đè nhiều flag trong một request.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 font-semibold"><RefreshCw className="h-4 w-4" />Làm mới</button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="space-y-2" role="list" aria-label="Feature flags">
          {flags.map((flag) => (
            <button key={flag.key} type="button" onClick={() => setSelectedKey(flag.key)} className={`w-full rounded-xl border p-3 text-left ${selected.key === flag.key ? 'border-blue-300 bg-blue-50' : 'bg-white'}`}>
              <span className="block font-semibold text-slate-900">{flag.key}</span>
              <span className="mt-1 block text-xs text-slate-500">{flag.enabled ? 'Bật' : 'Tắt'} · {flag.audience} · {flag.percentage}%</span>
            </button>
          ))}
        </div>

        <div className="space-y-4 rounded-xl border p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div><div className="text-xs font-bold uppercase text-slate-400">Owner</div><div className="font-semibold">{selected.owner || 'Chưa gán'}</div></div>
            <div><div className="text-xs font-bold uppercase text-slate-400">Phiên bản</div><div className="font-semibold">v{selected.version}</div></div>
            <div><div className="text-xs font-bold uppercase text-slate-400">Cập nhật</div><div className="font-semibold">{selected.updatedBy || 'migration'}</div></div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-sm"><strong>Preview cohort:</strong> {summary}. Allowlist: {selected.allowUsers.length} tài khoản, {selected.allowClasses.length} lớp.</div>
          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><strong>Điều kiện dừng:</strong> 5xx {selected.stopConditions.max5xxRatePercent ?? '—'}%; client errors ×{selected.stopConditions.maxClientErrorMultiplier ?? '—'}; p95 +{selected.stopConditions.maxP95IncreasePercent ?? '—'}%; support {selected.stopConditions.maxSupportTickets ?? '—'}.</div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Trường thay đổi
              <select value={field} onChange={(event) => setField(event.target.value as FeatureFlagPatchField)} className="mt-1 min-h-11 w-full rounded-xl border px-3">
                {fields.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            {field === 'enabled' ? (
              <label className="text-sm font-semibold">Giá trị
                <select data-testid="rollout-value" value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3"><option value="true">Bật</option><option value="false">Tắt</option></select>
              </label>
            ) : field === 'audience' ? (
              <label className="text-sm font-semibold">Giá trị
                <select data-testid="rollout-value" value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3">{['all', 'admin', 'teacher', 'student', 'parent'].map((item) => <option key={item}>{item}</option>)}</select>
              </label>
            ) : (
              <label className="text-sm font-semibold">Giá trị
                {['allowUsers', 'allowClasses', 'stopConditions', 'description'].includes(field)
                  ? <textarea data-testid="rollout-value" value={value} onChange={(event) => setValue(event.target.value)} rows={4} className="mt-1 w-full rounded-xl border p-3 font-mono text-sm" />
                  : <input data-testid="rollout-value" type={field === 'percentage' ? 'number' : field === 'startsAt' || field === 'endsAt' ? 'datetime-local' : 'text'} value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3" />}
              </label>
            )}
          </div>
          <label className="block text-sm font-semibold">Lý do bắt buộc
            <input data-testid="rollout-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Pilot lớp 4A trong 48 giờ" className="mt-1 min-h-11 w-full rounded-xl border px-3" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button data-testid="rollout-save" type="button" onClick={() => void save()} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />Lưu một trường</button>
            <button data-testid="rollout-rollback" type="button" onClick={() => void rollback()} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300 px-4 font-bold text-amber-800 disabled:opacity-50"><RotateCcw className="h-4 w-4" />Rollback gần nhất</button>
          </div>
        </div>
      </div>
    </section>
  );
};

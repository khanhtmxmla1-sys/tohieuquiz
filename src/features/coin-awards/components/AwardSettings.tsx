import { useEffect, useState } from 'react';
import type { CoinAwardSettings } from '../../../../shared/coin-awards.contract';
import type { CoinAwardSettingsUpdateInput } from '../coinAwardsService';

interface AwardSettingsProps {
  settings: CoinAwardSettings | null;
  loading: boolean;
  submitting: boolean;
  onSubmit: (input: CoinAwardSettingsUpdateInput) => Promise<unknown>;
}

export const AwardSettings = ({ settings, loading, submitting, onSubmit }: AwardSettingsProps) => {
  const [maxCoinsPerStudent, setMaxCoinsPerStudent] = useState(100);
  const [maxTeacherDailyCoins, setMaxTeacherDailyCoins] = useState(2000);
  const [reversalWindowMinutes, setReversalWindowMinutes] = useState(15);
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setMaxCoinsPerStudent(settings.maxCoinsPerStudent);
    setMaxTeacherDailyCoins(settings.maxTeacherDailyCoins);
    setReversalWindowMinutes(settings.reversalWindowMinutes);
  }, [settings]);

  if (loading) return <div role="status" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Đang tải thiết lập…</div>;

  return (
    <section aria-labelledby="coin-award-settings-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 id="coin-award-settings-title" className="text-lg font-semibold text-slate-900">Thiết lập thưởng xu</h2>
      <p className="mt-1 text-sm text-slate-500">Chỉ quản trị viên có thể thay đổi giới hạn áp dụng cho giáo viên.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">Tối đa mỗi học sinh<input aria-label="Tối đa mỗi học sinh" type="number" min="1" value={maxCoinsPerStudent} onChange={(event) => setMaxCoinsPerStudent(Number(event.target.value))} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
        <label className="text-sm font-medium text-slate-700">Tối đa mỗi ngày<input aria-label="Tối đa mỗi ngày" type="number" min="1" value={maxTeacherDailyCoins} onChange={(event) => setMaxTeacherDailyCoins(Number(event.target.value))} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
        <label className="text-sm font-medium text-slate-700">Thời gian hoàn tác (phút)<input aria-label="Thời gian hoàn tác (phút)" type="number" min="0" value={reversalWindowMinutes} onChange={(event) => setReversalWindowMinutes(Number(event.target.value))} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
      </div>
      <label className="mt-4 block text-sm font-medium text-slate-700">Lý do thay đổi<textarea aria-label="Lý do thay đổi" maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
      <span className="mt-1 block text-xs text-slate-500">Bắt buộc 3–200 ký tự.</span>
      {validationError && <p role="alert" className="mt-2 text-sm text-rose-700">{validationError}</p>}
      <button type="button" onClick={() => { if (reason.trim().length < 3 || reason.trim().length > 200) { setValidationError('Lý do thay đổi phải dài từ 3 đến 200 ký tự.'); return; } setValidationError(null); void onSubmit({ maxCoinsPerStudent, maxTeacherDailyCoins, reversalWindowMinutes, expectedUpdatedAt: settings?.updatedAt || '', reason: reason.trim() }); }} disabled={submitting || reason.trim().length < 3} className="mt-5 min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">Lưu thiết lập</button>
    </section>
  );
};

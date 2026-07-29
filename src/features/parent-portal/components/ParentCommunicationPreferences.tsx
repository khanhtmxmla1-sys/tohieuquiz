import React, { useEffect, useState } from 'react';
import { BellRing, MailCheck, MoonStar, Save } from 'lucide-react';
import type { ParentContactPreferencesInput, ParentNotificationKind } from '../../../../shared/parent-portal.contract';
import { useParentPortalStore } from '../useParentPortalStore';

const kindOptions: Array<{ kind: ParentNotificationKind; label: string }> = [
  { kind: 'quiz_result', label: 'Kết quả bài kiểm tra' },
  { kind: 'result_report', label: 'Phiếu nhận xét kết quả' },
  { kind: 'homework_assigned', label: 'Bài tập mới' },
  { kind: 'homework_due', label: 'Nhắc hạn bài tập' },
  { kind: 'homework_graded', label: 'Bài tập đã chấm' },
  { kind: 'class_announcement', label: 'Thông báo lớp' },
  { kind: 'certificate_issued', label: 'Chứng nhận mới' },
];

const defaultDraft: ParentContactPreferencesInput = {
  email: null,
  weeklyDigestEnabled: false,
  digestWeekday: 1,
  digestHour: 19,
  quietHoursEnabled: true,
  quietHoursStart: '21:00',
  quietHoursEnd: '07:00',
  emailKinds: kindOptions.map(item => item.kind),
};

const weekdayOptions = [
  [1, 'Thứ Hai'], [2, 'Thứ Ba'], [3, 'Thứ Tư'], [4, 'Thứ Năm'],
  [5, 'Thứ Sáu'], [6, 'Thứ Bảy'], [7, 'Chủ nhật'],
] as const;

export default function ParentCommunicationPreferences() {
  const preferences = useParentPortalStore(state => state.preferences);
  const loadPreferences = useParentPortalStore(state => state.loadPreferences);
  const savePreferences = useParentPortalStore(state => state.savePreferences);
  const requestEmailVerification = useParentPortalStore(state => state.requestEmailVerification);
  const isLoading = useParentPortalStore(state => state.isLoading);
  const error = useParentPortalStore(state => state.error);
  const [draft, setDraft] = useState<ParentContactPreferencesInput>(defaultDraft);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { void loadPreferences(); }, [loadPreferences]);
  useEffect(() => {
    if (!preferences) return;
    setDraft({
      email: preferences.email,
      weeklyDigestEnabled: preferences.weeklyDigestEnabled,
      digestWeekday: preferences.digestWeekday,
      digestHour: preferences.digestHour,
      quietHoursEnabled: preferences.quietHoursEnabled,
      quietHoursStart: preferences.quietHoursStart,
      quietHoursEnd: preferences.quietHoursEnd,
      emailKinds: preferences.emailKinds,
    });
  }, [preferences]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (await savePreferences(draft)) setMessage('Đã lưu cài đặt liên lạc.');
  };

  const verify = async () => {
    setMessage(null);
    if (await requestEmailVerification()) {
      setMessage('Đã gửi liên kết xác minh. Vui lòng kiểm tra hộp thư trong 24 giờ.');
    }
  };

  const toggleKind = (kind: ParentNotificationKind) => {
    setDraft(current => ({
      ...current,
      emailKinds: current.emailKinds.includes(kind)
        ? current.emailKinds.filter(item => item !== kind)
        : [...current.emailKinds, kind],
    }));
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><BellRing className="h-5 w-5" /></div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Email và bản tin tuần</h2>
          <p className="mt-1 text-sm text-slate-500">Chỉ gửi số liệu tổng hợp, nội dung cần hỗ trợ và gợi ý tại nhà. Không gửi đáp án hoặc dữ liệu chi tiết.</p>
        </div>
      </div>

      <form className="mt-6 space-y-6" onSubmit={save}>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block text-sm font-semibold text-slate-700">
            Email phụ huynh
            <input
              value={draft.email || ''}
              onChange={event => setDraft(current => ({ ...current, email: event.target.value || null }))}
              type="email"
              autoComplete="email"
              maxLength={254}
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="phuhuynh@example.com"
            />
          </label>
          <button
            type="button"
            onClick={verify}
            disabled={isLoading || !draft.email || !preferences?.emailRolloutReady}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 font-semibold text-indigo-700 disabled:opacity-50"
          >
            <MailCheck className="h-4 w-4" /> Gửi xác minh
          </button>
        </div>
        <p className={`text-sm font-medium ${preferences?.emailVerifiedAt ? 'text-emerald-700' : 'text-amber-700'}`}>
          {preferences?.emailVerifiedAt ? 'Email đã được xác minh.' : 'Email chưa được xác minh.'}
        </p>
        {!preferences?.emailRolloutReady && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Tính năng gửi email chưa mở vì cấu hình SPF, DKIM và DMARC chưa hoàn tất.</p>
        )}

        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
          <input
            type="checkbox"
            checked={draft.weeklyDigestEnabled}
            disabled={!preferences?.emailRolloutReady}
            onChange={event => setDraft(current => ({ ...current, weeklyDigestEnabled: event.target.checked }))}
            className="mt-1 h-5 w-5 rounded border-slate-300 text-indigo-600"
          />
          <span><span className="block font-semibold text-slate-800">Nhận bản tin học tập hằng tuần</span><span className="mt-1 block text-sm text-slate-500">Có thể tắt bất cứ lúc nào.</span></span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">Ngày gửi
            <select value={draft.digestWeekday} onChange={event => setDraft(current => ({ ...current, digestWeekday: Number(event.target.value) as ParentContactPreferencesInput['digestWeekday'] }))} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4">
              {weekdayOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">Giờ gửi
            <select value={draft.digestHour} onChange={event => setDraft(current => ({ ...current, digestHour: Number(event.target.value) }))} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4">
              {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}
            </select>
          </label>
        </div>

        <fieldset>
          <legend className="font-semibold text-slate-800">Loại thông báo qua email</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {kindOptions.map(option => (
              <label key={option.kind} className="flex min-h-11 items-center gap-3 rounded-xl bg-slate-50 px-3 text-sm text-slate-700">
                <input type="checkbox" checked={draft.emailKinds.includes(option.kind)} onChange={() => toggleKind(option.kind)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="rounded-2xl border border-slate-200 p-4">
          <label className="flex items-center gap-3 font-semibold text-slate-800">
            <input type="checkbox" checked={draft.quietHoursEnabled} onChange={event => setDraft(current => ({ ...current, quietHoursEnabled: event.target.checked }))} className="h-5 w-5 rounded border-slate-300 text-indigo-600" />
            <MoonStar className="h-5 w-5 text-indigo-600" /> Khung giờ yên lặng
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">Bắt đầu
              <input type="time" value={draft.quietHoursStart} onChange={event => setDraft(current => ({ ...current, quietHoursStart: event.target.value }))} disabled={!draft.quietHoursEnabled} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 disabled:bg-slate-100" />
            </label>
            <label className="text-sm font-semibold text-slate-700">Kết thúc
              <input type="time" value={draft.quietHoursEnd} onChange={event => setDraft(current => ({ ...current, quietHoursEnd: event.target.value }))} disabled={!draft.quietHoursEnabled} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 disabled:bg-slate-100" />
            </label>
          </div>
        </div>

        {message && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={isLoading} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 font-bold text-white disabled:opacity-50 sm:w-auto">
          <Save className="h-4 w-4" /> {isLoading ? 'Đang lưu…' : 'Lưu cài đặt'}
        </button>
      </form>
    </section>
  );
}

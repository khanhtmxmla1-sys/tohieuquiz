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

const controlClassName = 'mt-2 min-h-12 w-full rounded-[13px] border border-[#dbe4f0] bg-[#f8fafc] px-4 text-base text-[#1e293b] outline-none transition-[border-color,box-shadow,background-color] focus:border-[#2563eb] focus:bg-white focus:ring-4 focus:ring-[#2563eb]/10 disabled:cursor-not-allowed disabled:bg-[#f1f5f9] disabled:opacity-60';

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
    if (await requestEmailVerification()) setMessage('Đã gửi liên kết xác minh. Vui lòng kiểm tra hộp thư trong 24 giờ.');
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
    <section className="rounded-[24px] border border-[#e2e8f0] bg-white p-5 shadow-[0_20px_48px_-40px_rgba(30,58,138,0.7)] sm:p-6" aria-labelledby="communication-settings-title">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#eff6ff] text-[#2563eb]"><BellRing className="h-5 w-5" aria-hidden="true" /></div>
        <div><p className="text-xs font-bold uppercase tracking-[0.13em] text-[#2563eb]">Tùy chọn liên lạc</p><h2 id="communication-settings-title" className="mt-1 text-lg font-bold text-[#0f172a]">Email và bản tin tuần</h2><p className="mt-1 text-sm leading-6 text-[#64748b]">Chỉ gửi số liệu tổng hợp, nội dung cần hỗ trợ và gợi ý tại nhà; không gửi đáp án hoặc dữ liệu chi tiết.</p></div>
      </div>

      <form className="mt-6 space-y-6" onSubmit={save}>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block text-sm font-semibold text-[#475569]">Email phụ huynh
            <input value={draft.email || ''} onChange={event => setDraft(current => ({ ...current, email: event.target.value || null }))} type="email" autoComplete="email" maxLength={254} className={controlClassName} placeholder="phuhuynh@example.com" />
          </label>
          <button type="button" onClick={verify} disabled={isLoading || !draft.email || !preferences?.emailRolloutReady} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[13px] border border-[#bfdbfe] bg-[#eff6ff] px-4 font-semibold text-[#1d4ed8] transition-colors hover:bg-[#dbeafe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-not-allowed disabled:opacity-50"><MailCheck className="h-4 w-4" aria-hidden="true" />Gửi xác minh</button>
        </div>

        <p className={`rounded-[12px] px-3 py-2 text-sm font-medium ${preferences?.emailVerifiedAt ? 'bg-[#ecfdf5] text-[#15803d]' : 'bg-[#fffbeb] text-[#b45309]'}`}>{preferences?.emailVerifiedAt ? 'Email đã được xác minh.' : 'Email chưa được xác minh.'}</p>
        {!preferences?.emailRolloutReady && <p className="rounded-[14px] border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e]">Tính năng gửi email chưa mở vì SPF, DKIM và DMARC chưa hoàn tất.</p>}

        <label className="flex items-start gap-3 rounded-[18px] border border-[#e2e8f0] bg-[#f8fafc] p-4">
          <input type="checkbox" checked={draft.weeklyDigestEnabled} disabled={!preferences?.emailRolloutReady} onChange={event => setDraft(current => ({ ...current, weeklyDigestEnabled: event.target.checked }))} className="mt-1 h-5 w-5 rounded border-[#cbd5e1] accent-[#2563eb]" />
          <span><span className="block font-semibold text-[#1e293b]">Nhận bản tin học tập hằng tuần</span><span className="mt-1 block text-sm text-[#64748b]">Có thể tắt bất cứ lúc nào.</span></span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-[#475569]">Ngày gửi
            <select value={draft.digestWeekday} onChange={event => setDraft(current => ({ ...current, digestWeekday: Number(event.target.value) as ParentContactPreferencesInput['digestWeekday'] }))} className={controlClassName}>{weekdayOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </label>
          <label className="text-sm font-semibold text-[#475569]">Giờ gửi
            <select value={draft.digestHour} onChange={event => setDraft(current => ({ ...current, digestHour: Number(event.target.value) }))} className={controlClassName}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}</select>
          </label>
        </div>

        <fieldset>
          <legend className="font-semibold text-[#1e293b]">Loại thông báo qua email</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {kindOptions.map(option => (
              <label key={option.kind} className="flex min-h-11 items-center gap-3 rounded-[13px] bg-[#f8fafc] px-3 text-sm text-[#475569]">
                <input type="checkbox" checked={draft.emailKinds.includes(option.kind)} onChange={() => toggleKind(option.kind)} className="h-[18px] w-[18px] rounded border-[#cbd5e1] accent-[#2563eb]" />{option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="rounded-[18px] border border-[#e2e8f0] p-4">
          <label className="flex items-center gap-3 font-semibold text-[#1e293b]"><input type="checkbox" checked={draft.quietHoursEnabled} onChange={event => setDraft(current => ({ ...current, quietHoursEnabled: event.target.checked }))} className="h-5 w-5 rounded border-[#cbd5e1] accent-[#2563eb]" /><MoonStar className="h-5 w-5 text-[#2563eb]" aria-hidden="true" />Khung giờ yên lặng</label>
          <p className="mt-1 pl-8 text-xs text-[#64748b]">Hạn chế gửi thông báo trong khoảng thời gian gia đình nghỉ ngơi.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-[#475569]">Bắt đầu<input type="time" value={draft.quietHoursStart} onChange={event => setDraft(current => ({ ...current, quietHoursStart: event.target.value }))} disabled={!draft.quietHoursEnabled} className={controlClassName} /></label>
            <label className="text-sm font-semibold text-[#475569]">Kết thúc<input type="time" value={draft.quietHoursEnd} onChange={event => setDraft(current => ({ ...current, quietHoursEnd: event.target.value }))} disabled={!draft.quietHoursEnabled} className={controlClassName} /></label>
          </div>
        </div>

        {message && <p role="status" className="rounded-[14px] bg-[#ecfdf5] px-4 py-3 text-sm text-[#15803d]">{message}</p>}
        {error && <p role="alert" className="rounded-[14px] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">{error}</p>}
        <button type="submit" disabled={isLoading} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#2563eb] px-5 font-bold text-white shadow-[0_16px_32px_-20px_rgba(37,99,235,0.9)] transition-colors hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2563eb]/25 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"><Save className="h-4 w-4" aria-hidden="true" />{isLoading ? 'Đang lưu…' : 'Lưu cài đặt'}</button>
      </form>
    </section>
  );
}

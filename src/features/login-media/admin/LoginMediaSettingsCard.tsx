import { useEffect, useRef, useState } from 'react';
import type {
  LoginMediaAdminSettings,
  LoginMediaSettingsUpdate,
} from '../loginMediaAdmin.types';

interface Props {
  settings: LoginMediaAdminSettings;
  busy: boolean;
  onSave: (input: LoginMediaSettingsUpdate) => Promise<void>;
}

export const LoginMediaSettingsCard = ({ settings, busy, onSave }: Props) => {
  const [draft, setDraft] = useState(settings);
  const [intervalSeconds, setIntervalSeconds] = useState(String(settings.intervalMs / 1000));
  const [reason, setReason] = useState('');
  const syncedVersionRef = useRef(settings.version);

  useEffect(() => {
    if (syncedVersionRef.current === settings.version) return;
    syncedVersionRef.current = settings.version;
    setDraft(settings);
    setIntervalSeconds(String(settings.intervalMs / 1000));
  }, [settings]);

  const save = async () => {
    const cleanReason = reason.trim();
    if (!cleanReason) return;
    const seconds = Number(intervalSeconds);
    if (!Number.isFinite(seconds) || seconds < 2 || seconds > 30) return;
    await onSave({
      expectedVersion: settings.version,
      displayMode: draft.displayMode,
      autoplay: draft.autoplay,
      intervalMs: Math.round(seconds * 1000),
      transition: draft.transition,
      showDots: draft.showDots,
      showArrows: draft.showArrows,
      pauseOnHover: draft.pauseOnHover,
      reason: cleanReason,
    });
    setReason('');
  };

  const toggleClass = 'flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="login-media-settings-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="login-media-settings-title" className="text-lg font-bold text-slate-900">Chế độ hiển thị</h3>
          <p className="mt-1 text-sm text-slate-500">Khi tắt trình chiếu, trang đăng nhập dùng lại khối Tổng quan học tập hiện tại.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Phiên bản {settings.version}</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-4">
          <input aria-label="Tổng quan học tập" type="radio" name="login-media-mode" checked={draft.displayMode === 'CONTENT'} onClick={() => setDraft((current) => ({ ...current, displayMode: 'CONTENT' }))} onChange={() => setDraft((current) => ({ ...current, displayMode: 'CONTENT' }))} />
          <span><span className="block font-semibold text-slate-900">Tổng quan học tập</span><span className="text-xs text-slate-500">Giữ nội dung mặc định.</span></span>
        </label>
        <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-4">
          <input aria-label="Trình chiếu ảnh" type="radio" name="login-media-mode" checked={draft.displayMode === 'SLIDER'} onClick={() => setDraft((current) => ({ ...current, displayMode: 'SLIDER' }))} onChange={() => setDraft((current) => ({ ...current, displayMode: 'SLIDER' }))} />
          <span><span className="block font-semibold text-slate-900">Trình chiếu ảnh</span><span className="text-xs text-slate-500">Hiển thị banner đang bật và đúng lịch.</span></span>
        </label>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm font-semibold text-slate-700">
          Thời gian mỗi ảnh (giây)
          <input
            aria-label="Thời gian mỗi ảnh (giây)"
            type="number"
            min={2}
            max={30}
            value={intervalSeconds}
            onChange={(event) => setIntervalSeconds(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 font-normal focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Hiệu ứng
          <select value={draft.transition} onChange={(event) => setDraft((current) => ({ ...current, transition: event.target.value as 'FADE' | 'SLIDE' }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 font-normal focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200">
            <option value="FADE">Mờ dần (Fade)</option>
            <option value="SLIDE">Trượt (Slide)</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2 xl:col-span-1">
          Lý do thay đổi
          <input aria-label="Lý do thay đổi" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Bật banner tuyển sinh" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 font-normal focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <label className={toggleClass}><input type="checkbox" checked={draft.autoplay} onChange={(event) => setDraft((current) => ({ ...current, autoplay: event.target.checked }))} /> Tự chuyển ảnh</label>
        <label className={toggleClass}><input type="checkbox" checked={draft.showDots} onChange={(event) => setDraft((current) => ({ ...current, showDots: event.target.checked }))} /> Hiện chấm điều hướng</label>
        <label className={toggleClass}><input type="checkbox" checked={draft.showArrows} onChange={(event) => setDraft((current) => ({ ...current, showArrows: event.target.checked }))} /> Hiện mũi tên</label>
        <label className={toggleClass}><input type="checkbox" checked={draft.pauseOnHover} onChange={(event) => setDraft((current) => ({ ...current, pauseOnHover: event.target.checked }))} /> Dừng khi rê chuột</label>
      </div>

      <button type="button" disabled={busy || !reason.trim() || !Number.isFinite(Number(intervalSeconds)) || Number(intervalSeconds) < 2 || Number(intervalSeconds) > 30} onClick={() => void save()} className="mt-5 min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? 'Đang lưu…' : 'Lưu cài đặt'}
      </button>
    </section>
  );
};

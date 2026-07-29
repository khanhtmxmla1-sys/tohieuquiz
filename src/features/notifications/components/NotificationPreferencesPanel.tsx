import React, { useEffect, useState } from 'react';
import type { NotificationPreferences } from '../../../../shared/notifications.contract';
import {
  fetchNotificationPreferences,
  saveNotificationPreferences,
} from '../notificationService';

export function NotificationPreferencesPanel({ onClose }: { onClose: () => void }) {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchNotificationPreferences()
      .then((value) => active && setPreferences(value))
      .catch((reason: unknown) => active && setError(
        reason instanceof Error ? reason.message : 'Không thể tải cài đặt thông báo.',
      ));
    return () => { active = false; };
  }, []);

  const update = <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => {
    setPreferences((current) => current ? { ...current, [key]: value } : current);
  };

  const save = async () => {
    if (!preferences) return;
    setSaving(true);
    setError(null);
    try {
      setPreferences(await saveNotificationPreferences(preferences));
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể lưu cài đặt thông báo.');
    } finally {
      setSaving(false);
    }
  };

  if (!preferences) {
    return <p className="p-6 text-center text-sm text-slate-500">{error || 'Đang tải cài đặt...'}</p>;
  }

  return (
    <div className="space-y-4 p-4" aria-label="Cài đặt thông báo">
      <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800">
        Thông báo khẩn cấp luôn được bật để bảo đảm an toàn và vận hành lớp học.
      </div>
      <label className="flex items-center justify-between gap-3">
        <span>Thông báo cần hành động</span>
        <input
          type="checkbox"
          checked={preferences.actionRequiredEnabled}
          onChange={(event) => update('actionRequiredEnabled', event.target.checked)}
        />
      </label>
      <label className="flex items-center justify-between gap-3">
        <span>Thông báo thông tin</span>
        <input
          type="checkbox"
          checked={preferences.informationalEnabled}
          onChange={(event) => update('informationalEnabled', event.target.checked)}
        />
      </label>
      <label className="flex items-center justify-between gap-3">
        <span>Giờ yên lặng cho thông báo thông tin</span>
        <input
          type="checkbox"
          checked={preferences.quietHoursEnabled}
          onChange={(event) => update('quietHoursEnabled', event.target.checked)}
        />
      </label>
      {preferences.quietHoursEnabled && (
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-slate-600">
            Bắt đầu
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              type="time"
              value={preferences.quietStart}
              onChange={(event) => update('quietStart', event.target.value)}
            />
          </label>
          <label className="text-sm text-slate-600">
            Kết thúc
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              type="time"
              value={preferences.quietEnd}
              onChange={(event) => update('quietEnd', event.target.value)}
            />
          </label>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="rounded-lg px-3 py-2 text-sm" onClick={onClose}>Hủy</button>
        <button
          type="button"
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
        </button>
      </div>
    </div>
  );
}

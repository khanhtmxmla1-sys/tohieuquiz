import React, { useCallback, useEffect, useState } from 'react';
import { Fingerprint, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  getAccountPasskeys,
  passkeysSupported,
  registerAccountPasskey,
  revokeAccountPasskey,
  type AccountPasskey,
} from '../../services/passkeyService';
import { showError, showSuccess } from '../../utils/toast';

const formatDate = (value: string | null): string => {
  if (!value) return 'Chưa sử dụng';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Không xác định' : date.toLocaleString('vi-VN');
};

export const PasskeyPanel: React.FC = () => {
  const [passkeys, setPasskeys] = useState<AccountPasskey[]>([]);
  const [label, setLabel] = useState('Thiết bị của tôi');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const supported = passkeysSupported();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPasskeys(await getAccountPasskeys());
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Không thể tải passkey.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    setBusyId('new');
    try {
      const created = await registerAccountPasskey(label.trim() || 'Passkey');
      setPasskeys((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      showSuccess('Đã thêm passkey. Mật khẩu vẫn có thể dùng để khôi phục.');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Không thể thêm passkey.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (passkey: AccountPasskey) => {
    setBusyId(passkey.id);
    try {
      await revokeAccountPasskey(passkey.id);
      setPasskeys((current) => current.filter((item) => item.id !== passkey.id));
      showSuccess('Đã xóa passkey.');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Không thể xóa passkey.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-6 border-t pt-5" aria-labelledby="passkey-settings-title">
      <div className="flex items-start gap-3">
        <Fingerprint className="mt-0.5 h-5 w-5 text-blue-600" />
        <div>
          <h4 id="passkey-settings-title" className="font-bold text-slate-900">Passkey cho giáo viên</h4>
          <p className="mt-1 text-sm text-slate-500">Đăng nhập bằng khóa bảo mật hoặc sinh trắc học. Passkey bổ sung mật khẩu, không thay thế phương án khôi phục.</p>
        </div>
      </div>

      {!supported && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Trình duyệt hoặc thiết bị này chưa hỗ trợ WebAuthn.</div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="flex-1 text-sm font-semibold text-slate-700">Tên thiết bị
          <input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} className="mt-1 min-h-11 w-full rounded-xl border px-3" />
        </label>
        <button type="button" onClick={() => void add()} disabled={!supported || busyId !== null} className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-bold text-white disabled:opacity-50">
          {busyId === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Thêm passkey
        </button>
      </div>

      <div className="mt-4 space-y-2" role="list" aria-label="Danh sách passkey">
        {loading ? (
          <div className="flex min-h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : passkeys.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Chưa có passkey.</p>
        ) : passkeys.map((passkey) => (
          <article key={passkey.id} role="listitem" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 h-5 w-5 text-slate-500" />
              <div>
                <div className="font-semibold text-slate-900">{passkey.label}</div>
                <div className="mt-1 text-xs text-slate-500">{passkey.deviceType} · {passkey.backedUp ? 'Đã sao lưu' : 'Chỉ thiết bị này'}</div>
                <div className="text-xs text-slate-400">Dùng gần nhất: {formatDate(passkey.lastUsedAt)}</div>
              </div>
            </div>
            <button type="button" onClick={() => void remove(passkey)} disabled={busyId !== null} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700 disabled:opacity-50">
              {busyId === passkey.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Xóa
            </button>
          </article>
        ))}
      </div>
    </div>
  );
};

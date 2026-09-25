import React, { useEffect, useState } from 'react';
import type { PersonalAiProvider } from '../../../../shared/teacher-ai-credentials.contract';
import type { AiCredentialsController } from '../hooks/useAiCredentials';

interface AiCredentialSettingsProps {
  provider: PersonalAiProvider;
  controller: AiCredentialsController;
}

const PROVIDER_LABEL: Record<PersonalAiProvider, string> = {
  gemini: 'Gemini',
  deepseek: 'DeepSeek',
};

const AiCredentialSettings: React.FC<AiCredentialSettingsProps> = ({
  provider,
  controller,
}) => {
  const summary = controller.summaries[provider];
  const label = PROVIDER_LABEL[provider];
  const [editing, setEditing] = useState(!summary.configured);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setApiKey('');
    setShowKey(false);
    setLocalError(null);
    setStatus('');
    setConfirmDelete(false);
    setEditing(!summary.configured);
  }, [provider, summary.configured]);

  const save = async () => {
    const key = apiKey.trim();
    if (!key) {
      setLocalError('Vui lòng nhập API key.');
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      await controller.save(provider, key);
      setApiKey('');
      setEditing(false);
      setStatus('Đã kiểm tra và lưu API key.');
    } catch (error) {
      setApiKey('');
      setLocalError(error instanceof Error ? error.message : 'Không thể lưu API key.');
    } finally {
      setBusy(false);
    }
  };

  const retest = async () => {
    setBusy(true);
    setLocalError(null);
    try {
      await controller.test(provider);
      setStatus('API key đã được kiểm tra lại.');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Không thể kiểm tra API key.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setLocalError(null);
    try {
      await controller.remove(provider);
      setConfirmDelete(false);
      setEditing(true);
      setStatus('Đã xóa API key khỏi TôHiệuQuiz.');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Không thể xóa API key.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
      <div aria-live="polite" className="sr-only">{status || localError || controller.error || ''}</div>

      {!controller.enabled && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Nguồn AI cá nhân hiện chưa được bật cho tài khoản này. Bạn vẫn có thể xóa key đã lưu.
        </p>
      )}

      {summary.configured && !editing ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-800">
            {label} cá nhân — Đã lưu ••••{summary.last4}
          </p>
          {summary.verifiedAt && (
            <p className="text-xs text-slate-500">
              Kiểm tra gần nhất: {new Date(summary.verifiedAt).toLocaleString('vi-VN')}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={retest}
              disabled={busy || !controller.enabled}
              className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              Kiểm tra lại
            </button>
            <button
              type="button"
              onClick={() => {
                setApiKey('');
                setEditing(true);
                setStatus('');
              }}
              disabled={busy || !controller.enabled}
              className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              Thay key
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className="rounded-lg border px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
            >
              Xóa khỏi TôHiệuQuiz
            </button>
          </div>
          {confirmDelete && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              <p>
                Xóa bản lưu trên TôHiệuQuiz không thu hồi API key tại {label}.
              </p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={remove} disabled={busy} className="rounded-lg bg-red-700 px-3 py-2 font-medium text-white">
                  Xác nhận xóa
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy} className="rounded-lg border px-3 py-2 font-medium">
                  Hủy
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-800">
            API key {label}
            <div className="mt-1 flex gap-2">
              <input
                aria-label={`API key ${label}`}
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                disabled={busy || !controller.enabled}
                className="min-w-0 flex-1 rounded-lg border px-3 py-2 font-mono text-sm disabled:bg-slate-100"
              />
              <button
                type="button"
                aria-label={showKey ? 'Ẩn API key' : 'Hiện API key'}
                onClick={() => setShowKey((current) => !current)}
                disabled={busy}
                className="rounded-lg border px-3 py-2 text-sm font-medium"
              >
                {showKey ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy || !controller.enabled || !apiKey.trim()}
              className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Kiểm tra và lưu
            </button>
            {summary.configured && (
              <button
                type="button"
                onClick={() => {
                  setApiKey('');
                  setEditing(false);
                }}
                disabled={busy}
                className="rounded-lg border px-3 py-2 text-sm font-medium"
              >
                Hủy thay key
              </button>
            )}
          </div>
          <p className="text-xs leading-5 text-slate-500">
            Key được gửi tới server TôHiệuQuiz và lưu dưới dạng mã hóa. Hệ thống dùng key này để gọi {label} thay bạn.
            Phí API do bạn chi trả. Thao tác kiểm tra có thể phát sinh một lượng sử dụng API nhỏ.
          </p>
        </div>
      )}

      {(localError || controller.error) && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {localError || controller.error}
        </p>
      )}
    </div>
  );
};

export default AiCredentialSettings;

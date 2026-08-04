import { formatSystemDateTime } from '../../utils/dateTime';
import React, { useCallback, useEffect, useState } from 'react';
import { History, Loader2, MonitorSmartphone, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { callApi } from '../../services/apiAdapter';
import { showError, showSuccess } from '../../utils/toast';
import { PasskeyPanel } from './PasskeyPanel';

interface AccountSession {
  id: string;
  current: boolean;
  userAgentFamily: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

interface SecurityEvent {
  id: string;
  eventType: string;
  severity: string;
  actorUsername: string | null;
  sessionId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

const eventLabel = (eventType: string): string => ({
  PASSWORD_CHANGED: 'Đã đổi mật khẩu',
  PASSWORD_RESET: 'Mật khẩu được đặt lại',
  SESSION_REVOKED: 'Đã thu hồi một phiên',
  SESSIONS_REVOKED_ALL: 'Đã đăng xuất các phiên',
  LOGIN_FAILURE_THRESHOLD: 'Phát hiện nhiều lần đăng nhập sai',
  PASSKEY_ADDED: 'Đã thêm passkey',
  PASSKEY_REMOVED: 'Đã xóa passkey',
}[eventType] || 'Sự kiện bảo mật');

const formatDate = (value: string): string => formatSystemDateTime(value, 'Không xác định');

export const SecuritySessionsPanel: React.FC = () => {
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sessionResponse, eventResponse] = await Promise.all([
        callApi<{ data: AccountSession[] }>('get_account_sessions'),
        callApi<{ data: SecurityEvent[] }>('get_account_security_events'),
      ]);
      setSessions(sessionResponse.data || []);
      setEvents(eventResponse.data || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải dữ liệu bảo mật.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const revoke = async (session: AccountSession) => {
    if (session.current) return;
    setBusyId(session.id);
    try {
      await callApi('revoke_account_session', { sessionId: session.id });
      setSessions((current) => current.filter((item) => item.id !== session.id));
      showSuccess('Đã thu hồi phiên đăng nhập.');
      const response = await callApi<{ data: SecurityEvent[] }>('get_account_security_events');
      setEvents(response.data || []);
    } catch (revokeError) {
      showError(revokeError instanceof Error ? revokeError.message : 'Không thể thu hồi phiên.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm" aria-labelledby="security-sessions-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="security-sessions-title" className="flex items-center gap-2 font-bold text-slate-900">
            <ShieldCheck className="h-5 w-5 text-blue-600" /> Phiên đăng nhập
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Chỉ hiển thị nhóm trình duyệt và thời gian hoạt động; không lưu hoặc hiển thị địa chỉ IP đầy đủ.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-28 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error} <button type="button" onClick={() => void load()} className="font-bold underline">Thử lại</button>
        </div>
      ) : (
        <div className="mt-4 space-y-3" role="list" aria-label="Danh sách phiên đăng nhập">
          {sessions.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Không có phiên đang hoạt động.</p>
          ) : sessions.map((session) => (
            <article key={session.id} role="listitem" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
              <div className="flex min-w-0 items-start gap-3">
                <MonitorSmartphone className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{session.userAgentFamily || 'Thiết bị khác'}</span>
                    {session.current && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">Phiên hiện tại</span>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Hoạt động gần nhất: {formatDate(session.lastSeenAt)}</p>
                  <p className="text-xs text-slate-400">Bắt đầu: {formatDate(session.createdAt)}</p>
                </div>
              </div>
              {!session.current && (
                <button
                  type="button"
                  onClick={() => void revoke(session)}
                  disabled={busyId === session.id}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700 disabled:opacity-50"
                >
                  {busyId === session.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  Thu hồi
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      <PasskeyPanel />

      <div className="mt-6 border-t pt-5">
        <h4 className="flex items-center gap-2 font-bold text-slate-900"><History className="h-4 w-4" /> Hoạt động bảo mật gần đây</h4>
        <div className="mt-3 space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có sự kiện bảo mật.</p>
          ) : events.slice(0, 10).map((event) => (
            <div key={event.id} className="flex items-start justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3 text-sm">
              <div><div className="font-semibold text-slate-800">{eventLabel(event.eventType)}</div><div className="text-xs text-slate-500">{formatDate(event.createdAt)}</div></div>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600">{event.severity}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

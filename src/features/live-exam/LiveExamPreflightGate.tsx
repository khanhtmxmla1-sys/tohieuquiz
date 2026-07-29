import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { getWorkersApiBaseUrl } from '../../services/api/config';
import {
  runLiveExamPreflight,
  type LiveExamPreflightResult,
} from './liveExamPreflight';

interface LiveExamPreflightGateProps {
  children: React.ReactNode;
}

export const LiveExamPreflightGate: React.FC<LiveExamPreflightGateProps> = ({ children }) => {
  const { isOnline } = useOnlineStatus();
  const [result, setResult] = useState<LiveExamPreflightResult | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const runCheck = useCallback(async () => {
    setIsChecking(true);
    const next = await runLiveExamPreflight({
      apiBaseUrl: getWorkersApiBaseUrl(),
      online: isOnline,
    });
    setResult(next);
    setIsChecking(false);
  }, [isOnline]);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  if (isChecking || !result) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" role="status" aria-live="polite">
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-blue-600 motion-reduce:animate-none" />
          <h2 className="text-xl font-black text-slate-800">Đang kiểm tra trước khi vào thi</h2>
          <p className="mt-2 text-sm text-slate-600">Hệ thống đang kiểm tra mạng, phiên đăng nhập, đồng hồ và màn hình.</p>
        </div>
      </div>
    );
  }

  if (!result.ready) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-3xl border border-amber-200 bg-white p-6 shadow-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-7 w-7 shrink-0 text-amber-600" />
            <div>
              <h2 className="text-xl font-black text-slate-800">Chưa thể vào bài thi an toàn</h2>
              <p className="mt-1 text-sm text-slate-600">Khắc phục các mục chưa đạt rồi kiểm tra lại. Đáp án cũ trên thiết bị không bị xóa.</p>
            </div>
          </div>

          <ul className="mt-5 space-y-2" aria-live="polite">
            {result.checks.map((check) => (
              <li key={check.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                {check.ok
                  ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  : <XCircle className="h-5 w-5 shrink-0 text-red-600" />}
                <span>{check.message}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => void runCheck()}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700"
          >
            <RefreshCw className="h-5 w-5" />
            Kiểm tra lại
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default LiveExamPreflightGate;

import { formatSystemDateTime } from '../../utils/dateTime';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  HelpCircle,
  Loader2,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type {
  OperationsComponent,
  OperationsComponentStatus,
  OperationsSnapshotResponse,
} from '../../../shared/operations.contract';
import { callApi } from '../../services/apiAdapter';
import { showError, showSuccess } from '../../utils/toast';

const OperationsMetricsChart = React.lazy(() => import('./OperationsMetricsChart'));

const statusMeta: Record<OperationsComponentStatus, {
  label: string;
  className: string;
  icon: React.ReactNode;
}> = {
  healthy: { label: 'Ổn định', className: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: <CheckCircle2 className="h-5 w-5" /> },
  degraded: { label: 'Suy giảm', className: 'border-amber-200 bg-amber-50 text-amber-800', icon: <AlertTriangle className="h-5 w-5" /> },
  unavailable: { label: 'Không khả dụng', className: 'border-red-200 bg-red-50 text-red-800', icon: <XCircle className="h-5 w-5" /> },
  unknown: { label: 'Chưa xác định', className: 'border-slate-200 bg-slate-50 text-slate-700', icon: <HelpCircle className="h-5 w-5" /> },
};

const runbookByComponent: Record<string, string[]> = {
  api: ['Đối chiếu release vừa triển khai.', 'Kiểm tra tỷ lệ 5xx theo route family.', 'Rollback release nếu lỗi tăng ngay sau deploy.'],
  d1: ['Kiểm tra D1 status và latency.', 'Đối chiếu migration registry.', 'Không chạy câu lệnh sửa dữ liệu từ màn hình này.'],
  migrations: ['So sánh migration mới nhất với release.', 'Chạy audit migration state.', 'Dùng rollback đã review nếu có drift.'],
  queue: ['Kiểm tra certificate consumer.', 'Xác định batch stale/failed.', 'Chỉ replay bằng thao tác idempotent đã audit.'],
  dlq: ['Kiểm tra Cloudflare Queue dashboard.', 'Ghi lại message count và thời điểm.', 'Không đưa payload thô vào ticket.'],
  r2: ['Kiểm tra bucket availability.', 'Đối chiếu quyền binding.', 'Không hiển thị bucket ID hoặc secret.'],
  ai: ['Kiểm tra provider/quota.', 'So sánh lỗi với release.', 'Tắt rollout AI nếu lỗi hoặc chi phí tăng.'],
  certificates: ['Kiểm tra batch failed/stale.', 'Đối chiếu Queue và R2.', 'Retry theo batch ID đã audit.'],
  backup: ['Xác nhận backup gần nhất.', 'Kiểm tra bằng chứng restore drill.', 'Không đánh dấu khỏe khi thiếu bằng chứng.'],
  feature_flags: ['Đối chiếu flag mong đợi.', 'Kiểm tra rollout scope.', 'Rollback bằng flag thay vì sửa dữ liệu.'],
};

const formatDate = (value: string): string => formatSystemDateTime(value, 'Không xác định');

const copyText = async (label: string, value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    showSuccess(`Đã sao chép ${label}.`);
  } catch {
    showError(`Không thể sao chép ${label}.`);
  }
};

const ComponentCard: React.FC<{ component: OperationsComponent }> = ({ component }) => {
  const meta = statusMeta[component.status];
  return (
    <article className="rounded-2xl border bg-white p-5 shadow-sm" data-status={component.status}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900">{component.label}</h3>
          <p className="mt-1 text-sm text-slate-600">{component.summary}</p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${meta.className}`}>
          {meta.icon}{meta.label}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
        <span>Probe: <strong className="text-slate-700">{component.latencyMs} ms</strong></span>
        <span>Kiểm tra: <strong className="text-slate-700">{formatDate(component.checkedAt)}</strong></span>
        {component.code && <span>Mã: <strong className="text-slate-700">{component.code}</strong></span>}
      </div>
      {component.metrics.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {component.metrics.map((metric) => (
            <div key={metric.key} className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="truncate text-xs text-slate-500">{metric.key}</dt>
              <dd className="mt-1 font-bold text-slate-800">{String(metric.value ?? '—')}</dd>
            </div>
          ))}
        </dl>
      )}
      <details className="mt-4 rounded-xl border bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Runbook xử lý</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          {(runbookByComponent[component.id] || ['Đối chiếu request ID và release.', 'Chuyển cho owner vận hành.']).map((step) => <li key={step}>{step}</li>)}
        </ol>
      </details>
    </article>
  );
};

const OperationsCenterPage: React.FC = () => {
  const [snapshot, setSnapshot] = useState<OperationsSnapshotResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await callApi<OperationsSnapshotResponse>('get_admin_operations');
      setSnapshot(response.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải trạng thái hệ thống.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading && !snapshot) return <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  if (error && !snapshot) return (
    <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
      <ShieldAlert className="mx-auto h-8 w-8" /><h2 className="mt-3 font-bold">Không thể tải Operations Center</h2>
      <p className="mt-2 text-sm">{error}</p><button type="button" onClick={() => void load()} className="mt-4 rounded-xl bg-red-700 px-4 py-2 font-semibold text-white">Thử lại</button>
    </div>
  );
  if (!snapshot) return null;

  const overall = statusMeta[snapshot.overallStatus];
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-6" aria-labelledby="operations-center-title">
      <header className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-600">Quản trị hệ thống</p>
            <h1 id="operations-center-title" className="mt-1 text-2xl font-bold text-slate-950">Operations Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Một màn hình đọc-only để xác định nhanh trạng thái dependency. Không có thao tác phá hủy hoặc raw log trong phiên bản đầu.</p>
          </div>
          <button data-testid="operations-refresh" type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 font-bold text-white disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
          </button>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span data-testid="operations-overall-status" data-status={snapshot.overallStatus} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold ${overall.className}`}>{overall.icon} Toàn hệ thống: {overall.label}</span>
          <span className="text-sm text-slate-500">Kiểm tra gần nhất: <strong className="text-slate-700">{formatDate(snapshot.checkedAt)}</strong></span>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <button type="button" onClick={() => void copyText('request ID', snapshot.requestId)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 font-semibold text-slate-700"><Clipboard className="h-4 w-4" /> Request ID: {snapshot.requestId}</button>
          <button type="button" onClick={() => void copyText('release SHA', snapshot.release)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 font-semibold text-slate-700"><Activity className="h-4 w-4" /> Release: {snapshot.release}</button>
        </div>
      </header>

      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Dữ liệu hiện tại có thể đã cũ: {error}</div>}

      <Suspense fallback={<div className="flex min-h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
        <OperationsMetricsChart components={snapshot.components} />
      </Suspense>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Trạng thái các thành phần">
        {snapshot.components.map((component) => <ComponentCard key={component.id} component={component} />)}
      </section>
    </main>
  );
};

export default OperationsCenterPage;

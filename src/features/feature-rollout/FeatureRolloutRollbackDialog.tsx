import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { FeatureFlagConfig } from '../../../shared/feature-rollout.contract';
import { formatFeatureRolloutState, getFeatureFlagPresentation } from './featureFlagPresentation';

interface FeatureRolloutRollbackDialogProps {
  flag: FeatureFlagConfig | null;
  open: boolean;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function FeatureRolloutRollbackDialog({
  flag,
  open,
  submitting = false,
  onCancel,
  onConfirm,
}: FeatureRolloutRollbackDialogProps) {
  if (!open || !flag) return null;
  const presentation = getFeatureFlagPresentation(flag);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feature-rollout-rollback-title"
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-800">
            <RotateCcw aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h3 id="feature-rollout-rollback-title" className="text-lg font-bold text-slate-900">Hoàn tác thay đổi gần nhất?</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">Hệ thống sẽ khôi phục cấu hình trước mutation gần nhất của tính năng này mà không cần deploy lại.</p>
          </div>
        </div>

        <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-bold text-slate-900">{presentation.displayName} · v{flag.version}</p>
          <p className="text-slate-600">Hiện tại: {formatFeatureRolloutState(flag)}</p>
          <p className="text-slate-600">Mutation gần nhất: {flag.reason || 'Không có mô tả thay đổi.'}</p>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" disabled={submitting} onClick={onCancel} className="min-h-11 rounded-xl border border-slate-200 px-4 font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50">Quay lại</button>
          <button type="button" disabled={submitting} onClick={onConfirm} autoFocus className="min-h-11 rounded-xl bg-amber-700 px-4 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 disabled:opacity-50">{submitting ? 'Đang hoàn tác…' : 'Xác nhận hoàn tác'}</button>
        </div>
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FilePenLine,
  Gift,
  Loader2,
  Radio,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type {
  TeacherActionCenter,
  TeacherActionItem,
  TeacherActionMutation,
} from '../../../../shared/teacher-action-center.contract';
import { fetchTeacherActionCenter } from '../../../services/teacherActionCenterService';
import { deleteRemoteManualQuizDraftIfExists } from '../../../services/manualQuizDraftService';
import { removeLocalDraft } from '../../../features/manual-quiz-workspace/draft/manualQuizDraftRepository';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { showError, showSuccess } from '../../../utils/toast';
import DraftDeleteDialog from './DraftDeleteDialog';

const iconByKind = {
  assignment_at_risk: ClipboardList,
  draft_unpublished: FilePenLine,
  gift_order_pending: Gift,
  gift_low_stock: Gift,
  live_exam_upcoming: Radio,
} as const;

const toneBySeverity = {
  critical: 'border-rose-200 bg-rose-50 text-rose-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
} as const;

interface ActionItemProps {
  item: TeacherActionItem;
  deletingDraftId: string | null;
  onSecondaryAction: (action: TeacherActionMutation) => void;
}

const ActionItem = ({ item, deletingDraftId, onSecondaryAction }: ActionItemProps) => {
  const Icon = iconByKind[item.kind];
  const secondaryAction = item.secondaryAction;
  const isDeletingThisDraft = secondaryAction?.resourceId === deletingDraftId;

  return (
    <article className={`rounded-2xl border p-4 ${toneBySeverity[item.severity]}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">{item.title}</h3>
            <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold" aria-label={`${item.count} mục`}>
              {item.count}
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 opacity-80">{item.explanation}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to={item.cta.url}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold shadow-sm hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {item.cta.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            {secondaryAction ? (
              <button
                type="button"
                onClick={() => onSecondaryAction(secondaryAction)}
                disabled={Boolean(deletingDraftId)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 bg-white/80 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeletingThisDraft ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                {secondaryAction.label}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
};

const ActionCenterPanel: React.FC = () => {
  const { isOnline } = useOnlineStatus();
  const [data, setData] = useState<TeacherActionCenter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDeleteAction, setPendingDeleteAction] = useState<TeacherActionMutation | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setData(await fetchTeacherActionCenter());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải việc cần chú ý.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDeleteDraft = useCallback(async () => {
    const action = pendingDeleteAction;
    if (!action || deletingDraftId) return;

    setDeletingDraftId(action.resourceId);
    try {
      await deleteRemoteManualQuizDraftIfExists(action.resourceId);
      try {
        removeLocalDraft(action.ownerUsername, action.resourceId);
      } catch (localCleanupError) {
        console.warn('[ActionCenter] Could not remove the local draft copy:', localCleanupError);
      }
      setPendingDeleteAction(null);
      setData((current) => current ? {
        ...current,
        items: current.items.filter((item) => item.secondaryAction?.resourceId !== action.resourceId),
      } : current);
      await load();
      showSuccess('Đã xóa bản nháp.');
    } catch (deleteError) {
      showError(deleteError instanceof Error ? deleteError.message : 'Không thể xóa bản nháp.');
    } finally {
      setDeletingDraftId(null);
    }
  }, [deletingDraftId, load, pendingDeleteAction]);

  return (
    <section aria-labelledby="teacher-action-center-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-sky-700">Ưu tiên trong ngày</p>
          <h2 id="teacher-action-center-title" className="mt-1 text-xl font-bold text-slate-900">Việc cần chú ý hôm nay</h2>
          <p className="mt-1 text-sm text-slate-500">Tối đa 8 việc có thể hành động trong phạm vi tài khoản hiện tại.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={isLoading || !isOnline}
          title={!isOnline ? 'Cần kết nối mạng để làm mới.' : undefined}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          Làm mới
        </button>
      </div>

      {isLoading && !data && (
        <div role="status" className="mt-5 flex min-h-28 items-center justify-center rounded-2xl bg-slate-50 text-sm font-medium text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
          Đang tổng hợp việc cần chú ý…
        </div>
      )}

      {error && (
        <div role="alert" className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-bold">Không thể tải Action Center</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        </div>
      )}

      {!isLoading && !error && data?.items.length === 0 && (
        <div role="status" className="mt-5 flex min-h-28 flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center text-emerald-800">
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          <p className="mt-2 font-bold">Không có việc gấp trong phạm vi hiện tại</p>
          <p className="mt-1 text-sm">Hệ thống sẽ hiển thị khi có bài sắp hạn, đơn quà, bản nháp hoặc phiên thi cần xử lý.</p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {data.items.map((item) => (
            <ActionItem
              key={item.id}
              item={item}
              deletingDraftId={deletingDraftId}
              onSecondaryAction={setPendingDeleteAction}
            />
          ))}
        </div>
      )}

      <DraftDeleteDialog
        action={pendingDeleteAction}
        isDeleting={Boolean(deletingDraftId)}
        onClose={() => {
          if (!deletingDraftId) setPendingDeleteAction(null);
        }}
        onConfirm={() => void handleDeleteDraft()}
      />
    </section>
  );
};

export default ActionCenterPanel;

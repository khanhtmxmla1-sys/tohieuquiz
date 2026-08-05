import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
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
  critical: {
    icon: 'bg-rose-50 text-rose-700',
    count: 'bg-rose-100 text-rose-700',
    link: 'text-rose-700 hover:bg-rose-50',
  },
  warning: {
    icon: 'bg-amber-50 text-amber-700',
    count: 'bg-amber-100 text-amber-700',
    link: 'text-amber-800 hover:bg-amber-50',
  },
  info: {
    icon: 'bg-blue-50 text-blue-700',
    count: 'bg-blue-100 text-blue-700',
    link: 'text-blue-700 hover:bg-blue-50',
  },
} as const;

interface ActionItemProps {
  item: TeacherActionItem;
  deletingDraftId: string | null;
  onSecondaryAction: (action: TeacherActionMutation) => void;
}

const ActionItem = ({ item, deletingDraftId, onSecondaryAction }: ActionItemProps) => {
  const Icon = iconByKind[item.kind];
  const tone = toneBySeverity[item.severity];
  const secondaryAction = item.secondaryAction;
  const isDeletingThisDraft = secondaryAction?.resourceId === deletingDraftId;

  return (
    <li className="bg-white px-4 py-4 sm:px-5">
      <article className="flex items-start gap-3 sm:items-center">
        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${tone.icon}`}>
          <Icon aria-hidden="true" className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{item.title}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">{item.explanation}</p>
            </div>
            <span
              className={`inline-flex min-w-7 shrink-0 items-center justify-center rounded-full px-2 py-1 text-xs font-bold tabular-nums ${tone.count}`}
              aria-label={`${item.count} mục`}
            >
              {item.count}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              to={item.cta.url}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:text-sm ${tone.link}`}
            >
              {item.cta.label}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            {secondaryAction && (
              <button
                type="button"
                onClick={() => onSecondaryAction(secondaryAction)}
                disabled={Boolean(deletingDraftId)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              >
                {isDeletingThisDraft
                  ? <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  : <Trash2 aria-hidden="true" className="size-4" />}
                {secondaryAction.label}
              </button>
            )}
          </div>
        </div>
      </article>
    </li>
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
    <section
      aria-labelledby="teacher-action-center-title"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--dashboard-card-shadow)] sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
            <BellRing aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-blue-700">Ưu tiên trong ngày</p>
            <h2 id="teacher-action-center-title" className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">
              Việc cần chú ý hôm nay
            </h2>
            <p className="mt-1 hidden text-sm text-slate-500 sm:block">
              Các việc có thể xử lý ngay trong phạm vi tài khoản hiện tại.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={isLoading || !isOnline}
          title={!isOnline ? 'Cần kết nối mạng để làm mới.' : 'Làm mới danh sách'}
          aria-label="Làm mới"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading
            ? <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            : <RefreshCw aria-hidden="true" className="size-4" />}
        </button>
      </div>

      {isLoading && !data && (
        <div role="status" className="mt-4 flex min-h-24 items-center justify-center rounded-xl bg-slate-50 text-sm font-medium text-slate-500">
          <Loader2 aria-hidden="true" className="mr-2 size-5 animate-spin" />
          Đang tổng hợp việc cần chú ý…
        </div>
      )}

      {error && (
        <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Không thể tải việc cần chú ý</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        </div>
      )}

      {!isLoading && !error && data?.items.length === 0 && (
        <div role="status" className="mt-4 flex min-h-24 items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-emerald-800">
          <CheckCircle2 aria-hidden="true" className="size-7 shrink-0" />
          <div>
            <p className="font-semibold">Không có việc gấp trong phạm vi hiện tại</p>
            <p className="mt-0.5 text-sm text-emerald-700">Các việc mới cần xử lý sẽ xuất hiện tại đây.</p>
          </div>
        </div>
      )}

      {data && data.items.length > 0 && (
        <ol
          aria-label="Danh sách việc cần chú ý"
          className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200"
        >
          {data.items.map((item) => (
            <ActionItem
              key={item.id}
              item={item}
              deletingDraftId={deletingDraftId}
              onSecondaryAction={setPendingDeleteAction}
            />
          ))}
        </ol>
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

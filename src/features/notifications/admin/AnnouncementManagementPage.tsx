import React, { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowLeft, Copy, Plus, RefreshCw, Square, XCircle } from 'lucide-react';
import type { AnnouncementChannel, NotificationPriority } from '../../../../shared/notifications.contract';
import { callApi } from '../../../services/apiAdapter';
import { systemDateTimeLocalToIso } from '../../../utils/dateTime';
import { showError, showSuccess } from '../../../utils/toast';
import {
  AnnouncementComposer,
  createEmptyAnnouncementDraft,
  type AnnouncementAudience,
  type AnnouncementDraft,
  type AnnouncementStatus,
} from './AnnouncementComposer';
import { AnnouncementEmptyState } from './AnnouncementEmptyState';
import {
  AnnouncementLifecycleDialog,
  type AnnouncementLifecycleIntent,
} from './AnnouncementLifecycleDialog';
import { AnnouncementList, AnnouncementListSkeleton } from './AnnouncementList';
import { AnnouncementListToolbar } from './AnnouncementListToolbar';
import {
  filterAnnouncementAdminItems,
  getAnnouncementEffectiveStatus,
  type AnnouncementAdminFilter,
  type AnnouncementAdminListItem,
} from './announcementAdminSelectors';
import {
  announcementToDraft,
  cloneAnnouncementDraft,
  type AnnouncementDraftSource,
} from './announcementDraftUtils';
import { useAnnouncementEditorState } from './useAnnouncementEditorState';

interface AnnouncementItem extends AnnouncementDraftSource {
  id: string;
  content: string;
  bannerTitle: string;
  bannerSubtitle: string;
  bannerLink: string;
  bannerImage: string;
  isActive: boolean;
  isBannerActive: boolean;
  status: AnnouncementStatus;
  effectiveStatus: AnnouncementStatus;
  audience: AnnouncementAudience;
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string;
  priority?: NotificationPriority;
  channels?: AnnouncementChannel[];
  dismissible?: boolean;
  ctaLabel?: string;
  surfaceOverrides?: Record<string, unknown>;
}

type PendingTransition = (() => void) | null;
type AnnouncementAction = 'publish_announcement' | 'cancel_announcement' | 'end_announcement' | 'archive_announcement';

type AnnouncementActionResponse = {
  data?: {
    id?: string;
    status?: AnnouncementStatus;
    updatedAt?: string;
  };
};

const isConflictError = (error: unknown): boolean => (
  (typeof error === 'object' && error !== null && 'status' in error && (error as { status?: number }).status === 409)
  || (error instanceof Error && /(?:^|\D)409(?:\D|$)|người khác cập nhật|xung đột/i.test(error.message))
);

type AnnouncementViewItem = AnnouncementAdminListItem & AnnouncementItem;

const toAdminListItem = (item: AnnouncementItem): AnnouncementViewItem => ({
  ...item,
  audience: item.audience || 'ALL',
  priority: item.priority || 'INFO',
  channels: item.channels || [
    ...(item.isActive ? ['TICKER' as const] : []),
    ...(item.isBannerActive ? ['BANNER' as const] : []),
  ],
});

const draftToListItem = (draft: AnnouncementDraft): AnnouncementItem => ({
  id: draft.id,
  content: draft.content,
  bannerTitle: draft.bannerTitle,
  bannerSubtitle: draft.bannerSubtitle,
  bannerLink: draft.bannerLink,
  bannerImage: draft.bannerImage,
  isActive: draft.channels.includes('TICKER'),
  isBannerActive: draft.channels.includes('BANNER'),
  status: draft.status,
  effectiveStatus: draft.status,
  audience: draft.audience,
  startsAt: draft.startsAt ? systemDateTimeLocalToIso(draft.startsAt) : null,
  endsAt: draft.endsAt ? systemDateTimeLocalToIso(draft.endsAt) : null,
  updatedAt: draft.updatedAt,
  priority: draft.priority,
  channels: [...draft.channels],
  dismissible: draft.dismissible,
  ctaLabel: draft.ctaLabel,
  surfaceOverrides: { ...draft.surfaceOverrides },
});

const DEFAULT_FILTER: AnnouncementAdminFilter = {
  status: 'ALL',
  audience: 'ALL',
  preset: 'ALL',
  query: '',
};

const actionStatus = (action: AnnouncementAction, target: AnnouncementDraft): AnnouncementStatus => {
  if (action === 'publish_announcement') return target.status === 'SCHEDULED' ? 'SCHEDULED' : 'PUBLISHED';
  if (action === 'cancel_announcement') return 'DRAFT';
  if (action === 'end_announcement') return 'EXPIRED';
  return 'ARCHIVED';
};

const actionSuccessMessage = (action: AnnouncementAction, status: AnnouncementStatus): string => {
  if (action === 'publish_announcement') {
    return status === 'SCHEDULED' ? 'Đã lên lịch thông báo.' : 'Đã công bố thông báo.';
  }
  if (action === 'cancel_announcement') return 'Đã hủy lịch phát.';
  if (action === 'end_announcement') return 'Đã kết thúc thông báo.';
  return 'Đã lưu trữ thông báo.';
};

const AnnouncementManagementPage: React.FC = () => {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [filter, setFilter] = useState<AnnouncementAdminFilter>(DEFAULT_FILTER);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [announcementError, setAnnouncementError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<PendingTransition>(null);
  const [lifecycleIntent, setLifecycleIntent] = useState<AnnouncementLifecycleIntent | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const editor = useAnnouncementEditorState();

  const adminItems = useMemo<AnnouncementViewItem[]>(() => items.map(toAdminListItem), [items]);
  const filteredItems = useMemo(
    () => filterAnnouncementAdminItems(adminItems, filter),
    [adminItems, filter],
  );
  const counts = useMemo(() => {
    const initial: Record<'ALL' | AnnouncementStatus, number> = {
      ALL: adminItems.length,
      DRAFT: 0,
      SCHEDULED: 0,
      PUBLISHED: 0,
      EXPIRED: 0,
      ARCHIVED: 0,
    };
    adminItems.forEach((item) => { initial[getAnnouncementEffectiveStatus(item)] += 1; });
    return initial;
  }, [adminItems]);

  const upsertLocalItem = (draft: AnnouncementDraft) => {
    const next = draftToListItem(draft);
    setItems((current) => {
      const index = current.findIndex((item) => item.id === next.id);
      if (index === -1) return [next, ...current];
      return current.map((item) => item.id === next.id ? { ...item, ...next } : item);
    });
  };

  const loadAnnouncements = async (options: { preferredId?: string } = {}) => {
    setLoadingAnnouncements(true);
    setAnnouncementError('');
    try {
      const response = await callApi<{ data: AnnouncementItem[] }>('list_announcements');
      const rows = response.data || [];
      setItems(rows);
      if (options.preferredId) {
        const preferred = rows.find((item) => item.id === options.preferredId);
        if (preferred) editor.open(announcementToDraft(preferred));
      }
      return rows;
    } catch (err) {
      setAnnouncementError(err instanceof Error ? err.message : 'Không thể tải thông báo.');
      return null;
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  useEffect(() => { void loadAnnouncements(); }, []);

  const requestTransition = (transition: () => void) => {
    if (editor.dirty) {
      setPendingTransition(() => transition);
      return;
    }
    transition();
  };

  const openItem = (item: AnnouncementItem) => requestTransition(() => {
    setHasConflict(false);
    setLifecycleIntent(null);
    editor.open(announcementToDraft(item));
  });

  const createItem = () => requestTransition(() => {
    setHasConflict(false);
    setLifecycleIntent(null);
    editor.create(createEmptyAnnouncementDraft());
  });

  const payload = (draft: AnnouncementDraft) => ({
    content: draft.content,
    bannerTitle: draft.bannerTitle,
    bannerSubtitle: draft.bannerSubtitle,
    bannerLink: draft.bannerLink,
    bannerImage: draft.bannerImage,
    ctaLabel: draft.ctaLabel,
    isActive: draft.channels.includes('TICKER'),
    isBannerActive: draft.channels.includes('BANNER'),
    status: draft.status,
    audience: draft.audience,
    priority: draft.priority,
    channels: draft.channels,
    dismissible: draft.dismissible,
    surfaceOverrides: draft.surfaceOverrides,
    startsAt: draft.startsAt ? systemDateTimeLocalToIso(draft.startsAt) : null,
    endsAt: draft.endsAt ? systemDateTimeLocalToIso(draft.endsAt) : null,
    expectedUpdatedAt: draft.updatedAt || undefined,
  });

  const save = async (
    draft: AnnouncementDraft,
    notify = true,
    options: { reload?: boolean } = {},
  ) => {
    const reload = options.reload !== false;
    setSaving(true);
    setHasConflict(false);
    try {
      const action = draft.id ? 'update_announcement' : 'create_announcement';
      const response = await callApi<{ data?: { id?: string; updatedAt?: string } }>(action, {
        id: draft.id,
        ...payload(draft),
      });
      const saved: AnnouncementDraft = {
        ...draft,
        id: response.data?.id || draft.id,
        updatedAt: response.data?.updatedAt || draft.updatedAt,
      };
      editor.markSaved(saved);
      upsertLocalItem(saved);
      if (notify) showSuccess('Đã lưu thông báo.');
      if (reload) await loadAnnouncements({ preferredId: saved.id });
      return saved;
    } catch (err) {
      if (isConflictError(err)) setHasConflict(true);
      showError(err instanceof Error ? err.message : 'Không thể lưu thông báo.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: AnnouncementAction, target: AnnouncementDraft): Promise<boolean> => {
    if (!target.id) {
      showError('Hãy lưu bản nháp trước.');
      return false;
    }
    setSaving(true);
    setHasConflict(false);
    try {
      const response = await callApi<AnnouncementActionResponse>(action, {
        id: target.id,
        expectedUpdatedAt: target.updatedAt,
      });
      const nextStatus = response.data?.status || actionStatus(action, target);
      const transitioned: AnnouncementDraft = {
        ...target,
        status: nextStatus,
        updatedAt: response.data?.updatedAt || target.updatedAt,
      };
      editor.markSaved(transitioned);
      upsertLocalItem(transitioned);
      showSuccess(actionSuccessMessage(action, nextStatus));
      return true;
    } catch (err) {
      if (isConflictError(err)) setHasConflict(true);
      showError(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const publish = async (draft: AnnouncementDraft) => {
    const persistedStatus: AnnouncementStatus = draft.status === 'SCHEDULED' ? 'SCHEDULED' : 'DRAFT';
    const saved = await save({ ...draft, status: persistedStatus }, false, { reload: false });
    if (!saved?.id) return;
    await runAction('publish_announcement', saved);
  };

  const confirmLifecycle = async () => {
    const draft = editor.draft;
    const intent = lifecycleIntent;
    if (!draft || !intent) return;
    const action: AnnouncementAction = intent === 'cancel'
      ? 'cancel_announcement'
      : intent === 'end'
        ? 'end_announcement'
        : 'archive_announcement';
    const succeeded = await runAction(action, draft);
    if (succeeded) setLifecycleIntent(null);
  };

  const duplicateCurrent = () => {
    if (!editor.draft) return;
    setHasConflict(false);
    setLifecycleIntent(null);
    editor.create(cloneAnnouncementDraft(editor.draft));
  };

  const loadLatestConflictVersion = async () => {
    if (!editor.draft?.id) return;
    const rows = await loadAnnouncements({ preferredId: editor.draft.id });
    if (rows) setHasConflict(false);
  };

  const discardPendingTransition = () => {
    const transition = pendingTransition;
    setPendingTransition(null);
    transition?.();
  };

  const draft = editor.draft;
  const readOnly = editor.mode === 'readonly';
  const canCancelSchedule = draft?.status === 'SCHEDULED' && !readOnly;
  const canEnd = draft?.status === 'PUBLISHED' && !readOnly;
  const canArchive = Boolean(draft?.id && !readOnly && ['DRAFT', 'SCHEDULED', 'PUBLISHED'].includes(draft.status));
  const hasActiveFilter = filter.status !== 'ALL' || filter.audience !== 'ALL' || filter.preset !== 'ALL' || Boolean(filter.query.trim());

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-5">
      {draft ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              aria-label="Quay lại danh sách"
              onClick={() => requestTransition(editor.close)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />Quay lại danh sách
            </button>
            <span className="text-sm text-slate-600">
              {readOnly ? 'Bản lịch sử — chỉ đọc' : editor.dirty ? 'Có thay đổi chưa lưu' : 'Đã đồng bộ'}
            </span>
          </div>

          {hasConflict && draft.id && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <span>Bản này đã thay đổi trên máy chủ. Thay đổi của bạn vẫn được giữ nguyên.</span>
              <button type="button" onClick={() => void loadLatestConflictVersion()} className="min-h-11 rounded-xl border border-amber-300 bg-white px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
                Tải bản mới nhất
              </button>
            </div>
          )}

          <AnnouncementComposer
            initialDraft={draft}
            saving={saving}
            readOnly={readOnly}
            onChange={editor.update}
            onSaveDraft={async (nextDraft) => { await save(nextDraft); }}
            onPublish={publish}
          />

          {draft.id && (
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={duplicateCurrent}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50"
              >
                <Copy aria-hidden="true" className="size-4" />Nhân bản
              </button>
              {canCancelSchedule && (
                <button type="button" disabled={saving} onClick={() => setLifecycleIntent('cancel')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50">
                  <XCircle aria-hidden="true" className="size-4" />Hủy lịch
                </button>
              )}
              {canEnd && (
                <button type="button" disabled={saving} onClick={() => setLifecycleIntent('end')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 px-4 font-semibold text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50">
                  <Square aria-hidden="true" className="size-4" />Kết thúc thông báo
                </button>
              )}
              {canArchive && (
                <button type="button" disabled={saving} onClick={() => setLifecycleIntent('archive')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50">
                  <Archive aria-hidden="true" className="size-4" />Lưu trữ
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Quản lý thông báo</h2>
              <p className="mt-1 text-sm text-slate-600">Tìm, theo dõi trạng thái và tạo thông báo theo giờ Hà Nội (GMT+7).</p>
            </div>
            <div className="flex gap-2">
              <button type="button" aria-label="Làm mới danh sách" onClick={() => void loadAnnouncements()} className="inline-flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
                <RefreshCw aria-hidden="true" className="size-4" />
              </button>
              <button type="button" onClick={createItem} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
                <Plus aria-hidden="true" className="size-4" />Tạo thông báo
              </button>
            </div>
          </header>

          <AnnouncementListToolbar filter={filter} counts={counts} onChange={setFilter} />

          {loadingAnnouncements ? (
            <AnnouncementListSkeleton />
          ) : announcementError ? (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p>{announcementError}</p>
              <button type="button" onClick={() => void loadAnnouncements()} className="mt-3 min-h-11 rounded-xl border border-red-200 bg-white px-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">Thử lại</button>
            </div>
          ) : filteredItems.length === 0 ? (
            <AnnouncementEmptyState filtered={hasActiveFilter || items.length > 0} onCreate={createItem} />
          ) : (
            <AnnouncementList<AnnouncementViewItem> items={filteredItems} onOpen={openItem} />
          )}
        </>
      )}

      {pendingTransition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="announcement-dirty-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 id="announcement-dirty-title" className="text-lg font-bold text-slate-900">Bạn có thay đổi chưa lưu</h3>
            <p className="mt-2 text-sm text-slate-600">Nếu rời trình soạn thảo, các thay đổi hiện tại sẽ bị bỏ.</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setPendingTransition(null)} className="min-h-11 rounded-xl border px-4 font-semibold">Tiếp tục chỉnh sửa</button>
              <button type="button" onClick={discardPendingTransition} className="min-h-11 rounded-xl bg-red-600 px-4 font-semibold text-white">Bỏ thay đổi</button>
            </div>
          </div>
        </div>
      )}

      <AnnouncementLifecycleDialog
        intent={lifecycleIntent}
        submitting={saving}
        onCancel={() => setLifecycleIntent(null)}
        onConfirm={() => void confirmLifecycle()}
      />
    </div>
  );
};

export default AnnouncementManagementPage;

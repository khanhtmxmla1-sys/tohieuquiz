import React, { useEffect, useState } from 'react';
import { Archive, Loader2, Plus, RefreshCw, XCircle } from 'lucide-react';
import { callApi } from '../../services/apiAdapter';
import { showError, showSuccess } from '../../utils/toast';
import { FeatureRolloutPanel } from '../../features/feature-rollout/FeatureRolloutPanel';
import {
    AnnouncementComposer,
    type AnnouncementDraft,
} from '../../features/notifications/admin/AnnouncementComposer';
import type {
    AnnouncementChannel,
    NotificationPriority,
} from '../../../shared/notifications.contract';

type Status = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'EXPIRED' | 'ARCHIVED';
type Audience = 'ALL' | 'TEACHERS' | 'STUDENTS';
interface AnnouncementItem {
    id: string; content: string; bannerTitle: string; bannerSubtitle: string; bannerLink: string;
    bannerImage: string; isActive: boolean; isBannerActive: boolean; status: Status;
    effectiveStatus: Status; audience: Audience; startsAt: string | null; endsAt: string | null; updatedAt: string;
    priority?: NotificationPriority; channels?: AnnouncementChannel[]; dismissible?: boolean;
    ctaLabel?: string; surfaceOverrides?: Record<string, unknown>;
}

const emptyForm: AnnouncementDraft = {
    id: '', content: '', bannerTitle: '', bannerSubtitle: '', bannerLink: '', bannerImage: '',
    ctaLabel: '', status: 'DRAFT', audience: 'ALL', priority: 'INFO', channels: [],
    dismissible: true, startsAt: '', endsAt: '', updatedAt: '', surfaceOverrides: {},
};

const toLocalInput = (iso: string | null | undefined) => {
    if (!iso) return '';
    const date = new Date(iso);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
};

const AnnouncementSettings: React.FC = () => {
    const [items, setItems] = useState<AnnouncementItem[]>([]);
    const [form, setForm] = useState(emptyForm);
    const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
    const [announcementError, setAnnouncementError] = useState('');
    const [saving, setSaving] = useState(false);

    const selectItem = (item: AnnouncementItem) => setForm({
        id: item.id, content: item.content || '', bannerTitle: item.bannerTitle || '', bannerSubtitle: item.bannerSubtitle || '',
        bannerLink: item.bannerLink || '', bannerImage: item.bannerImage || '', ctaLabel: item.ctaLabel || '',
        status: item.status === 'ARCHIVED' || item.status === 'EXPIRED' ? 'DRAFT' : item.status,
        audience: item.audience || 'ALL', priority: item.priority || 'INFO',
        channels: item.channels || [
            ...(item.isActive ? ['TICKER' as const] : []),
            ...(item.isBannerActive ? ['BANNER' as const] : []),
        ],
        dismissible: item.dismissible !== false,
        startsAt: toLocalInput(item.startsAt), endsAt: toLocalInput(item.endsAt), updatedAt: item.updatedAt || '',
        surfaceOverrides: item.surfaceOverrides || {},
    });

    const loadAnnouncements = async () => {
        setLoadingAnnouncements(true); setAnnouncementError('');
        try {
            const response = await callApi<{ data: AnnouncementItem[] }>('list_announcements');
            const rows = response.data || [];
            setItems(rows);
            if (form.id) {
                const current = rows.find((item) => item.id === form.id);
                if (current) selectItem(current);
            } else if (rows[0]) selectItem(rows[0]);
        } catch (err) {
            setAnnouncementError(err instanceof Error ? err.message : 'Không thể tải thông báo.');
        } finally { setLoadingAnnouncements(false); }
    };

    useEffect(() => { void loadAnnouncements(); }, []);

    const payload = (draft: AnnouncementDraft) => ({
        content: draft.content, bannerTitle: draft.bannerTitle, bannerSubtitle: draft.bannerSubtitle,
        bannerLink: draft.bannerLink, bannerImage: draft.bannerImage, ctaLabel: draft.ctaLabel,
        isActive: draft.channels.includes('TICKER'), isBannerActive: draft.channels.includes('BANNER'),
        status: draft.status, audience: draft.audience, priority: draft.priority,
        channels: draft.channels, dismissible: draft.dismissible, surfaceOverrides: draft.surfaceOverrides,
        startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : null,
        endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
        expectedUpdatedAt: draft.updatedAt || undefined,
    });

    const save = async (draft: AnnouncementDraft = form, notify = true) => {
        setSaving(true);
        try {
            const action = draft.id ? 'update_announcement' : 'create_announcement';
            const response = await callApi<{ data?: { id?: string; updatedAt?: string } }>(action, {
                id: draft.id,
                ...payload(draft),
            });
            const saved = {
                ...draft,
                id: response.data?.id || draft.id,
                updatedAt: response.data?.updatedAt || draft.updatedAt,
            };
            setForm(saved);
            if (notify) showSuccess('Đã lưu thông báo.');
            await loadAnnouncements();
            return saved;
        } catch (err) {
            showError(err instanceof Error ? err.message : 'Không thể lưu thông báo.');
            return null;
        }
        finally { setSaving(false); }
    };

    const publish = async (draft: AnnouncementDraft) => {
        const saved = await save({ ...draft, status: 'DRAFT' }, false);
        if (!saved?.id) return;
        setForm(saved);
        await runAction('publish_announcement', saved);
    };

    const runAction = async (
        action: 'publish_announcement' | 'cancel_announcement' | 'archive_announcement',
        target: AnnouncementDraft = form,
    ) => {
        if (!target.id) return showError('Hãy lưu bản nháp trước.');
        setSaving(true);
        try {
            await callApi(action, { id: target.id, expectedUpdatedAt: target.updatedAt });
            showSuccess(action === 'publish_announcement' ? 'Đã công bố thông báo.' : action === 'archive_announcement' ? 'Đã lưu trữ thông báo.' : 'Đã hủy lịch phát.');
            await loadAnnouncements();
        } catch (err) { showError(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái.'); }
        finally { setSaving(false); }
    };

    return <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Thông báo hệ thống</h2>
                <p className="text-sm text-slate-600">Soạn bản nháp, chọn đối tượng và đặt lịch theo giờ Việt Nam.</p>
            </div>
            <button onClick={() => setForm(emptyForm)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700">
                <Plus className="h-4 w-4" />Thông báo mới
            </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <aside className="rounded-2xl border bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between px-2"><span className="font-bold">Danh sách</span><button onClick={() => void loadAnnouncements()} aria-label="Làm mới"><RefreshCw className="h-4 w-4" /></button></div>
                {loadingAnnouncements ? (
                    <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : announcementError ? (
                    <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                        {announcementError}<button onClick={() => void loadAnnouncements()} className="ml-1 font-bold underline">Thử lại</button>
                    </div>
                ) : items.length === 0 ? (
                    <div className="p-5 text-center text-sm text-slate-500">Chưa có thông báo.</div>
                ) : (
                    <div className="space-y-1">
                        {items.map((item) => (
                            <button key={item.id} onClick={() => selectItem(item)} className={`w-full rounded-xl p-3 text-left ${form.id === item.id ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}`}>
                                <div className="truncate font-semibold">{item.bannerTitle || item.content || 'Không có tiêu đề'}</div>
                                <div className="mt-1 flex justify-between text-xs text-slate-500"><span>{item.effectiveStatus}</span><span>{item.audience}</span></div>
                            </button>
                        ))}
                    </div>
                )}
            </aside>

            <section className="min-w-0">
                <AnnouncementComposer
                    initialDraft={form}
                    saving={saving}
                    onChange={setForm}
                    onSaveDraft={async (draft) => { await save(draft); }}
                    onPublish={publish}
                    onSendTest={async () => { showSuccess('Bản xem thử đã sẵn sàng; chưa công bố thông báo.'); }}
                />
                {form.id && (
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <button disabled={saving} onClick={() => void runAction('cancel_announcement')} className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 font-semibold"><XCircle className="h-4 w-4" />Hủy lịch</button>
                        <button disabled={saving} onClick={() => void runAction('archive_announcement')} className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 font-semibold text-slate-700 hover:bg-slate-50"><Archive className="h-4 w-4" />Lưu trữ</button>
                    </div>
                )}
            </section>
        </div>

        <FeatureRolloutPanel />
    </div>;
};

export default AnnouncementSettings;

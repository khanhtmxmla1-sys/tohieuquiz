import React, { useEffect, useState } from 'react';
import Modal from '../../../components/common/Modal';
import type { UpdateCompetitionPublicPageRequest } from '../../../../schemas/competitionPortal.schema';
import type { StaffCompetitionPublicPageDto } from '../../../../shared/competition-portal.contract';
import { competitionPublicContentService } from './competitionPublicContentService';
import { createCompetitionPortalRequestId, formatPortalStatus } from './publicContentUtils';

interface PublicPageEditorProps {
  campaignId: string;
  isAdmin: boolean;
}

type PageDraft = {
  slug: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  summary: string;
  ctaLabel: string;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
};

type PageAction = 'publish' | 'archive';

const emptyToNull = (value: string) => value.trim() || null;

const toDraft = (page: StaffCompetitionPublicPageDto): PageDraft => ({
  slug: page.slug,
  heroTitle: page.heroTitle,
  heroSubtitle: page.heroSubtitle || '',
  heroImageUrl: page.heroImageUrl || '',
  summary: page.summary || '',
  ctaLabel: page.ctaLabel,
  seoTitle: page.seoTitle || '',
  seoDescription: page.seoDescription || '',
  ogImageUrl: page.ogImageUrl || '',
});

const inputClassName = 'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2';

const PublicPageEditor: React.FC<PublicPageEditorProps> = ({ campaignId, isAdmin }) => {
  const [page, setPage] = useState<StaffCompetitionPublicPageDto | null>(null);
  const [draft, setDraft] = useState<PageDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<StaffCompetitionPublicPageDto | null>(null);
  const [confirmAction, setConfirmAction] = useState<PageAction | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setMessage(null);
    setPage(null);
    setDraft(null);
    void competitionPublicContentService.getPublicPage(campaignId)
      .then(nextPage => {
        if (!active) return;
        setPage(nextPage);
        setDraft(nextPage ? toDraft(nextPage) : null);
      })
      .catch(() => {
        if (active) setError('Không thể tải trang công khai.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [campaignId]);

  const canEdit = isAdmin && page?.status === 'DRAFT' && Boolean(draft);

  const savePage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit || !draft) return;
    setPending('save');
    setError(null);
    setMessage(null);
    const payload: UpdateCompetitionPublicPageRequest = {
      slug: draft.slug.trim(),
      heroTitle: draft.heroTitle.trim(),
      heroSubtitle: emptyToNull(draft.heroSubtitle),
      heroImageUrl: emptyToNull(draft.heroImageUrl),
      summary: emptyToNull(draft.summary),
      ctaLabel: draft.ctaLabel.trim(),
      seoTitle: emptyToNull(draft.seoTitle),
      seoDescription: emptyToNull(draft.seoDescription),
      ogImageUrl: emptyToNull(draft.ogImageUrl),
      requestId: createCompetitionPortalRequestId('public-page-update'),
    };
    try {
      const updated = await competitionPublicContentService.updatePublicPage(campaignId, payload);
      setPage(updated);
      setDraft(toDraft(updated));
      setMessage('Đã lưu trang công khai.');
    } catch {
      setError('Không thể lưu trang công khai.');
    } finally {
      setPending(null);
    }
  };

  const previewPage = async () => {
    if (!isAdmin || page?.status !== 'DRAFT') return;
    setPending('preview');
    setError(null);
    try {
      const previewPageResult = await competitionPublicContentService.previewPublicPage(
        campaignId,
        createCompetitionPortalRequestId('public-page-preview'),
      );
      setPage(previewPageResult);
      setDraft(toDraft(previewPageResult));
      setPreview(previewPageResult);
    } catch {
      setError('Không thể tạo bản xem trước staff-only.');
    } finally {
      setPending(null);
    }
  };

  const confirmPageAction = async () => {
    if (!confirmAction) return;
    setPending(confirmAction);
    setError(null);
    try {
      const requestId = createCompetitionPortalRequestId(`public-page-${confirmAction}`);
      const updated = confirmAction === 'publish'
        ? await competitionPublicContentService.publishPublicPage(campaignId, requestId)
        : await competitionPublicContentService.archivePublicPage(campaignId, requestId);
      setPage(updated);
      setDraft(toDraft(updated));
      setMessage(confirmAction === 'publish' ? 'Đã công bố trang công khai.' : 'Đã lưu trữ trang công khai.');
      setConfirmAction(null);
    } catch {
      setError(confirmAction === 'publish' ? 'Không thể công bố trang công khai.' : 'Không thể lưu trữ trang công khai.');
    } finally {
      setPending(null);
    }
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4" aria-labelledby="public-page-editor-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="public-page-editor-title" className="text-lg font-bold text-slate-900">Trang công khai</h3>
          <p className="mt-1 text-sm text-slate-600">Nội dung hero, CTA và metadata SEO của chiến dịch.</p>
        </div>
        {page && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{formatPortalStatus(page.status)}</span>}
      </div>

      {loading && <p className="mt-4 text-sm text-slate-600">Đang tải trang công khai…</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {!loading && !page && <p className="mt-4 text-sm text-slate-600">Chiến dịch chưa có trang công khai.</p>}

      {page && draft && canEdit && (
        <form className="mt-4 space-y-3" onSubmit={savePage}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">Slug<input aria-label="Slug trang công khai" value={draft.slug} onChange={event => setDraft(current => current && ({ ...current, slug: event.target.value }))} className={inputClassName} /></label>
            <label className="text-xs font-semibold text-slate-700">Tiêu đề hero<input aria-label="Tiêu đề hero" value={draft.heroTitle} onChange={event => setDraft(current => current && ({ ...current, heroTitle: event.target.value }))} className={inputClassName} /></label>
            <label className="text-xs font-semibold text-slate-700">Phụ đề hero<input aria-label="Phụ đề hero" value={draft.heroSubtitle} onChange={event => setDraft(current => current && ({ ...current, heroSubtitle: event.target.value }))} className={inputClassName} /></label>
            <label className="text-xs font-semibold text-slate-700">Ảnh hero<input aria-label="Ảnh hero" value={draft.heroImageUrl} onChange={event => setDraft(current => current && ({ ...current, heroImageUrl: event.target.value }))} className={inputClassName} /></label>
            <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Tóm tắt<textarea aria-label="Tóm tắt trang công khai" value={draft.summary} onChange={event => setDraft(current => current && ({ ...current, summary: event.target.value }))} className={`${inputClassName} min-h-20`} /></label>
            <label className="text-xs font-semibold text-slate-700">Nhãn CTA<input aria-label="Nhãn CTA" value={draft.ctaLabel} onChange={event => setDraft(current => current && ({ ...current, ctaLabel: event.target.value }))} className={inputClassName} /></label>
            <label className="text-xs font-semibold text-slate-700">SEO title<input aria-label="SEO title" value={draft.seoTitle} onChange={event => setDraft(current => current && ({ ...current, seoTitle: event.target.value }))} className={inputClassName} /></label>
            <label className="text-xs font-semibold text-slate-700 sm:col-span-2">SEO description<textarea aria-label="SEO description" value={draft.seoDescription} onChange={event => setDraft(current => current && ({ ...current, seoDescription: event.target.value }))} className={`${inputClassName} min-h-20`} /></label>
            <label className="text-xs font-semibold text-slate-700 sm:col-span-2">OG image URL<input aria-label="OG image URL" value={draft.ogImageUrl} onChange={event => setDraft(current => current && ({ ...current, ogImageUrl: event.target.value }))} className={inputClassName} /></label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={Boolean(pending)} className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50">Lưu trang công khai</button>
            <button type="button" disabled={Boolean(pending)} onClick={() => void previewPage()} className="min-h-11 rounded-lg border border-indigo-300 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:opacity-50">Xem trước trang công khai</button>
          </div>
        </form>
      )}

      {page && !canEdit && (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold text-slate-500">Tiêu đề hero</dt><dd className="mt-1 text-slate-900">{page.heroTitle}</dd></div>
          <div><dt className="font-semibold text-slate-500">Slug</dt><dd className="mt-1 text-slate-900">{page.slug}</dd></div>
          <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">Tóm tắt</dt><dd className="mt-1 text-slate-900">{page.summary || '—'}</dd></div>
        </dl>
      )}

      {page && isAdmin && page.status === 'PREVIEW' && (
        <button type="button" disabled={Boolean(pending)} onClick={() => setConfirmAction('publish')} className="mt-4 min-h-11 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-50">Công bố trang công khai</button>
      )}
      {page && isAdmin && page.status === 'PUBLISHED' && (
        <button type="button" disabled={Boolean(pending)} onClick={() => setConfirmAction('archive')} className="mt-4 min-h-11 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 disabled:opacity-50">Lưu trữ trang công khai</button>
      )}

      <Modal isOpen={Boolean(preview)} onClose={() => setPreview(null)} title="Bản xem trước staff-only" description="Bản xem trước chỉ dành cho nhân sự quản trị; không thay đổi khả năng hiển thị ẩn danh." size="lg">
        {preview && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">{preview.status}</p>
            <h3 className="text-2xl font-bold text-slate-950">{preview.heroTitle}</h3>
            {preview.heroSubtitle && <p className="text-slate-700">{preview.heroSubtitle}</p>}
            {preview.summary && <p className="text-sm leading-6 text-slate-700">{preview.summary}</p>}
            <button type="button" onClick={() => setPreview(null)} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 focus-visible:ring-offset-2">Đóng xem trước</button>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        title={confirmAction === 'publish' ? 'Xác nhận công bố' : 'Xác nhận lưu trữ'}
        description={confirmAction === 'publish'
          ? 'Thao tác này đưa trang sang trạng thái PUBLISHED và cho phép cổng công khai hiển thị nội dung.'
          : 'Thao tác này đưa trang đã công bố sang trạng thái ARCHIVED.'}
        size="sm"
      >
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setConfirmAction(null)} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 focus-visible:ring-offset-2">Hủy</button>
          <button type="button" disabled={Boolean(pending)} onClick={() => void confirmPageAction()} className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50">
            {confirmAction === 'publish' ? 'Xác nhận công bố' : 'Xác nhận lưu trữ'}
          </button>
        </div>
      </Modal>
    </article>
  );
};

export default PublicPageEditor;

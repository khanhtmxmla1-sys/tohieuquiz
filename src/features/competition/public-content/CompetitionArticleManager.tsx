import React, { useEffect, useState } from 'react';
import Modal from '../../../components/common/Modal';
import { ApiError } from '../../../services/api/errors';
import type { CreateCompetitionArticleRequest, UpdateCompetitionArticleRequest } from '../../../../schemas/competitionPortal.schema';
import { COMPETITION_ARTICLE_TYPES, type CompetitionArticleType, type StaffCompetitionArticleDto } from '../../../../shared/competition-portal.contract';
import { competitionPublicContentService } from './competitionPublicContentService';
import { createCompetitionPortalRequestId } from './publicContentUtils';

interface CompetitionArticleManagerProps {
  campaignId: string;
  isAdmin: boolean;
}

type ArticleForm = {
  title: string;
  slug: string;
  summary: string;
  coverImageUrl: string;
  content: string;
  type: CompetitionArticleType;
};

type ArticleAction = 'publish' | 'archive';

type ArticleConfirmation = {
  action: ArticleAction;
  articleId: string;
};

const inputClassName = 'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

const shortenArticleId = (id: string): string => {
  const normalized = id.replace(/^competition-article-/, '');
  return normalized.length > 20 ? `${normalized.slice(0, 8)}…${normalized.slice(-4)}` : normalized;
};

const articleActionLabel = (action: ArticleAction): string => action === 'publish' ? 'công bố' : 'lưu trữ';

const isArticleConflict = (code: string): boolean => [
  'COMPETITION_ARTICLE_INVALID_TRANSITION',
  'COMPETITION_ARTICLE_NOT_DRAFT',
  'COMPETITION_ARTICLE_SLUG_CONFLICT',
  'COMPETITION_ARTICLE_STALE_WRITE',
].includes(code);

const articleActionErrorMessage = (error: unknown, action: ArticleAction): string => {
  const actionLabel = articleActionLabel(action);
  if (!(error instanceof ApiError)) return `Không thể ${actionLabel} bài viết.`;
  if (error.status === 503 || error.code === 'COMPETITION_PORTAL_FEATURE_DISABLED') {
    return `Tính năng ${actionLabel} bài viết đang tạm thời chưa khả dụng.`;
  }
  if (error.status === 401 || error.status === 403) {
    return `Bạn không có quyền ${actionLabel} bài viết.`;
  }
  if (error.status === 400 || error.code === 'COMPETITION_ARTICLE_NOT_READY') {
    return action === 'publish'
      ? 'Bài viết chưa đủ điều kiện công bố.'
      : 'Dữ liệu bài viết không hợp lệ để lưu trữ.';
  }
  if (error.status === 404 || error.code === 'COMPETITION_ARTICLE_NOT_FOUND') {
    return 'Không tìm thấy bài viết. Hãy tải lại danh sách rồi thử lại.';
  }
  if (error.status === 409 || isArticleConflict(error.code)) {
    return 'Bài viết đã thay đổi. Hãy tải lại danh sách rồi thử lại.';
  }
  if (error.status === 0 || error.code === 'NETWORK_ERROR') {
    return 'Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối rồi thử lại.';
  }
  return `Không thể ${actionLabel} bài viết.`;
};

const toForm = (article?: StaffCompetitionArticleDto): ArticleForm => ({
  title: article?.title || '',
  slug: article?.slug || '',
  summary: article?.summary || '',
  coverImageUrl: article?.coverImageUrl || '',
  content: article?.content || '',
  type: article?.type || 'ANNOUNCEMENT',
});

const isArticleFormDirty = (article: StaffCompetitionArticleDto, form?: ArticleForm): boolean => {
  if (!form) return false;
  const savedForm = toForm(article);
  return form.title !== savedForm.title
    || form.slug !== savedForm.slug
    || form.summary !== savedForm.summary
    || form.coverImageUrl !== savedForm.coverImageUrl
    || form.content !== savedForm.content
    || form.type !== savedForm.type;
};

const CompetitionArticleManager: React.FC<CompetitionArticleManagerProps> = ({ campaignId, isAdmin }) => {
  const [articles, setArticles] = useState<StaffCompetitionArticleDto[]>([]);
  const [newArticle, setNewArticle] = useState<ArticleForm>(toForm());
  const [editForms, setEditForms] = useState<Record<string, ArticleForm>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ArticleConfirmation | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void competitionPublicContentService.listArticles(campaignId)
      .then(nextArticles => {
        if (!active) return;
        setArticles(nextArticles);
        setEditForms(Object.fromEntries(nextArticles.map(article => [article.id, toForm(article)])));
      })
      .catch(() => {
        if (active) setError('Không thể tải danh sách bài viết.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [campaignId]);

  const createArticle = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isAdmin || !newArticle.title.trim() || !newArticle.slug.trim() || !newArticle.content.trim()) return;
    setPending('create');
    setError(null);
    setMessage(null);
    const payload: CreateCompetitionArticleRequest = {
      campaignId,
      title: newArticle.title.trim(),
      slug: newArticle.slug.trim(),
      summary: newArticle.summary.trim() || undefined,
      coverImageUrl: newArticle.coverImageUrl.trim() || undefined,
      content: newArticle.content,
      type: newArticle.type,
      status: 'DRAFT',
      requestId: createCompetitionPortalRequestId('article-create'),
    };
    try {
      const created = await competitionPublicContentService.createArticle(payload);
      setArticles(current => [...current, created]);
      setEditForms(current => ({ ...current, [created.id]: toForm(created) }));
      setNewArticle(toForm());
      setMessage('Đã tạo bài viết ở trạng thái DRAFT.');
    } catch {
      setError('Không thể tạo bài viết.');
    } finally {
      setPending(null);
    }
  };

  const requestArticleAction = (article: StaffCompetitionArticleDto, action: ArticleAction) => {
    const expectedStatus = action === 'publish' ? 'DRAFT' : 'PUBLISHED';
    if (!isAdmin || article.status !== expectedStatus) return;
    if (action === 'publish' && isArticleFormDirty(article, editForms[article.id])) return;
    setConfirmAction({ action, articleId: article.id });
  };

  const confirmArticleAction = async () => {
    if (!confirmAction) return;
    const article = articles.find(item => item.id === confirmAction.articleId);
    const expectedStatus = confirmAction.action === 'publish' ? 'DRAFT' : 'PUBLISHED';
    if (!article || article.status !== expectedStatus) {
      setConfirmAction(null);
      setError('Bài viết đã thay đổi. Hãy tải lại danh sách rồi thử lại.');
      return;
    }

    const { action, articleId } = confirmAction;
    setPending(`${action}-${articleId}`);
    setError(null);
    setMessage(null);
    try {
      const requestId = createCompetitionPortalRequestId(`article-${action}`);
      const updated = action === 'publish'
        ? await competitionPublicContentService.publishArticle(campaignId, articleId, requestId)
        : await competitionPublicContentService.archiveArticle(campaignId, articleId, requestId);
      setArticles(current => current.map(item => item.id === updated.id ? updated : item));
      setEditForms(current => ({ ...current, [updated.id]: toForm(updated) }));
      setMessage(action === 'publish' ? 'Đã công bố bài viết.' : 'Đã lưu trữ bài viết.');
      setConfirmAction(null);
    } catch (actionError) {
      setError(articleActionErrorMessage(actionError, action));
    } finally {
      setPending(null);
    }
  };

  const updateArticle = async (event: React.FormEvent, article: StaffCompetitionArticleDto) => {
    event.preventDefault();
    const form = editForms[article.id];
    if (!isAdmin || article.status !== 'DRAFT' || !form) return;
    setPending(`update-${article.id}`);
    setError(null);
    setMessage(null);
    const payload: UpdateCompetitionArticleRequest = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      summary: form.summary.trim() || null,
      coverImageUrl: form.coverImageUrl.trim() || null,
      content: form.content,
      type: form.type,
      requestId: createCompetitionPortalRequestId('article-update'),
    };
    try {
      const updated = await competitionPublicContentService.updateArticle(campaignId, article.id, payload);
      setArticles(current => current.map(item => item.id === updated.id ? updated : item));
      setEditForms(current => ({ ...current, [updated.id]: toForm(updated) }));
      setMessage('Đã lưu bài viết.');
    } catch {
      setError('Không thể lưu bài viết.');
    } finally {
      setPending(null);
    }
  };

  const setNewField = <K extends keyof ArticleForm>(field: K, value: ArticleForm[K]) => {
    setNewArticle(current => ({ ...current, [field]: value }));
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4" aria-labelledby="competition-article-manager-title">
      <h3 id="competition-article-manager-title" className="text-lg font-bold text-slate-900">Bài viết công khai</h3>
      <p className="mt-1 text-sm text-slate-600">Quản lý metadata và nội dung bài viết thuộc chiến dịch.</p>
      {loading && <p className="mt-4 text-sm text-slate-600">Đang tải bài viết…</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

      <div className="mt-4 space-y-3">
        {articles.length === 0 && !loading && <p className="text-sm text-slate-600">Chưa có bài viết.</p>}
        {articles.map(article => {
          const form = editForms[article.id];
          const shortId = shortenArticleId(article.id);
          const isDirty = article.status === 'DRAFT' && isArticleFormDirty(article, form);
          return (
            <div key={article.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-semibold text-slate-900">{article.title}</p><p className="text-xs text-slate-500">{article.type} · {article.status} · {shortId}</p></div>
              </div>
              {article.status !== 'DRAFT' || !isAdmin || !form ? (
                <div className="mt-2 space-y-3">
                  <p className="text-sm text-slate-600">{article.summary || 'Không có tóm tắt.'}</p>
                  {article.status === 'PUBLISHED' && isAdmin && (
                    <button
                      type="button"
                      disabled={Boolean(pending)}
                      onClick={() => requestArticleAction(article, 'archive')}
                      className="min-h-11 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-700 disabled:opacity-50"
                    >
                      Lưu trữ bài viết
                    </button>
                  )}
                </div>
              ) : (
                <form className="mt-3 space-y-3" onSubmit={event => void updateArticle(event, article)}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-slate-700">Tiêu đề bài viết ({shortId})<input aria-label={`Tiêu đề bài viết (${shortId})`} value={form.title} onChange={event => setEditForms(current => ({ ...current, [article.id]: { ...form, title: event.target.value } }))} className={inputClassName} /></label>
                    <label className="text-xs font-semibold text-slate-700">Slug bài viết ({shortId})<input aria-label={`Slug bài viết (${shortId})`} value={form.slug} onChange={event => setEditForms(current => ({ ...current, [article.id]: { ...form, slug: event.target.value } }))} className={inputClassName} /></label>
                    <label className="text-xs font-semibold text-slate-700">Loại bài viết ({shortId})<select aria-label={`Loại bài viết (${shortId})`} value={form.type} onChange={event => setEditForms(current => ({ ...current, [article.id]: { ...form, type: event.target.value as CompetitionArticleType } }))} className={inputClassName}>{COMPETITION_ARTICLE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
                    <label className="text-xs font-semibold text-slate-700">Ảnh bìa bài viết ({shortId})<input aria-label={`Ảnh bìa bài viết (${shortId})`} value={form.coverImageUrl} onChange={event => setEditForms(current => ({ ...current, [article.id]: { ...form, coverImageUrl: event.target.value } }))} className={inputClassName} /></label>
                    <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Tóm tắt bài viết ({shortId})<textarea aria-label={`Tóm tắt bài viết (${shortId})`} value={form.summary} onChange={event => setEditForms(current => ({ ...current, [article.id]: { ...form, summary: event.target.value } }))} className={`${inputClassName} min-h-16`} /></label>
                    <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Nội dung bài viết ({shortId})<textarea aria-label={`Nội dung bài viết (${shortId})`} value={form.content} onChange={event => setEditForms(current => ({ ...current, [article.id]: { ...form, content: event.target.value } }))} className={`${inputClassName} min-h-24`} /></label>
                  </div>
                  {isDirty && <p role="status" className="text-sm text-amber-800">Lưu bài viết trước khi công bố.</p>}
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={Boolean(pending)} className="min-h-11 rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">Lưu bài viết ({shortId})</button>
                    <button type="button" disabled={Boolean(pending) || isDirty} onClick={() => requestArticleAction(article, 'publish')} className="min-h-11 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Công bố bài viết</button>
                  </div>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <form className="mt-4 space-y-3 rounded-lg border border-dashed border-slate-300 bg-white p-3" onSubmit={createArticle}>
          <h4 className="font-semibold text-slate-900">Tạo bài viết mới</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">Tiêu đề<input aria-label="Tiêu đề bài viết mới" value={newArticle.title} onChange={event => setNewField('title', event.target.value)} className={inputClassName} /></label>
            <label className="text-xs font-semibold text-slate-700">Slug<input aria-label="Slug bài viết mới" value={newArticle.slug} onChange={event => setNewField('slug', event.target.value)} className={inputClassName} /></label>
            <label className="text-xs font-semibold text-slate-700">Loại<select aria-label="Loại bài viết mới" value={newArticle.type} onChange={event => setNewField('type', event.target.value as CompetitionArticleType)} className={inputClassName}>{COMPETITION_ARTICLE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-700">Ảnh bìa<input aria-label="Ảnh bìa bài viết mới" value={newArticle.coverImageUrl} onChange={event => setNewField('coverImageUrl', event.target.value)} className={inputClassName} /></label>
            <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Tóm tắt<textarea aria-label="Tóm tắt bài viết mới" value={newArticle.summary} onChange={event => setNewField('summary', event.target.value)} className={`${inputClassName} min-h-16`} /></label>
            <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Nội dung<textarea aria-label="Nội dung bài viết mới" value={newArticle.content} onChange={event => setNewField('content', event.target.value)} className={`${inputClassName} min-h-24`} /></label>
          </div>
          <button type="submit" disabled={Boolean(pending) || !newArticle.title.trim() || !newArticle.slug.trim() || !newArticle.content.trim()} className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Tạo bài viết</button>
        </form>
      )}

      <Modal
        isOpen={Boolean(confirmAction)}
        onClose={() => { if (!pending) setConfirmAction(null); }}
        title={confirmAction?.action === 'publish' ? 'Xác nhận công bố bài viết' : 'Xác nhận lưu trữ bài viết'}
        description={confirmAction?.action === 'publish'
          ? 'Nội dung bài viết hiện tại sẽ được công khai cho người đọc.'
          : 'Bài viết sẽ không còn xuất hiện trên cổng công khai sau khi lưu trữ.'}
        size="sm"
      >
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" disabled={Boolean(pending)} onClick={() => setConfirmAction(null)} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Hủy</button>
          <button type="button" disabled={Boolean(pending)} onClick={() => void confirmArticleAction()} className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {confirmAction?.action === 'publish' ? 'Xác nhận công bố bài viết' : 'Xác nhận lưu trữ bài viết'}
          </button>
        </div>
      </Modal>
    </article>
  );
};

export default CompetitionArticleManager;

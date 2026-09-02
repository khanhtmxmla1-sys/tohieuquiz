import React, { useEffect, useState } from 'react';
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

const inputClassName = 'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

const toForm = (article?: StaffCompetitionArticleDto): ArticleForm => ({
  title: article?.title || '',
  slug: article?.slug || '',
  summary: article?.summary || '',
  coverImageUrl: article?.coverImageUrl || '',
  content: article?.content || '',
  type: article?.type || 'ANNOUNCEMENT',
});

const CompetitionArticleManager: React.FC<CompetitionArticleManagerProps> = ({ campaignId, isAdmin }) => {
  const [articles, setArticles] = useState<StaffCompetitionArticleDto[]>([]);
  const [newArticle, setNewArticle] = useState<ArticleForm>(toForm());
  const [editForms, setEditForms] = useState<Record<string, ArticleForm>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
          return (
            <div key={article.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-semibold text-slate-900">{article.title}</p><p className="text-xs text-slate-500">{article.type} · {article.status}</p></div>
              </div>
              {article.status !== 'DRAFT' || !isAdmin || !form ? (
                <p className="mt-2 text-sm text-slate-600">{article.summary || 'Không có tóm tắt.'}</p>
              ) : (
                <form className="mt-3 space-y-3" onSubmit={event => void updateArticle(event, article)}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-slate-700">Tiêu đề bài viết {article.id}<input aria-label={`Tiêu đề bài viết ${article.id}`} value={form.title} onChange={event => setEditForms(current => ({ ...current, [article.id]: { ...form, title: event.target.value } }))} className={inputClassName} /></label>
                    <label className="text-xs font-semibold text-slate-700">Slug bài viết {article.id}<input aria-label={`Slug bài viết ${article.id}`} value={form.slug} onChange={event => setEditForms(current => ({ ...current, [article.id]: { ...form, slug: event.target.value } }))} className={inputClassName} /></label>
                    <label className="text-xs font-semibold text-slate-700">Loại bài viết {article.id}<select aria-label={`Loại bài viết ${article.id}`} value={form.type} onChange={event => setEditForms(current => ({ ...current, [article.id]: { ...form, type: event.target.value as CompetitionArticleType } }))} className={inputClassName}>{COMPETITION_ARTICLE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
                    <label className="text-xs font-semibold text-slate-700">Ảnh bìa bài viết {article.id}<input aria-label={`Ảnh bìa bài viết ${article.id}`} value={form.coverImageUrl} onChange={event => setEditForms(current => ({ ...current, [article.id]: { ...form, coverImageUrl: event.target.value } }))} className={inputClassName} /></label>
                    <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Tóm tắt bài viết {article.id}<textarea aria-label={`Tóm tắt bài viết ${article.id}`} value={form.summary} onChange={event => setEditForms(current => ({ ...current, [article.id]: { ...form, summary: event.target.value } }))} className={`${inputClassName} min-h-16`} /></label>
                    <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Nội dung bài viết {article.id}<textarea aria-label={`Nội dung bài viết ${article.id}`} value={form.content} onChange={event => setEditForms(current => ({ ...current, [article.id]: { ...form, content: event.target.value } }))} className={`${inputClassName} min-h-24`} /></label>
                  </div>
                  <button type="submit" disabled={Boolean(pending)} className="min-h-11 rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">Lưu bài viết {article.id}</button>
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
    </article>
  );
};

export default CompetitionArticleManager;

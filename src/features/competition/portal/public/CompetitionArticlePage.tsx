import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import type { PublicCompetitionArticleDto } from '../../../../../shared/competition-portal.contract';
import CompetitionMarkdown from './CompetitionMarkdown';
import CompetitionPublicShell from './CompetitionPublicShell';
import { publicCompetitionPortalService } from './publicCompetitionPortalService';

const getPathSegments = (pathname: string): { campaignSlug?: string; articleSlug?: string } => {
  const match = pathname.match(/^\/cuoc-thi\/([^/]+)\/tin-tuc\/([^/]+)(?:\/|$)/);
  if (!match) return {};
  try {
    return { campaignSlug: decodeURIComponent(match[1]), articleSlug: decodeURIComponent(match[2]) };
  } catch {
    return { campaignSlug: match[1], articleSlug: match[2] };
  }
};

const CompetitionArticlePage = () => {
  const { campaignSlug: routeCampaignSlug, articleSlug: routeArticleSlug } = useParams<{
    campaignSlug?: string;
    articleSlug?: string;
  }>();
  const pathSegments = getPathSegments(useLocation().pathname);
  const campaignSlug = routeCampaignSlug ?? pathSegments.campaignSlug;
  const articleSlug = routeArticleSlug ?? pathSegments.articleSlug;
  const [article, setArticle] = useState<PublicCompetitionArticleDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    setArticle(null);

    if (!campaignSlug || !articleSlug) {
      setLoading(false);
      setFailed(true);
      return () => {
        active = false;
      };
    }

    void publicCompetitionPortalService.getArticle(campaignSlug, articleSlug)
      .then((nextArticle) => {
        if (!active) return;
        setArticle(nextArticle);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [articleSlug, campaignSlug]);

  return (
    <CompetitionPublicShell campaignSlug={campaignSlug}>
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
        {loading && <p role="status" aria-live="polite">Đang tải tin tức…</p>}

        {failed && (
          <section role="alert" className="rounded-2xl border border-rose-200 bg-white p-6">
            Không tìm thấy tin tức hoặc tin tức tạm thời chưa khả dụng.
          </section>
        )}

        {!loading && !failed && article && (
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-bold uppercase tracking-wider text-sky-700">{article.type}</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">{article.title}</h1>
            {article.coverImageUrl && (
              <img
                className="mt-6 max-h-96 w-full rounded-2xl object-cover"
                src={article.coverImageUrl}
                alt={article.title}
              />
            )}
            <div className="mt-8">
              <CompetitionMarkdown source={article.content} />
            </div>
          </article>
        )}
      </div>
    </CompetitionPublicShell>
  );
};

export default CompetitionArticlePage;

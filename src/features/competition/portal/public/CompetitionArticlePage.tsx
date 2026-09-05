import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import type { PublicCompetitionArticleDto } from '../../../../../shared/competition-portal.contract';
import CompetitionArticleView from './CompetitionArticleView';
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

  if (!loading && !failed && article && campaignSlug) {
    return <CompetitionArticleView article={article} campaignSlug={campaignSlug} />;
  }

  return (
    <CompetitionPublicShell campaignSlug={campaignSlug}>
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-16 sm:px-6">
        {loading && (
          <p role="status" aria-live="polite" className="rounded-3xl border border-blue-100 bg-white p-8 text-center font-semibold text-slate-600 shadow-sm">
            Đang tải tin tức…
          </p>
        )}

        {failed && (
          <section role="alert" className="rounded-3xl border border-rose-200 bg-white p-8 text-center text-slate-700 shadow-sm">
            Không tìm thấy tin tức hoặc tin tức tạm thời chưa khả dụng.
          </section>
        )}
      </div>
    </CompetitionPublicShell>
  );
};

export default CompetitionArticlePage;

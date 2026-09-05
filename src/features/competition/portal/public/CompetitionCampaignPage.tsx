import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import type { PublicCompetitionDetailDto } from '../../../../../shared/competition-portal.contract';
import CompetitionCampaignView from './CompetitionCampaignView';
import CompetitionPublicShell from './CompetitionPublicShell';
import { publicCompetitionPortalService } from './publicCompetitionPortalService';

const getPathSegment = (pathname: string, pattern: RegExp): string | undefined => {
  const match = pathname.match(pattern);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const CompetitionCampaignPage = () => {
  const { campaignSlug: routeCampaignSlug } = useParams<{ campaignSlug?: string }>();
  const { pathname } = useLocation();
  const campaignSlug = routeCampaignSlug ?? getPathSegment(pathname, /^\/cuoc-thi\/([^/]+)(?:\/|$)/);
  const [campaign, setCampaign] = useState<PublicCompetitionDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    setCampaign(null);

    if (!campaignSlug) {
      setLoading(false);
      setFailed(true);
      return () => {
        active = false;
      };
    }

    void publicCompetitionPortalService.getCompetition(campaignSlug)
      .then((nextCampaign) => {
        if (!active) return;
        setCampaign(nextCampaign);
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
  }, [campaignSlug]);

  if (!loading && !failed && campaign) return <CompetitionCampaignView campaign={campaign} />;

  return (
    <CompetitionPublicShell campaignSlug={campaignSlug}>
      {loading && (
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <p role="status" aria-live="polite" className="rounded-3xl border border-blue-100 bg-white p-8 text-center font-semibold text-slate-600 shadow-sm">
            Đang tải thông tin cuộc thi…
          </p>
        </div>
      )}
      {failed && (
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <section role="alert" className="rounded-3xl border border-rose-200 bg-white p-8 text-center text-slate-700 shadow-sm">
            Không tìm thấy cuộc thi hoặc cuộc thi tạm thời chưa khả dụng.
          </section>
        </div>
      )}
    </CompetitionPublicShell>
  );
};

export default CompetitionCampaignPage;

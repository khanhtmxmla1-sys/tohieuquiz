import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import type { PublicGoldenBoardDto } from '../../../../../shared/competition-portal.contract';
import CompetitionGoldenBoardView from './CompetitionGoldenBoardView';
import { publicCompetitionPortalService } from './publicCompetitionPortalService';

const getCampaignSlugFromPath = (pathname: string): string | undefined => {
  const match = pathname.match(/^\/cuoc-thi\/([^/]+)(?:\/|$)/);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const CompetitionGoldenBoardPage = () => {
  const { campaignSlug: routeCampaignSlug } = useParams<{ campaignSlug?: string }>();
  const { pathname } = useLocation();
  const campaignSlug = routeCampaignSlug ?? getCampaignSlugFromPath(pathname);
  const [board, setBoard] = useState<PublicGoldenBoardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const requestIdRef = useRef(0);

  const loadBoard = useCallback(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setFailed(false);

    if (!campaignSlug) {
      setBoard(null);
      setLoading(false);
      setFailed(true);
      return;
    }

    void publicCompetitionPortalService.getGoldenBoard(campaignSlug)
      .then((nextBoard) => {
        if (requestId !== requestIdRef.current) return;
        setBoard(nextBoard);
        setLoading(false);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setBoard(null);
        setFailed(true);
        setLoading(false);
      });
  }, [campaignSlug]);

  useEffect(() => {
    setBoard(null);
    loadBoard();
    return () => {
      requestIdRef.current += 1;
    };
  }, [loadBoard]);

  return (
    <CompetitionGoldenBoardView
      board={board}
      campaignSlug={campaignSlug}
      failed={failed}
      loading={loading}
      onReload={loadBoard}
    />
  );
};

export default CompetitionGoldenBoardPage;

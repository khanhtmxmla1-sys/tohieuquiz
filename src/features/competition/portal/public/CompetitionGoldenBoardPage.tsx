import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import type {
  PublicGoldenBoardDto,
  PublicGoldenBoardWinnerDto,
} from '../../../../../shared/competition-portal.contract';
import CompetitionPublicShell from './CompetitionPublicShell';
import { publicCompetitionPortalService } from './publicCompetitionPortalService';

interface AwardGroup {
  awardCode: string;
  awardLabel: string;
  winners: PublicGoldenBoardWinnerDto[];
}

const getCampaignSlugFromPath = (pathname: string): string | undefined => {
  const match = pathname.match(/^\/cuoc-thi\/([^/]+)(?:\/|$)/);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const groupWinners = (winners: PublicGoldenBoardWinnerDto[]): AwardGroup[] => {
  const groups = new Map<string, AwardGroup>();
  winners.forEach((winner) => {
    const key = `${winner.awardCode}\u0000${winner.awardLabel}`;
    const group = groups.get(key);
    if (group) {
      group.winners.push(winner);
      return;
    }
    groups.set(key, {
      awardCode: winner.awardCode,
      awardLabel: winner.awardLabel,
      winners: [winner],
    });
  });
  return [...groups.values()];
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

  const awardGroups = board ? groupWinners(board.winners) : [];

  return (
    <CompetitionPublicShell campaignSlug={campaignSlug}>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
        <header className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-700">Vinh danh chính thức</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">Bảng vàng</h1>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-700">
            Những học sinh đạt giải trong kỳ thi được công bố chính thức.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={campaignSlug ? `/cuoc-thi/${encodeURIComponent(campaignSlug)}` : '/cuoc-thi'}
              className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-bold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
            >
              Quay lại cuộc thi
            </Link>
            <button
              type="button"
              onClick={loadBoard}
              disabled={loading}
              className="inline-flex min-h-11 items-center rounded-xl bg-sky-700 px-5 py-2.5 font-extrabold text-white disabled:cursor-wait disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
              aria-label="Tải lại bảng vàng"
            >
              Tải lại
            </button>
          </div>
        </header>

        {loading && <p role="status" aria-live="polite">Đang tải bảng vàng…</p>}

        {failed && (
          <section role="alert" className="rounded-2xl border border-rose-200 bg-white p-6">
            Không tìm thấy bảng vàng hoặc bảng vàng tạm thời chưa khả dụng.
          </section>
        )}

        {!loading && !failed && board && board.winners.length === 0 && (
          <p role="status" aria-live="polite" className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">
            Bảng vàng chưa có danh sách được công bố.
          </p>
        )}

        {!loading && !failed && board && board.winners.length > 0 && (
          <div className="space-y-6">
            {awardGroups.map((group, groupIndex) => {
              const headingId = `golden-board-award-${groupIndex}`;
              return (
                <section
                  key={`${group.awardCode}-${group.awardLabel}`}
                  role="region"
                  aria-labelledby={headingId}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
                >
                  <h2 id={headingId} className="text-2xl font-black text-slate-900">{group.awardLabel}</h2>
                  <ul className="mt-5 grid gap-4 md:grid-cols-2">
                    {group.winners.map((winner, winnerIndex) => (
                      <li key={`${winner.fullName}-${winner.className}-${winnerIndex}`}>
                        <article className="h-full rounded-2xl border border-amber-100 bg-amber-50/60 p-5">
                          <h3 className="text-xl font-extrabold text-slate-900">{winner.fullName}</h3>
                          <dl className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
                            <div>
                              <dt className="font-bold text-slate-500">Lớp</dt>
                              <dd>{winner.className}</dd>
                            </div>
                            <div>
                              <dt className="font-bold text-slate-500">Trường</dt>
                              <dd>{winner.schoolName}</dd>
                            </div>
                            <div>
                              <dt className="font-bold text-slate-500">Khối</dt>
                              <dd>{winner.gradeLevel}</dd>
                            </div>
                          </dl>
                        </article>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </CompetitionPublicShell>
  );
};

export default CompetitionGoldenBoardPage;

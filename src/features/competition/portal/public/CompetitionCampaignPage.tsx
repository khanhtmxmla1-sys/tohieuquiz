import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import type {
  PublicCompetitionArticleDto,
  PublicCompetitionDetailDto,
  PublicCompetitionRoundDto,
} from '../../../../../shared/competition-portal.contract';
import CompetitionPublicShell from './CompetitionPublicShell';
import { publicCompetitionPortalService } from './publicCompetitionPortalService';

const publicArticleTypes: PublicCompetitionArticleDto['type'][] = [
  'SCHEDULE',
  'RULES',
  'GUIDE',
  'ANNOUNCEMENT',
  'RESULT',
  'AWARD',
  'CERTIFICATE',
  'INCIDENT_NOTICE',
];

const getPathSegment = (pathname: string, pattern: RegExp): string | undefined => {
  const match = pathname.match(pattern);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const getSixRounds = (rounds: PublicCompetitionRoundDto[]): PublicCompetitionRoundDto[] => (
  Array.from({ length: 6 }, (_, index) => rounds[index] ?? ({
    roundNumber: index + 1,
    title: `Vòng ${index + 1}`,
    opensAt: '',
    closesAt: '',
    state: 'LOCKED',
  }))
);

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

  const articleGroups = campaign
    ? publicArticleTypes
      .map((type) => ({
        type,
        articles: campaign.articles.filter((article) => article.type === type),
      }))
      .filter((group) => group.articles.length > 0)
    : [];

  return (
    <CompetitionPublicShell campaignSlug={campaign?.slug}>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6">
        {loading && <p role="status" aria-live="polite">Đang tải thông tin cuộc thi…</p>}

        {failed && (
          <section role="alert" className="rounded-2xl border border-rose-200 bg-white p-6">
            Không tìm thấy cuộc thi hoặc cuộc thi tạm thời chưa khả dụng.
          </section>
        )}

        {!loading && !failed && campaign && (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              {campaign.hero.imageUrl && (
                <img
                  className="mb-6 max-h-96 w-full rounded-2xl object-cover"
                  src={campaign.hero.imageUrl}
                  alt={campaign.hero.title}
                />
              )}
              <p className="text-2xl font-black tracking-tight text-slate-900">{campaign.hero.title}</p>
              {campaign.hero.subtitle && (
                <p className="mt-2 text-lg text-slate-600">{campaign.hero.subtitle}</p>
              )}
              <p className="text-sm font-bold uppercase tracking-wider text-sky-700">Sân chơi công khai</p>
              <h1 className="mt-2 text-4xl font-black tracking-tight">{campaign.title}</h1>
              <p className="mt-3 font-semibold text-slate-600">Năm học {campaign.schoolYear}</p>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-700">{campaign.summary}</p>
              <Link
                to={`/thi/${encodeURIComponent(campaign.slug)}`}
                className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-sky-700 px-6 py-3 font-extrabold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
              >
                {campaign.cta.label}
              </Link>
            </section>

            <section aria-label="Hành trình 6 vòng" className="rounded-3xl bg-slate-900 p-6 text-white sm:p-8">
              <h2 className="text-3xl font-black">Hành trình 6 vòng</h2>
              <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {getSixRounds(campaign.rounds).map((round) => (
                  <li key={round.roundNumber} className="rounded-2xl border border-white/15 bg-white/5 p-4">
                    <span className="text-sm font-bold text-sky-300">Vòng {round.roundNumber}</span>
                    <p className="mt-1 font-semibold">{round.title}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section id="tin-tuc" aria-labelledby="public-articles-title" className="space-y-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-sky-700">Tin tức công khai</p>
                <h2 id="public-articles-title" className="mt-1 text-2xl font-extrabold">Thông tin cuộc thi</h2>
              </div>
              {articleGroups.map((group) => (
                <section key={group.type} aria-labelledby={`articles-${group.type.toLowerCase()}`} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 id={`articles-${group.type.toLowerCase()}`} className="text-lg font-extrabold">{group.type}</h3>
                  <ul className="mt-3 space-y-3">
                    {group.articles.map((article) => (
                      <li key={article.slug}>
                        <Link
                          to={`/cuoc-thi/${encodeURIComponent(campaign.slug)}/tin-tuc/${encodeURIComponent(article.slug)}`}
                          className="inline-flex min-h-11 items-center rounded font-bold text-sky-800 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
                        >
                          {article.title}
                        </Link>
                        <p className="mt-1 text-sm text-slate-600">{article.summary}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </section>

            {campaign.goldenBoardAvailable && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                <Link
                  to={`/cuoc-thi/${encodeURIComponent(campaign.slug)}/bang-vang`}
                  className="inline-flex min-h-11 items-center rounded font-extrabold text-amber-900 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
                >
                  Bảng vàng
                </Link>
              </section>
            )}
          </>
        )}
      </div>
    </CompetitionPublicShell>
  );
};

export default CompetitionCampaignPage;

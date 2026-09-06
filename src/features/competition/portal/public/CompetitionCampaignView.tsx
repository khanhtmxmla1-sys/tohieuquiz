import { useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Medal,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router';
import type {
  PublicCompetitionArticleDto,
  PublicCompetitionDetailDto,
  PublicCompetitionRoundDto,
} from '../../../../../shared/competition-portal.contract';
import { formatSystemDateTimeWithOptions } from '../../../../utils/dateTime';
import CompetitionPublicShell from './CompetitionPublicShell';
import {
  ArticleTypeIcon,
  CompetitionConstellation,
  LearningSeal,
  PublicStateBadge,
  RoundStateBadge,
  SectionEyebrow,
  articleTypePresentation,
} from './CompetitionPublicDesign';

interface CompetitionCampaignViewProps {
  campaign: PublicCompetitionDetailDto;
}

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

const formatPublicDateTime = (value: string): string => formatSystemDateTimeWithOptions(value, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const getSixRounds = (rounds: PublicCompetitionRoundDto[]): PublicCompetitionRoundDto[] => (
  Array.from({ length: 6 }, (_, index) => rounds[index] ?? ({
    roundNumber: index + 1,
    title: `Vòng ${index + 1}`,
    opensAt: '',
    closesAt: '',
    state: 'LOCKED',
  }))
);

const getArticleSectionId = (type: PublicCompetitionArticleDto['type']): string => {
  if (type === 'SCHEDULE') return 'cap-nhat-lich-thi';
  if (type === 'ANNOUNCEMENT') return 'tin-moi';
  return articleTypePresentation[type].sectionId;
};

const getArticleGroupLabel = (type: PublicCompetitionArticleDto['type']): string => (
  type === 'SCHEDULE' ? 'Cập nhật lịch thi' : articleTypePresentation[type].label
);

const CompetitionCampaignView = ({ campaign }: CompetitionCampaignViewProps) => {
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const articleGroups = publicArticleTypes
    .map((type) => ({
      type,
      articles: campaign.articles.filter((article) => article.type === type),
    }))
    .filter((group) => group.articles.length > 0);
  const rounds = getSixRounds(campaign.rounds);
  const showHeroImage = Boolean(campaign.hero.imageUrl && !heroImageFailed);

  return (
    <CompetitionPublicShell campaignSlug={campaign.slug}>
      <section aria-labelledby="campaign-hero-title" className="relative isolate overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-cyan-800 text-white">
        <CompetitionConstellation />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-20">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <PublicStateBadge state={campaign.publicState} />
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-cyan-100">Năm học {campaign.schoolYear}</span>
            </div>
            <h1 id="campaign-hero-title" className="mt-6 max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">{campaign.title}</h1>
            <h2 className="mt-4 text-2xl font-black text-amber-300 sm:text-3xl">{campaign.hero.title}</h2>
            {campaign.hero.subtitle && <p className="mt-3 max-w-2xl text-lg leading-8 text-cyan-100">{campaign.hero.subtitle}</p>}
            <p className="mt-5 max-w-2xl leading-8 text-blue-100/85">{campaign.summary}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={`/thi/${encodeURIComponent(campaign.slug)}`}
                className="group inline-flex min-h-12 items-center gap-2 rounded-2xl bg-amber-400 px-7 py-3 font-black text-blue-950 shadow-xl shadow-blue-950/25 transition hover:-translate-y-0.5 hover:bg-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-950 motion-reduce:transform-none"
              >
                {campaign.cta.label}
                <ArrowRight className="size-5 transition group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
              </Link>
              <a
                href="#lich-thi"
                className="inline-flex min-h-12 items-center rounded-2xl border border-white/25 bg-white/10 px-6 py-3 font-bold text-white backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-950"
              >
                Xem lịch thi
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            {showHeroImage ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-2 shadow-2xl">
                <img
                  className="h-full w-full rounded-[1.6rem] object-cover"
                  src={campaign.hero.imageUrl}
                  alt={campaign.hero.title}
                  width="1200"
                  height="900"
                  onError={() => setHeroImageFailed(true)}
                />
                <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-blue-950/75 p-4 backdrop-blur-md">
                  <p className="flex items-center gap-2 font-extrabold text-white"><Sparkles className="size-5 text-amber-300" aria-hidden="true" /> Học hỏi · Tự tin · Tỏa sáng</p>
                </div>
              </div>
            ) : (
              <div
                role="img"
                aria-label={`Hình minh họa ${campaign.hero.title}`}
                className="flex aspect-[4/3] flex-col items-center justify-center gap-5 rounded-[2rem] border border-white/20 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-sm"
              >
                <LearningSeal />
                <span className="text-sm font-bold text-cyan-100">Học hỏi · Tự tin · Tỏa sáng</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <nav aria-label="Khám phá cuộc thi" className="relative z-10 mx-auto -mt-6 flex max-w-5xl flex-wrap justify-center gap-2 rounded-3xl border border-blue-100 bg-white p-3 shadow-xl shadow-blue-950/5 sm:p-4">
        <a href="#lich-thi" className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 py-2 font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><CalendarDays className="size-4" aria-hidden="true" />Lịch thi</a>
        <a href="#tin-tuc" className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 py-2 font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><Sparkles className="size-4" aria-hidden="true" />Tin mới</a>
        <a href="#six-round-journey" className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 py-2 font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><Medal className="size-4" aria-hidden="true" />Hành trình</a>
      </nav>

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-14 sm:px-6 lg:px-8">
        <section id="lich-thi" aria-labelledby="campaign-schedule-title" className="scroll-mt-36">
          <SectionEyebrow>Mốc thời gian chính thức</SectionEyebrow>
          <h2 id="campaign-schedule-title" className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Lịch thi</h2>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-600">Theo dõi từng vòng để chủ động chuẩn bị và tham gia đúng thời gian.</p>
          <ol className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rounds.map((round) => (
              <li key={round.roundNumber} className="relative overflow-hidden rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
                <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-blue-600 to-cyan-400" aria-hidden="true" />
                <div className="flex items-start justify-between gap-4 pl-2">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-blue-600">Vòng {round.roundNumber}</span>
                    <h3 className="mt-1 text-xl font-black text-slate-900">{round.title}</h3>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><CalendarDays className="size-5" aria-hidden="true" /></span>
                    <RoundStateBadge state={round.state} />
                  </div>
                </div>
                {round.opensAt && round.closesAt && (
                  <dl className="mt-5 grid gap-3 pl-2 text-sm">
                    <div className="rounded-2xl bg-blue-50/70 p-3">
                      <dt className="font-bold text-slate-500">Mở vòng</dt>
                      <dd className="mt-1 font-bold text-slate-800"><time dateTime={round.opensAt}>{formatPublicDateTime(round.opensAt)}</time></dd>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <dt className="font-bold text-slate-500">Kết thúc</dt>
                      <dd className="mt-1 font-bold text-slate-800"><time dateTime={round.closesAt}>{formatPublicDateTime(round.closesAt)}</time></dd>
                    </div>
                  </dl>
                )}
              </li>
            ))}
          </ol>
        </section>

        <section id="six-round-journey" aria-label="Hành trình 6 vòng" className="relative isolate scroll-mt-36 overflow-hidden rounded-[2rem] bg-blue-950 p-7 text-white sm:p-10">
          <CompetitionConstellation />
          <div className="relative">
            <SectionEyebrow tone="light">Sáu dấu mốc trưởng thành</SectionEyebrow>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">Hành trình 6 vòng</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rounds.map((round) => (
                <li key={round.roundNumber} className="rounded-2xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-blue-400 text-xl font-black text-blue-950">{round.roundNumber}</span>
                    <RoundStateBadge state={round.state} />
                  </div>
                  <p className="mt-4 font-extrabold">{round.title}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="tin-tuc" aria-labelledby="public-articles-title" className="scroll-mt-36">
          <SectionEyebrow>Thông tin đồng hành</SectionEyebrow>
          <h2 id="public-articles-title" className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Thông tin cuộc thi</h2>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-600">Lịch thi, thể lệ và hướng dẫn được sắp xếp rõ ràng để em dễ tìm, dễ hiểu.</p>

          {articleGroups.length === 0 ? (
            <p className="mt-7 rounded-3xl border border-dashed border-blue-200 bg-white p-6 text-slate-600">Nội dung đang được cập nhật.</p>
          ) : (
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {articleGroups.map((group) => {
                const presentation = articleTypePresentation[group.type];
                const headingId = `articles-${group.type.toLowerCase()}`;
                return (
                  <section key={group.type} id={getArticleSectionId(group.type)} aria-labelledby={headingId} className="scroll-mt-36 rounded-[1.75rem] border border-blue-100 bg-white p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                      <ArticleTypeIcon type={group.type} />
                      <div>
                        <h3 id={headingId} className="text-xl font-black text-slate-900">{getArticleGroupLabel(group.type)}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{presentation.description}</p>
                      </div>
                    </div>
                    <ul className="mt-5 divide-y divide-slate-100">
                      {group.articles.map((article) => (
                        <li key={article.slug} className="py-4 first:pt-0 last:pb-0">
                          <Link
                            to={`/cuoc-thi/${encodeURIComponent(campaign.slug)}/tin-tuc/${encodeURIComponent(article.slug)}`}
                            className="group inline-flex min-h-11 items-center gap-1 rounded-lg font-black leading-6 text-slate-900 transition hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                          >
                            {article.title}
                            <ChevronRight className="size-4 shrink-0 text-blue-500 transition group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
                          </Link>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{article.summary}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </section>

        {campaign.goldenBoardAvailable && (
          <section className="relative overflow-hidden rounded-[2rem] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-7 shadow-lg sm:p-10">
            <div className="absolute -right-10 -top-10 size-40 rounded-full bg-amber-300/20 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <SectionEyebrow tone="amber">Vinh danh chính thức</SectionEyebrow>
                <h2 className="mt-2 text-3xl font-black text-slate-950">Bảng vàng thành tích</h2>
                <p className="mt-3 max-w-2xl leading-7 text-slate-600">Cùng chúc mừng những học sinh đã nỗ lực và tỏa sáng trong hành trình.</p>
              </div>
              <Link
                to={`/cuoc-thi/${encodeURIComponent(campaign.slug)}/bang-vang`}
                className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-amber-400 px-6 py-3 font-black text-amber-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 motion-reduce:transform-none"
              >
                Bảng vàng
                <Medal className="size-5" aria-hidden="true" />
              </Link>
            </div>
          </section>
        )}
      </div>
    </CompetitionPublicShell>
  );
};

export default CompetitionCampaignView;

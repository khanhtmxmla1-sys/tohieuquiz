import { useState } from 'react';
import {
  ArrowRight, BookOpenCheck, CalendarDays, CheckCircle2, ChevronRight,
  Clock3, Medal, Sparkles, Target, UsersRound,
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
  ArticleTypeIcon, CompetitionConstellation, LearningSeal, PublicStateBadge,
  RoundStateBadge, SectionEyebrow, articleTypePresentation,
} from './CompetitionPublicDesign';

interface CompetitionCampaignViewProps {
  campaign: PublicCompetitionDetailDto;
}

const publicArticleTypes: PublicCompetitionArticleDto['type'][] = [
  'SCHEDULE', 'RULES', 'GUIDE', 'ANNOUNCEMENT', 'RESULT', 'AWARD',
  'CERTIFICATE', 'INCIDENT_NOTICE',
];

const formatPublicDateTime = (value: string): string => formatSystemDateTimeWithOptions(value, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatPublicDate = (value: string): string => formatSystemDateTimeWithOptions(value, {
  dateStyle: 'medium',
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
  const rounds = getSixRounds(campaign.rounds);
  const openRounds = rounds.filter((round) => round.state === 'OPEN');
  const nextRound = rounds.find((round) => round.state !== 'CLOSED');
  const showHeroImage = Boolean(campaign.hero.imageUrl && !heroImageFailed);
  const heroTitleIsDuplicate = campaign.hero.title.trim().toLocaleLowerCase('vi')
    === campaign.title.trim().toLocaleLowerCase('vi');
  const featuredArticle = [...campaign.articles]
    .sort((left, right) => (right.publishedAt ?? '').localeCompare(left.publishedAt ?? ''))[0];
  const articleGroups = publicArticleTypes
    .map((type) => ({ type, articles: campaign.articles.filter((article) => article.type === type) }))
    .filter((group) => group.articles.length > 0);
  const examHref = `/thi/${encodeURIComponent(campaign.slug)}`;

  return (
    <CompetitionPublicShell campaignSlug={campaign.slug} ctaHref={examHref}>
      <section aria-labelledby="campaign-hero-title" className="relative isolate overflow-hidden bg-blue-950 text-white">
        <CompetitionConstellation />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-cyan-800/35 to-transparent" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-20">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <PublicStateBadge state={campaign.publicState} />
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-cyan-100">Năm học {campaign.schoolYear}</span>
              <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-200">Đối tượng theo thể lệ</span>
            </div>
            <p className="mt-7 font-bold uppercase tracking-[0.18em] text-cyan-300">Sân chơi kiến thức tiểu học</p>
            <h1 id="campaign-hero-title" className="mt-3 max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">{campaign.title}</h1>
            {!heroTitleIsDuplicate && <h2 className="mt-4 max-w-2xl text-2xl font-black leading-snug text-amber-300 sm:text-3xl">{campaign.hero.title}</h2>}
            {campaign.hero.subtitle && <p className={`${heroTitleIsDuplicate ? 'mt-4 text-2xl font-black text-amber-300 sm:text-3xl' : 'mt-3 text-lg text-cyan-100'} max-w-2xl leading-8`}>{campaign.hero.subtitle}</p>}
            <p className="mt-5 max-w-2xl leading-8 text-blue-100/85">{campaign.summary}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={examHref} className="group inline-flex min-h-12 items-center gap-2 rounded-2xl bg-amber-400 px-7 py-3 font-black text-blue-950 shadow-xl shadow-blue-950/25 transition hover:-translate-y-0.5 hover:bg-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-950 motion-reduce:transform-none">
                {campaign.cta.label}<ArrowRight className="size-5 transition group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
              </Link>
              <a href="#hanh-trinh" className="inline-flex min-h-12 items-center rounded-2xl border border-white/25 bg-white/10 px-6 py-3 font-bold text-white backdrop-blur-sm transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-950">Xem hành trình</a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            {showHeroImage ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-2 shadow-2xl">
                <img className="h-full w-full rounded-[1.6rem] object-cover" src={campaign.hero.imageUrl} alt={`Học sinh tham gia ${campaign.title}`} width="1200" height="900" onError={() => setHeroImageFailed(true)} />
                <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-blue-950/80 p-4 backdrop-blur-md"><p className="flex items-center gap-2 font-extrabold text-white"><Sparkles className="size-5 text-amber-300" aria-hidden="true" /> Học hỏi · Tự tin · Tỏa sáng</p></div>
              </div>
            ) : (
              <div role="img" aria-label={`Hình minh họa học sinh tham gia ${campaign.title}`} className="flex aspect-[4/3] flex-col items-center justify-center gap-5 rounded-[2rem] border border-white/20 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-sm">
                <LearningSeal /><span className="text-sm font-bold text-cyan-100">Học hỏi · Tự tin · Tỏa sáng</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <nav aria-label="Khám phá cuộc thi" className="relative z-10 mx-auto -mt-6 flex max-w-5xl flex-wrap justify-center gap-2 rounded-3xl border border-blue-100 bg-white p-3 shadow-xl shadow-blue-950/5 sm:p-4">
        <a href="#viec-can-lam" className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 py-2 font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><Target className="size-4" aria-hidden="true" />Bắt đầu</a>
        <a href="#hanh-trinh" className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 py-2 font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><CalendarDays className="size-4" aria-hidden="true" />Hành trình</a>
        <a href="#tin-tuc" className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 py-2 font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><BookOpenCheck className="size-4" aria-hidden="true" />Tin mới</a>
        <a href="#cach-tham-gia" className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 py-2 font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><CheckCircle2 className="size-4" aria-hidden="true" />Cách tham gia</a>
      </nav>

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-14 pb-28 sm:px-6 md:pb-14 lg:px-8">
        <section id="viec-can-lam" aria-label="Việc cần làm ngay" className="scroll-mt-36">
          <div className="grid gap-6 lg:grid-cols-[1.45fr_0.55fr]">
            <div className="overflow-hidden rounded-[2rem] border border-blue-200 bg-white shadow-lg shadow-blue-950/5">
              <div className="border-b border-blue-100 bg-blue-50 px-6 py-5 sm:px-8">
                <SectionEyebrow>Việc cần làm ngay</SectionEyebrow>
                <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{openRounds.length > 0 ? `${openRounds.length === 1 ? 'Vòng thi' : `${openRounds.length} vòng`} đang mở` : 'Chuẩn bị cho vòng tiếp theo'}</h2>
              </div>
              <div className="grid gap-4 p-6 sm:p-8">
                {openRounds.length > 0 ? openRounds.map((round) => (
                  <article key={round.roundNumber} className="flex flex-col justify-between gap-5 rounded-3xl border border-cyan-200 bg-cyan-50/60 p-5 sm:flex-row sm:items-center">
                    <div>
                      <p className="font-black text-cyan-800">Vòng {round.roundNumber} đang mở</p>
                      <h3 className="mt-1 text-xl font-black text-slate-950">{round.title}</h3>
                      {round.closesAt && <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-600"><Clock3 className="size-4 text-cyan-700" aria-hidden="true" />Kết thúc: <time dateTime={round.closesAt}>{formatPublicDateTime(round.closesAt)}</time></p>}
                    </div>
                    <Link to={`${examHref}/vong/${round.roundNumber}`} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 font-black text-white shadow-md transition hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Vào thi vòng {round.roundNumber}<ArrowRight className="size-4" aria-hidden="true" /></Link>
                  </article>
                )) : (
                  <div className="rounded-3xl border border-dashed border-blue-200 bg-slate-50 p-5">
                    <p className="font-bold text-slate-800">Hiện chưa có vòng thi đang mở.</p>
                    {nextRound?.opensAt && <p className="mt-2 text-sm text-slate-600">Vòng tiếp theo dự kiến mở lúc <time dateTime={nextRound.opensAt}>{formatPublicDateTime(nextRound.opensAt)}</time>.</p>}
                  </div>
                )}
              </div>
            </div>

            <aside aria-label="Thông tin nhanh" className="grid grid-cols-2 gap-3 rounded-[2rem] bg-blue-950 p-5 text-white lg:grid-cols-1">
              <div className="rounded-2xl bg-white/10 p-4"><span className="text-2xl font-black text-amber-300">6</span><p className="mt-1 text-sm font-bold text-blue-100">6 vòng thi</p></div>
              <div className="rounded-2xl bg-white/10 p-4"><UsersRound className="size-6 text-cyan-300" aria-hidden="true" /><p className="mt-2 text-sm font-bold text-blue-100">Đối tượng theo thể lệ</p></div>
              <div className="col-span-2 rounded-2xl bg-white/10 p-4 lg:col-span-1"><CalendarDays className="size-6 text-cyan-300" aria-hidden="true" /><p className="mt-2 text-sm font-bold text-blue-100"><time dateTime={campaign.startsAt}>{formatPublicDate(campaign.startsAt)}</time> – <time dateTime={campaign.endsAt}>{formatPublicDate(campaign.endsAt)}</time></p></div>
            </aside>
          </div>
        </section>

        <section id="hanh-trinh" aria-label="Hành trình 6 vòng" className="scroll-mt-36">
          <span id="lich-thi" className="block scroll-mt-36" aria-hidden="true" />
          <SectionEyebrow>Mốc thời gian chính thức</SectionEyebrow>
          <h2 id="campaign-journey-title" className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Hành trình 6 vòng</h2>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-600">Một lộ trình duy nhất để gia đình dễ theo dõi trạng thái, thời gian và bước tiếp theo của từng vòng.</p>
          <ol aria-label="Hành trình 6 vòng" className="relative mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rounds.map((round) => {
              const isOpen = round.state === 'OPEN';
              return (
                <li key={round.roundNumber} className={`relative overflow-hidden rounded-3xl border p-5 shadow-sm ${isOpen ? 'border-cyan-300 bg-cyan-50 ring-2 ring-cyan-200' : 'border-blue-100 bg-white'}`}>
                  <div className={`absolute inset-y-0 left-0 w-1.5 ${isOpen ? 'bg-cyan-500' : 'bg-blue-200'}`} aria-hidden="true" />
                  <div className="flex items-start justify-between gap-4 pl-2">
                    <div><span className="text-xs font-black uppercase tracking-wider text-blue-600">Vòng {round.roundNumber}</span><h3 className="mt-1 text-xl font-black text-slate-900">{round.title}</h3></div>
                    <RoundStateBadge state={round.state} tone="light" />
                  </div>
                  {round.opensAt && round.closesAt ? (
                    <dl className="mt-5 grid gap-3 pl-2 text-sm">
                      <div className="rounded-2xl bg-white/80 p-3"><dt className="font-bold text-slate-500">Mở vòng</dt><dd className="mt-1 font-bold text-slate-800"><time dateTime={round.opensAt}>{formatPublicDateTime(round.opensAt)}</time></dd></div>
                      <div className="rounded-2xl bg-slate-50 p-3"><dt className="font-bold text-slate-500">Kết thúc</dt><dd className="mt-1 font-bold text-slate-800"><time dateTime={round.closesAt}>{formatPublicDateTime(round.closesAt)}</time></dd></div>
                    </dl>
                  ) : <p className="mt-5 pl-2 text-sm font-semibold text-slate-500">Thời gian sẽ được công bố sau.</p>}
                  {isOpen && <Link to={`${examHref}/vong/${round.roundNumber}`} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl font-black text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Tham gia vòng này<ChevronRight className="size-4" aria-hidden="true" /></Link>}
                </li>
              );
            })}
          </ol>
        </section>

        <section id="cach-tham-gia" aria-labelledby="participation-title" className="scroll-mt-36 rounded-[2rem] bg-blue-950 p-7 text-white sm:p-10">
          <SectionEyebrow tone="light">Dễ dàng bắt đầu</SectionEyebrow>
          <h2 id="participation-title" className="mt-2 text-3xl font-black sm:text-4xl">3 bước tham gia</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ['1', 'Đăng nhập tài khoản', 'Học sinh dùng tài khoản đã được nhà trường cấp.'],
              ['2', 'Kiểm tra vòng đang mở', 'Đọc lịch thi và chọn đúng vòng dành cho mình.'],
              ['3', 'Làm bài và nộp bài', 'Hoàn thành câu hỏi, kiểm tra đáp án trước khi nộp.'],
            ].map(([number, title, description]) => (
              <li key={number} className="rounded-3xl border border-white/15 bg-white/[0.07] p-5">
                <span className="grid size-11 place-items-center rounded-2xl bg-amber-400 text-xl font-black text-blue-950">{number}</span>
                <h3 className="mt-4 text-lg font-black">{title}</h3><p className="mt-2 leading-7 text-blue-100/80">{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="tin-tuc" aria-labelledby="public-articles-title" className="scroll-mt-36">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><SectionEyebrow>Thông tin đồng hành</SectionEyebrow><h2 id="public-articles-title" className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Tin tức & hướng dẫn</h2><p className="mt-3 max-w-2xl text-lg leading-8 text-slate-600">Nội dung chính thức được sắp xếp rõ ràng để học sinh và phụ huynh dễ tìm, dễ hiểu.</p></div>
            {featuredArticle && <span className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-sm font-black text-amber-900"><Sparkles className="size-4" aria-hidden="true" />Có cập nhật mới</span>}
          </div>
          {articleGroups.length === 0 ? <p className="mt-7 rounded-3xl border border-dashed border-blue-200 bg-white p-6 text-slate-600">Nội dung đang được cập nhật.</p> : (
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {articleGroups.map((group) => {
                const presentation = articleTypePresentation[group.type];
                const headingId = `articles-${group.type.toLowerCase()}`;
                return (
                  <section key={group.type} id={getArticleSectionId(group.type)} aria-labelledby={headingId} className="scroll-mt-36 rounded-[1.75rem] border border-blue-100 bg-white p-6 shadow-sm">
                    <div className="flex items-start gap-4"><ArticleTypeIcon type={group.type} /><div><h3 id={headingId} className="text-xl font-black text-slate-900">{getArticleGroupLabel(group.type)}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{presentation.description}</p></div></div>
                    <ul className="mt-5 divide-y divide-slate-100">
                      {group.articles.map((article) => (
                        <li key={article.slug} className={`py-4 first:pt-0 last:pb-0 ${article.slug === featuredArticle?.slug ? 'rounded-2xl bg-amber-50 px-4' : ''}`}>
                          {article.slug === featuredArticle?.slug && <span className="mb-2 inline-flex rounded-full bg-amber-200 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-amber-950">Mới nhất</span>}
                          <Link to={`/cuoc-thi/${encodeURIComponent(campaign.slug)}/tin-tuc/${encodeURIComponent(article.slug)}`} className="group flex min-h-11 items-center gap-1 rounded-lg font-black leading-6 text-slate-900 transition hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">{article.title}<ChevronRight className="size-4 shrink-0 text-blue-500 transition group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" /></Link>
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
          <section className="relative overflow-hidden rounded-[2rem] border border-amber-200 bg-amber-50 p-7 shadow-lg sm:p-10">
            <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div><SectionEyebrow tone="amber">Vinh danh chính thức</SectionEyebrow><h2 className="mt-2 text-3xl font-black text-slate-950">Bảng vàng thành tích</h2><p className="mt-3 max-w-2xl leading-7 text-slate-600">Cùng chúc mừng những học sinh đã nỗ lực và tỏa sáng trong hành trình.</p></div>
              <Link to={`/cuoc-thi/${encodeURIComponent(campaign.slug)}/bang-vang`} className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-amber-400 px-6 py-3 font-black text-amber-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 motion-reduce:transform-none">Bảng vàng<Medal className="size-5" aria-hidden="true" /></Link>
            </div>
          </section>
        )}
      </div>

      <nav aria-label="Thao tác nhanh trên thiết bị di động" className="fixed inset-x-0 bottom-0 z-50 border-t border-blue-100 bg-white/95 p-3 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur-md md:hidden">
        <Link to={examHref} className="mx-auto flex min-h-12 max-w-lg items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 font-black text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Vào thi ngay<ArrowRight className="size-5" aria-hidden="true" /></Link>
      </nav>
    </CompetitionPublicShell>
  );
};

export default CompetitionCampaignView;

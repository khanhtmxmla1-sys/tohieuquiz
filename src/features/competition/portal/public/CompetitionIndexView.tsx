import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  ChevronRight,
  HelpCircle,
  Megaphone,
  Sparkles,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import type {
  CompetitionPublicState,
  PublicCompetitionRoundDto,
  PublicCompetitionSummaryDto,
} from '../../../../../shared/competition-portal.contract';
import { formatSystemDateTimeWithOptions } from '../../../../utils/dateTime';
import CompetitionPublicShell from './CompetitionPublicShell';
import {
  CompetitionConstellation,
  LearningSeal,
  PublicStateBadge,
  RoundStateBadge,
  SectionEyebrow,
  publicStatePresentation,
} from './CompetitionPublicDesign';

interface CompetitionIndexViewProps {
  items: PublicCompetitionSummaryDto[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}

const groupOrder: CompetitionPublicState[] = ['ONGOING', 'UPCOMING', 'ENDED'];

const quickLinks: Array<{ label: string; icon: LucideIcon; hash?: string; path?: string }> = [
  { label: 'Lịch thi', icon: CalendarDays, hash: '#lich-thi' },
  { label: 'Tin mới nhất', icon: Megaphone, hash: '#tin-tuc' },
  { label: 'Thể lệ', icon: BookOpenCheck, hash: '#the-le' },
  { label: 'Hướng dẫn', icon: HelpCircle, hash: '#huong-dan' },
  { label: 'Bảng vàng', icon: Trophy, path: '/bang-vang' },
];

const formatPublicDateTime = (value: string): string => formatSystemDateTimeWithOptions(value, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const buildRepresentativeRounds = (campaign?: PublicCompetitionSummaryDto): PublicCompetitionRoundDto[] => {
  const rounds = campaign?.rounds.slice(0, 6) ?? [];
  if (rounds.length === 6) return rounds;
  return Array.from({ length: 6 }, (_, index) => rounds[index] ?? ({
    roundNumber: index + 1,
    title: `Vòng ${index + 1}`,
    opensAt: '',
    closesAt: '',
    state: 'LOCKED',
  }));
};

const CompetitionIndexView = ({ items, loading, failed, onRetry }: CompetitionIndexViewProps) => {
  const grouped = {
    ONGOING: items.filter((item) => item.publicState === 'ONGOING'),
    UPCOMING: items.filter((item) => item.publicState === 'UPCOMING'),
    ENDED: items.filter((item) => item.publicState === 'ENDED'),
  };
  const featured = grouped.ONGOING[0] ?? grouped.UPCOMING[0] ?? grouped.ENDED[0];
  const representativeRounds = buildRepresentativeRounds(featured);
  const detailBase = featured ? `/cuoc-thi/${encodeURIComponent(featured.slug)}` : '/cuoc-thi';

  return (
    <CompetitionPublicShell
      campaignSlug={featured?.slug}
      ctaHref={featured ? `/thi/${encodeURIComponent(featured.slug)}` : undefined}
    >
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-cyan-800 text-white">
        <CompetitionConstellation />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.35fr_0.65fr] lg:px-8 lg:py-24">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-white/10 px-4 py-2 text-sm font-bold text-cyan-100 backdrop-blur-sm">
              <Sparkles className="size-4 text-amber-300" aria-hidden="true" />
              Sân chơi học tập dành cho học sinh
            </div>
            <h1 className="max-w-4xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              SÂN CHƠI <span className="text-cyan-300">TÔ HIỆU QUIZ</span>
            </h1>
            <p className="mt-5 text-xl font-extrabold text-amber-300 sm:text-2xl">
              Mỗi thử thách, một bước trưởng thành
            </p>
            <p className="mt-5 max-w-2xl text-base leading-8 text-blue-100/85 sm:text-lg">
              Khám phá hành trình sáu vòng, theo dõi lịch thi và cùng nhau nuôi dưỡng niềm vui học tập mỗi ngày.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {featured && (
                <Link
                  to={`/thi/${encodeURIComponent(featured.slug)}`}
                  className="group inline-flex min-h-12 items-center gap-2 rounded-2xl bg-amber-400 px-6 py-3 font-black text-blue-950 shadow-xl shadow-blue-950/25 transition hover:-translate-y-0.5 hover:bg-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-950 motion-reduce:transform-none"
                >
                  VÀO THI
                  <ArrowRight className="size-5 transition group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
                </Link>
              )}
              <a
                href="#competition-groups"
                className="inline-flex min-h-12 items-center rounded-2xl border border-white/25 bg-white/10 px-6 py-3 font-bold text-white backdrop-blur-sm transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-950"
              >
                Khám phá ngay
              </a>
            </div>
          </div>
          <div className="mx-auto flex flex-col items-center gap-5 lg:justify-self-end">
            <LearningSeal />
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 text-center shadow-2xl backdrop-blur-sm">
              <p className="text-4xl font-black text-white">06</p>
              <p className="mt-1 text-sm font-bold uppercase tracking-wider text-cyan-200">Vòng khám phá</p>
            </div>
          </div>
        </div>
      </section>

      <nav aria-label="Lối tắt nội dung cuộc thi" className="relative z-10 mx-auto -mt-6 grid max-w-6xl grid-cols-2 gap-3 px-4 sm:grid-cols-3 sm:px-6 lg:grid-cols-5">
        {quickLinks.map(({ label, icon: Icon, hash, path }) => (
          <Link
            key={label}
            to={path ? `${detailBase}${path}` : `${detailBase}${hash ?? ''}`}
            className="group flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-white p-4 text-center font-extrabold text-slate-800 shadow-lg shadow-blue-950/5 transition hover:-translate-y-1 hover:border-blue-200 hover:text-blue-700 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transform-none"
          >
            <Icon className="size-6 text-blue-600 transition group-hover:scale-110 motion-reduce:transform-none" aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-14 sm:px-6 lg:px-8">
        {loading && (
          <p role="status" aria-live="polite" className="rounded-3xl border border-blue-100 bg-white p-8 text-center font-semibold text-slate-600 shadow-sm">
            Đang tải danh sách cuộc thi…
          </p>
        )}
        {failed && (
          <section role="alert" className="rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-2xl font-black">Không thể tải danh sách cuộc thi</h2>
            <p className="mt-2 text-slate-600">Kết nối đang gián đoạn. Em hãy thử lại sau ít phút.</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-5 min-h-11 rounded-xl bg-blue-700 px-5 py-2.5 font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Thử lại
            </button>
          </section>
        )}

        {!loading && !failed && (
          <section id="competition-groups" aria-label="Khám phá cuộc thi" className="scroll-mt-36 space-y-10">
            <div className="max-w-2xl">
              <SectionEyebrow>Hành trình dành cho em</SectionEyebrow>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Khám phá cuộc thi</h2>
              <p className="mt-3 text-lg leading-8 text-slate-600">Chọn một sân chơi phù hợp, xem đầy đủ thông tin và bắt đầu khi em đã sẵn sàng.</p>
            </div>

            {groupOrder.map((state) => {
              const campaigns = grouped[state];
              const headingId = `competition-group-${state.toLowerCase()}`;
              return (
                <section key={state} aria-labelledby={headingId} className="space-y-4">
                  <div className="flex items-end justify-between gap-4">
                    <h3 id={headingId} className="text-2xl font-black text-slate-900">{publicStatePresentation[state].label}</h3>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">{campaigns.length} cuộc thi</span>
                  </div>

                  {campaigns.length === 0 ? (
                    <p className="rounded-3xl border border-dashed border-blue-200 bg-white/70 p-6 text-slate-600">Chưa có cuộc thi trong nhóm này.</p>
                  ) : (
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                      {campaigns.map((competition) => (
                        <article key={competition.slug} className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-blue-100 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-950/10 motion-reduce:transform-none">
                          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-amber-400" aria-hidden="true" />
                          <PublicStateBadge state={competition.publicState} />
                          <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-blue-600">Năm học {competition.schoolYear}</p>
                          <h4 className="mt-2 text-2xl font-black leading-tight text-slate-950">{competition.title}</h4>
                          <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">{competition.summary}</p>
                          <div className="mt-6 flex flex-wrap gap-2">
                            <Link
                              to={`/thi/${encodeURIComponent(competition.slug)}`}
                              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-blue-700 px-4 py-2 font-black text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                            >
                              VÀO THI
                            </Link>
                            <Link
                              to={`/cuoc-thi/${encodeURIComponent(competition.slug)}`}
                              className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-blue-200 px-4 py-2 font-bold text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                            >
                              Xem thông tin
                              <ChevronRight className="size-4" aria-hidden="true" />
                            </Link>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </section>
        )}

        {featured && (
          <section id="lich-thi" aria-labelledby="schedule-highlights-title" className="scroll-mt-36 overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/5">
            <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
              <div className="bg-gradient-to-br from-cyan-500 to-blue-700 p-7 text-white sm:p-9">
                <SectionEyebrow tone="light">Mốc thời gian công khai</SectionEyebrow>
                <h2 id="schedule-highlights-title" className="mt-2 text-3xl font-black">Lịch thi nổi bật</h2>
                <p className="mt-3 leading-7 text-blue-50">{featured.title}</p>
                <dl className="mt-7 space-y-3">
                  <div className="rounded-2xl bg-white/12 p-4 backdrop-blur-sm">
                    <dt className="text-xs font-bold uppercase tracking-wider text-cyan-100">Bắt đầu</dt>
                    <dd className="mt-1 font-bold"><time dateTime={featured.startsAt}>{formatPublicDateTime(featured.startsAt)}</time></dd>
                  </div>
                  <div className="rounded-2xl bg-white/12 p-4 backdrop-blur-sm">
                    <dt className="text-xs font-bold uppercase tracking-wider text-cyan-100">Kết thúc</dt>
                    <dd className="mt-1 font-bold"><time dateTime={featured.endsAt}>{formatPublicDateTime(featured.endsAt)}</time></dd>
                  </div>
                </dl>
              </div>
              <ol className="grid gap-4 p-6 sm:p-8 md:grid-cols-3" aria-label="Các vòng thi sắp tới">
                {featured.rounds.slice(0, 3).map((round) => (
                  <li key={round.roundNumber} className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
                    <span className="grid size-10 place-items-center rounded-xl bg-blue-700 font-black text-white">{round.roundNumber}</span>
                    <p className="mt-4 font-black text-slate-900">{round.title}</p>
                    <p className="mt-3 text-xs leading-5 text-slate-600">Mở: <time dateTime={round.opensAt}>{formatPublicDateTime(round.opensAt)}</time></p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">Đóng: <time dateTime={round.closesAt}>{formatPublicDateTime(round.closesAt)}</time></p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        <section id="six-round-journey" aria-labelledby="six-round-title" className="relative isolate scroll-mt-36 overflow-hidden rounded-[2rem] bg-blue-950 p-7 text-white shadow-2xl sm:p-10">
          <CompetitionConstellation />
          <div className="relative">
            <SectionEyebrow tone="light">Lộ trình tiêu biểu</SectionEyebrow>
            <h2 id="six-round-title" className="mt-2 text-3xl font-black sm:text-4xl">Hành trình 6 vòng</h2>
            <p className="mt-3 max-w-2xl leading-7 text-blue-100/80">Mỗi vòng là một cột mốc để em luyện tập, tiến bộ và thêm tự tin.</p>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {representativeRounds.map((round) => (
                <li key={round.roundNumber} className="relative rounded-2xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-blue-400 text-lg font-black text-blue-950">{round.roundNumber}</span>
                    <RoundStateBadge state={round.state} />
                  </div>
                  <p className="mt-4 font-extrabold">{round.title}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </CompetitionPublicShell>
  );
};

export default CompetitionIndexView;

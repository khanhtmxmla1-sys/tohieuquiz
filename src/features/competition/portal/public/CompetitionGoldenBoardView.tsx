import { Award, RefreshCw, Sparkles, Star, Trophy } from 'lucide-react';
import { Link } from 'react-router';
import type {
  PublicGoldenBoardDto,
  PublicGoldenBoardWinnerDto,
} from '../../../../../shared/competition-portal.contract';
import CompetitionPublicShell from './CompetitionPublicShell';
import { CompetitionConstellation, LearningSeal, SectionEyebrow } from './CompetitionPublicDesign';

interface AwardGroup {
  awardCode: string;
  awardLabel: string;
  winners: PublicGoldenBoardWinnerDto[];
}

interface CompetitionGoldenBoardViewProps {
  board: PublicGoldenBoardDto | null;
  campaignSlug?: string;
  failed: boolean;
  loading: boolean;
  onReload: () => void;
}

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

const CompetitionGoldenBoardView = ({
  board,
  campaignSlug,
  failed,
  loading,
  onReload,
}: CompetitionGoldenBoardViewProps) => {
  const awardGroups = board ? groupWinners(board.winners) : [];
  const campaignPath = campaignSlug ? `/cuoc-thi/${encodeURIComponent(campaignSlug)}` : '/cuoc-thi';

  return (
    <CompetitionPublicShell campaignSlug={campaignSlug}>
      <section className="relative overflow-hidden bg-[#072c66] text-white">
        <CompetitionConstellation />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-white/10 px-4 py-2 text-sm font-extrabold uppercase tracking-[0.16em] text-cyan-100">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Vinh danh chính thức
            </p>
            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">Bảng vàng</h1>
            <p className="mt-4 text-2xl font-extrabold text-amber-300">Những gương mặt tỏa sáng</p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-blue-100 sm:text-lg">
              Ghi nhận hành trình nỗ lực, tinh thần ham học hỏi và thành tích nổi bật của các em học sinh.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to={campaignPath}
                className="inline-flex min-h-11 items-center rounded-xl bg-amber-400 px-5 py-2.5 font-black text-[#072c66] shadow-lg shadow-black/10 transition hover:bg-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Quay lại cuộc thi
              </Link>
              <button
                type="button"
                onClick={onReload}
                disabled={loading}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-2.5 font-extrabold text-white transition hover:bg-white/20 disabled:cursor-wait disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Tải lại bảng vàng"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                Tải lại
              </button>
            </div>
          </div>
          <div className="hidden lg:block">
            <LearningSeal />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {loading && (
          <p role="status" aria-live="polite" className="rounded-3xl border border-blue-100 bg-white p-8 text-center font-bold text-slate-700 shadow-sm">
            Đang tải bảng vàng…
          </p>
        )}

        {failed && (
          <section role="alert" className="rounded-3xl border border-rose-200 bg-white p-8 text-center text-slate-700 shadow-sm">
            Không tìm thấy bảng vàng hoặc bảng vàng tạm thời chưa khả dụng.
          </section>
        )}

        {!loading && !failed && board && board.winners.length === 0 && (
          <p role="status" aria-live="polite" className="rounded-3xl border border-blue-100 bg-white p-8 text-center text-slate-700 shadow-sm">
            Bảng vàng chưa có danh sách được công bố.
          </p>
        )}

        {!loading && !failed && board && board.winners.length > 0 && (
          <div className="space-y-10">
            <header className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2">
                <Award className="h-4 w-4 text-blue-700" aria-hidden="true" />
                <SectionEyebrow>Thành tích nổi bật</SectionEyebrow>
              </div>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Mỗi cái tên là một câu chuyện về sự kiên trì, tự tin và niềm vui khám phá tri thức.
              </p>
            </header>

            {awardGroups.map((group, groupIndex) => {
              const headingId = `golden-board-award-${groupIndex}`;
              return (
                <section
                  key={`${group.awardCode}-${group.awardLabel}`}
                  role="region"
                  aria-labelledby={headingId}
                  className="overflow-hidden rounded-[2rem] border border-amber-200 bg-white shadow-[0_20px_60px_-34px_rgba(7,44,102,0.45)]"
                >
                  <div className="flex items-center gap-4 bg-gradient-to-r from-amber-100 via-amber-50 to-white px-6 py-5 sm:px-8">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-400 text-[#072c66] shadow-sm">
                      <Trophy className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 id={headingId} className="text-2xl font-black text-[#072c66]">{group.awardLabel}</h2>
                      <p className="mt-1 text-sm font-bold text-amber-900">{group.winners.length} học sinh được vinh danh</p>
                    </div>
                  </div>
                  <ul className="grid gap-5 p-6 md:grid-cols-2 xl:grid-cols-3 sm:p-8">
                    {group.winners.map((winner, winnerIndex) => (
                      <li key={`${winner.fullName}-${winner.className}-${winnerIndex}`}>
                        <article className="group relative h-full overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/70 p-6 transition hover:-translate-y-1 hover:shadow-lg">
                          <Star className="absolute -right-3 -top-3 h-20 w-20 rotate-12 text-amber-200/70" fill="currentColor" aria-hidden="true" />
                          <div className="relative">
                            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0b62ce] text-white">
                              <Award className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <h3 className="mt-5 text-xl font-black text-[#072c66]">{winner.fullName}</h3>
                            <dl className="mt-5 grid gap-3 text-sm text-slate-700">
                              <div className="flex items-baseline justify-between gap-4 border-b border-blue-100 pb-2">
                                <dt className="font-bold text-slate-500">Lớp</dt>
                                <dd className="text-right font-extrabold">{winner.className}</dd>
                              </div>
                              <div className="flex items-baseline justify-between gap-4 border-b border-blue-100 pb-2">
                                <dt className="font-bold text-slate-500">Trường</dt>
                                <dd className="text-right font-extrabold">{winner.schoolName}</dd>
                              </div>
                              <div className="flex items-baseline justify-between gap-4">
                                <dt className="font-bold text-slate-500">Khối</dt>
                                <dd className="text-right font-extrabold">{winner.gradeLevel}</dd>
                              </div>
                            </dl>
                          </div>
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

export default CompetitionGoldenBoardView;

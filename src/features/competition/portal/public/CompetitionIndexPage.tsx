import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type {
  CompetitionPublicState,
  PublicCompetitionRoundDto,
  PublicCompetitionSummaryDto,
} from '../../../../../shared/competition-portal.contract';
import { formatSystemDateTimeWithOptions } from '../../../../utils/dateTime';
import CompetitionPublicShell from './CompetitionPublicShell';
import { publicCompetitionPortalService } from './publicCompetitionPortalService';

const stateLabels: Record<CompetitionPublicState, string> = {
  ONGOING: 'Đang diễn ra',
  UPCOMING: 'Sắp diễn ra',
  ENDED: 'Đã kết thúc',
};

const groupOrder: CompetitionPublicState[] = ['ONGOING', 'UPCOMING', 'ENDED'];

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

const CompetitionIndexPage = () => {
  const [items, setItems] = useState<PublicCompetitionSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    void publicCompetitionPortalService.listCompetitions()
      .then((competitions) => {
        if (!active) return;
        setItems(competitions);
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
  }, [reloadKey]);

  const grouped = useMemo(() => ({
    ONGOING: items.filter((item) => item.publicState === 'ONGOING'),
    UPCOMING: items.filter((item) => item.publicState === 'UPCOMING'),
    ENDED: items.filter((item) => item.publicState === 'ENDED'),
  }), [items]);

  const featured = grouped.ONGOING[0] ?? grouped.UPCOMING[0] ?? grouped.ENDED[0];
  const representativeRounds = buildRepresentativeRounds(featured);
  const detailBase = featured ? `/cuoc-thi/${encodeURIComponent(featured.slug)}` : '/cuoc-thi';

  return (
    <CompetitionPublicShell
      campaignSlug={featured?.slug}
      ctaHref={featured ? `/thi/${encodeURIComponent(featured.slug)}` : undefined}
    >
      <section className="bg-gradient-to-b from-sky-50 to-slate-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:py-16">
          <div>
            <p className="mb-3 text-sm font-extrabold uppercase tracking-[0.18em] text-sky-700">Sân chơi học tập</p>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">SÂN CHƠI TÔ HIỆU QUIZ</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
              Chinh phục 6 vòng thử thách, theo dõi lịch thi và cùng nhau lan tỏa tinh thần học tập tích cực.
            </p>
            {featured && (
              <Link
                to={`/thi/${encodeURIComponent(featured.slug)}`}
                className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-sky-700 px-6 py-3 font-extrabold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
              >
                VÀO THI
              </Link>
            )}
          </div>

          <aside className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm" aria-label="Thông tin nổi bật">
            <p className="text-sm font-bold uppercase tracking-wider text-sky-700">Điểm đến nhanh</p>
            <h2 className="mt-2 text-2xl font-extrabold">Mọi thông tin cuộc thi trong một nơi</h2>
            <p className="mt-3 text-slate-600">Xem lịch, tin mới, thể lệ, hướng dẫn và Bảng vàng từ trang công khai.</p>
          </aside>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6">
        {loading && <p role="status" aria-live="polite">Đang tải danh sách cuộc thi…</p>}
        {failed && (
          <section role="alert" className="rounded-2xl border border-rose-200 bg-white p-5">
            <h2 className="text-xl font-bold">Không thể tải danh sách cuộc thi</h2>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="mt-4 min-h-11 rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
            >
              Thử lại
            </button>
          </section>
        )}

        {!loading && !failed && (
          <div id="competition-groups" className="space-y-10">
            {groupOrder.map((state) => {
              const campaigns = grouped[state];
              const headingId = `competition-group-${state.toLowerCase()}`;
              return (
                <section key={state} aria-labelledby={headingId} className="space-y-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-sky-700">Cuộc thi công khai</p>
                      <h2 id={headingId} className="text-2xl font-extrabold">{stateLabels[state]}</h2>
                    </div>
                    <span className="text-sm text-slate-500">{campaigns.length} cuộc thi</span>
                  </div>

                  {campaigns.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-slate-600">Chưa có cuộc thi trong nhóm này.</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {campaigns.map((competition) => (
                        <article key={competition.slug} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                          <span className="w-fit rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-800">{stateLabels[competition.publicState]}</span>
                          <h3 className="mt-3 text-xl font-extrabold">{competition.title}</h3>
                          <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{competition.summary}</p>
                          <p className="mt-3 text-xs font-semibold text-slate-500">Năm học {competition.schoolYear}</p>
                          <Link
                            to={`/thi/${encodeURIComponent(competition.slug)}`}
                            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-sky-700 px-4 py-2 font-extrabold text-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
                          >
                            VÀO THI
                          </Link>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {featured && (
          <section aria-labelledby="schedule-highlights-title" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-sky-700">Mốc thời gian công khai</p>
            <h2 id="schedule-highlights-title" className="mt-1 text-2xl font-extrabold">Lịch thi nổi bật</h2>
            <p className="mt-2 text-slate-600">{featured.title}</p>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-sky-50 p-4">
                <dt className="text-sm font-bold text-sky-800">Bắt đầu</dt>
                <dd className="mt-1 font-semibold text-slate-900">
                  <time dateTime={featured.startsAt}>{formatPublicDateTime(featured.startsAt)}</time>
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-100 p-4">
                <dt className="text-sm font-bold text-slate-700">Kết thúc</dt>
                <dd className="mt-1 font-semibold text-slate-900">
                  <time dateTime={featured.endsAt}>{formatPublicDateTime(featured.endsAt)}</time>
                </dd>
              </div>
            </dl>

            {featured.rounds.length > 0 && (
              <ol className="mt-5 grid gap-3 md:grid-cols-3" aria-label="Các vòng thi sắp tới">
                {featured.rounds.slice(0, 3).map((round) => (
                  <li key={round.roundNumber} className="rounded-2xl border border-slate-200 p-4">
                    <p className="font-bold">{round.title}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Mở: <time dateTime={round.opensAt}>{formatPublicDateTime(round.opensAt)}</time>
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Đóng: <time dateTime={round.closesAt}>{formatPublicDateTime(round.closesAt)}</time>
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        <section id="six-round-journey" aria-labelledby="six-round-title" className="rounded-3xl bg-slate-900 p-6 text-white sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-sky-300">Lộ trình tiêu biểu</p>
          <h2 id="six-round-title" className="mt-2 text-3xl font-black">Hành trình 6 vòng</h2>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {representativeRounds.map((round) => (
              <li key={round.roundNumber} className="rounded-2xl border border-white/15 bg-white/5 p-4">
                <span className="text-sm font-bold text-sky-300">Vòng {round.roundNumber}</span>
                <p className="mt-1 font-semibold">{round.title}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="public-entry-title">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-700">Thông tin hữu ích</p>
          <h2 id="public-entry-title" className="mt-1 text-2xl font-extrabold">Theo dõi cuộc thi</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Link to={`${detailBase}#lich-thi`} className="rounded-2xl border border-slate-200 bg-white p-4 font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">Lịch thi</Link>
            <Link to={`${detailBase}#tin-tuc`} className="rounded-2xl border border-slate-200 bg-white p-4 font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">Tin mới nhất</Link>
            <Link to={`${detailBase}#the-le`} className="rounded-2xl border border-slate-200 bg-white p-4 font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">Thể lệ</Link>
            <Link to={`${detailBase}#huong-dan`} className="rounded-2xl border border-slate-200 bg-white p-4 font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">Hướng dẫn</Link>
            <Link to={`${detailBase}/bang-vang`} className="rounded-2xl border border-slate-200 bg-white p-4 font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">Bảng vàng</Link>
          </div>
        </section>
      </div>
    </CompetitionPublicShell>
  );
};

export default CompetitionIndexPage;

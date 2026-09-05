import type { ReactNode } from 'react';
import { ArrowRight, Heart, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { CompetitionBrandMark } from './CompetitionPublicDesign';

interface CompetitionPublicShellProps {
  children: ReactNode;
  ctaHref?: string;
  campaignSlug?: string;
}

const focusClassName = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2';

const CompetitionPublicShell = ({ children, ctaHref, campaignSlug }: CompetitionPublicShellProps) => {
  const location = useLocation();
  const campaignHref = campaignSlug
    ? `/cuoc-thi/${encodeURIComponent(campaignSlug)}`
    : '/cuoc-thi';
  const isIndexRoute = location.pathname === '/cuoc-thi' || location.pathname === '/cuoc-thi/';
  const isCampaignRoute = Boolean(
    campaignSlug && (location.pathname === campaignHref || location.pathname === `${campaignHref}/`),
  );
  const activeLinkClassName = 'bg-blue-50 text-blue-700 shadow-sm shadow-blue-900/5';
  const inactiveLinkClassName = 'text-slate-600 hover:bg-blue-50 hover:text-blue-700';

  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--competition-surface-tint)] text-slate-950">
      <a
        href="#competition-public-main"
        className={`sr-only z-50 rounded-xl bg-white px-4 py-3 font-bold shadow-xl focus:not-sr-only focus:fixed focus:left-4 focus:top-4 ${focusClassName}`}
      >
        Bỏ qua đến nội dung cuộc thi
      </a>

      <div className="bg-blue-950 px-4 py-2 text-center text-xs font-bold text-blue-100 sm:text-sm">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="size-4 text-cyan-300" aria-hidden="true" />
          Không gian học tập an toàn · Thông tin cuộc thi được công bố chính thức
        </span>
      </div>

      <header role="banner" className="sticky top-0 z-40 border-b border-blue-100/80 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:px-8">
          <Link
            to="/cuoc-thi"
            aria-label="Tô Hiệu Quiz - Trang cuộc thi"
            className={`inline-flex min-h-11 min-w-0 items-center rounded-2xl ${focusClassName}`}
          >
            <CompetitionBrandMark />
          </Link>

          <nav aria-label="Điều hướng cuộc thi" className="col-span-2 row-start-2 flex min-w-0 items-center gap-1 overflow-x-auto border-t border-blue-100/70 pt-2 text-sm font-bold lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:justify-center lg:border-t-0 lg:pt-0">
            <Link
              aria-current={isIndexRoute ? 'page' : undefined}
              className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 py-2 transition ${isIndexRoute ? activeLinkClassName : inactiveLinkClassName} ${focusClassName}`}
              to="/cuoc-thi"
            >
              Trang cuộc thi
            </Link>
            <a className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 py-2 transition ${inactiveLinkClassName} ${focusClassName}`} href="#competition-groups">
              Các cuộc thi
            </a>
            <a className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 py-2 transition ${inactiveLinkClassName} ${focusClassName}`} href="#six-round-journey">
              Hành trình 6 vòng
            </a>
            {campaignSlug && (
              <Link
                aria-current={isCampaignRoute ? 'page' : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 py-2 transition ${isCampaignRoute ? activeLinkClassName : inactiveLinkClassName} ${focusClassName}`}
                to={campaignHref}
              >
                Chi tiết cuộc thi
              </Link>
            )}
          </nav>

          {ctaHref && (
            <Link
              to={ctaHref}
              className={`group col-start-2 row-start-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-700 to-cyan-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:shadow-xl motion-reduce:transform-none sm:px-5 lg:col-start-3 ${focusClassName}`}
            >
              VÀO THI
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
            </Link>
          )}
        </div>
      </header>

      <main id="competition-public-main" tabIndex={-1}>{children}</main>

      <footer role="contentinfo" className="mt-16 bg-blue-950 text-blue-100">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr] lg:px-8">
          <div>
            <CompetitionBrandMark inverted />
            <p className="mt-4 max-w-xl leading-7 text-blue-100/80">
              Cùng học sinh khám phá kiến thức, rèn luyện bản lĩnh và ghi nhận từng bước tiến bộ trong một hành trình an toàn.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200">
              <Heart className="size-4" aria-hidden="true" />
              Học hỏi · Tự tin · Tỏa sáng
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm font-semibold md:items-end">
            <Link className={`inline-flex min-h-11 items-center rounded-lg px-2 ${focusClassName}`} to="/privacy">Chính sách riêng tư</Link>
            <Link className={`inline-flex min-h-11 items-center rounded-lg px-2 ${focusClassName}`} to="/tos">Điều khoản sử dụng</Link>
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-blue-200/70">
          © Tô Hiệu Quiz · Sân chơi học tập dành cho học sinh.
        </div>
      </footer>
    </div>
  );
};

export default CompetitionPublicShell;

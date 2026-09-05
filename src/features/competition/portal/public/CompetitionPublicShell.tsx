import type { ReactNode } from 'react';
import { ArrowRight, Heart, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { CompetitionBrandMark } from './CompetitionPublicDesign';

interface CompetitionPublicShellProps {
  children: ReactNode;
  ctaHref?: string;
  campaignSlug?: string;
}

const focusClassName = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2';

const CompetitionPublicShell = ({ children, ctaHref, campaignSlug }: CompetitionPublicShellProps) => {
  const campaignHref = campaignSlug
    ? `/cuoc-thi/${encodeURIComponent(campaignSlug)}`
    : '/cuoc-thi';

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f6f9ff] text-slate-950">
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
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            to="/cuoc-thi"
            aria-label="Tô Hiệu Quiz - Trang cuộc thi"
            className={`inline-flex min-h-11 items-center rounded-2xl ${focusClassName}`}
          >
            <CompetitionBrandMark />
          </Link>

          <nav aria-label="Điều hướng cuộc thi" className="order-3 flex w-full items-center gap-1 overflow-x-auto pb-1 text-sm font-bold text-slate-600 md:order-2 md:w-auto md:pb-0">
            <Link className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 py-2 transition hover:bg-blue-50 hover:text-blue-700 ${focusClassName}`} to="/cuoc-thi">
              Trang cuộc thi
            </Link>
            <a className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 py-2 transition hover:bg-blue-50 hover:text-blue-700 ${focusClassName}`} href="#competition-groups">
              Các cuộc thi
            </a>
            <a className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 py-2 transition hover:bg-blue-50 hover:text-blue-700 ${focusClassName}`} href="#six-round-journey">
              Hành trình 6 vòng
            </a>
            {campaignSlug && (
              <Link className={`inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 py-2 transition hover:bg-blue-50 hover:text-blue-700 ${focusClassName}`} to={campaignHref}>
                Chi tiết cuộc thi
              </Link>
            )}
          </nav>

          {ctaHref && (
            <Link
              to={ctaHref}
              className={`group order-2 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-700 to-cyan-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:shadow-xl motion-reduce:transform-none md:order-3 ${focusClassName}`}
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

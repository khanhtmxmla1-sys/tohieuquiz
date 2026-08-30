import type { ReactNode } from 'react';
import { Link } from 'react-router';

interface CompetitionPublicShellProps {
  children: ReactNode;
  ctaHref?: string;
  campaignSlug?: string;
}

const CompetitionPublicShell = ({ children, ctaHref, campaignSlug }: CompetitionPublicShellProps) => (
  <div className="min-h-screen bg-slate-50 text-slate-950">
    <a
      href="#competition-public-main"
      className="sr-only z-50 rounded-lg bg-white px-4 py-2 font-semibold shadow focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    >
      Bỏ qua đến nội dung cuộc thi
    </a>

    <header role="banner" className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link to="/cuoc-thi" className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2">
          <span className="block text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Sân chơi</span>
          <span className="text-lg font-extrabold text-slate-950">TÔ HIỆU QUIZ</span>
        </Link>

        <nav aria-label="Điều hướng cuộc thi" className="order-3 flex w-full flex-wrap items-center gap-2 text-sm font-semibold text-slate-700 md:order-2 md:w-auto">
          <Link className="rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600" to="/cuoc-thi">
            Trang cuộc thi
          </Link>
          <a className="rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600" href="#competition-groups">
            Các cuộc thi
          </a>
          <a className="rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600" href="#six-round-journey">
            Hành trình 6 vòng
          </a>
          {campaignSlug && (
            <Link
              className="rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
              to={`/cuoc-thi/${encodeURIComponent(campaignSlug)}`}
            >
              Chi tiết cuộc thi
            </Link>
          )}
        </nav>

        {ctaHref && (
          <Link
            to={ctaHref}
            className="order-2 min-h-11 rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 md:order-3"
          >
            VÀO THI
          </Link>
        )}
      </div>
    </header>

    <main id="competition-public-main" tabIndex={-1}>{children}</main>

    <footer role="contentinfo" className="mt-12 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© Tô Hiệu Quiz · Sân chơi học tập dành cho học sinh.</p>
        <div className="flex gap-4">
          <Link className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600" to="/privacy">Chính sách riêng tư</Link>
          <Link className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600" to="/tos">Điều khoản sử dụng</Link>
        </div>
      </div>
    </footer>
  </div>
);

export default CompetitionPublicShell;

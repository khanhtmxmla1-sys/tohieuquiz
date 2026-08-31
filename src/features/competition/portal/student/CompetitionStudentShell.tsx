import type { ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import type { StudentCompetitionPortalDto } from '../../../../../shared/competition-portal.contract';

interface CompetitionStudentShellProps {
  children?: ReactNode;
  portal?: StudentCompetitionPortalDto;
}

const CompetitionStudentShell = ({ children, portal }: CompetitionStudentShellProps) => {
  const location = useLocation();
  const activeExam = /\/lam-bai\/?$/.test(location.pathname);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <a
        href="#competition-main"
        className="sr-only z-50 rounded bg-white px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
      >
        Bỏ qua đến nội dung cuộc thi
      </a>
      <header role="banner" className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-sky-700">Cuộc thi</p>
            {portal && <p className="font-semibold text-slate-900">{portal.title}</p>}
          </div>
          {!activeExam && (
            <Link
              to="/student/dashboard"
              aria-label="Quay lại bảng điều khiển học sinh"
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
            >
              Bảng điều khiển
            </Link>
          )}
        </div>
      </header>
      <main id="competition-main" className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {children ?? <Outlet context={portal} />}
      </main>
    </div>
  );
};

export default CompetitionStudentShell;

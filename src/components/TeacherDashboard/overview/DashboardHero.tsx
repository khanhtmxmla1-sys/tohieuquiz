import React from 'react';
import { CalendarDays, GraduationCap, ShieldCheck } from 'lucide-react';
import TeacherDashboardVisual from './TeacherDashboardVisual';

interface DashboardHeroProps {
  greeting: string;
  teacherName: string;
  dateLabel: string;
  scopeLabel: string;
  isAdmin: boolean;
}

const DashboardHero: React.FC<DashboardHeroProps> = ({
  greeting,
  teacherName,
  dateLabel,
  scopeLabel,
  isAdmin,
}) => {
  const description = isAdmin
    ? 'Theo dõi hoạt động toàn trường và xử lý các việc quan trọng trong ngày.'
    : 'Mỗi bài giảng hôm nay là một bước tiến cho tương lai của các em.';

  return (
    <section
      aria-labelledby="teacher-overview-heading"
      className="relative h-full min-h-64 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-[var(--dashboard-card-shadow)] sm:min-h-72"
    >
      <div
        aria-hidden="true"
        className="absolute -left-20 -top-24 size-72 rounded-full bg-blue-100/70 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-24 right-16 size-64 rounded-full bg-cyan-100/70 blur-3xl"
      />

      <div className="relative z-10 grid h-full min-h-64 items-center gap-4 px-5 py-6 sm:min-h-72 sm:px-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(250px,0.85fr)] lg:px-8">
        <div className="max-w-2xl">
          <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600 sm:text-sm">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 shadow-sm">
              <CalendarDays aria-hidden="true" className="size-4 text-blue-600" />
              {dateLabel}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 shadow-sm">
              {isAdmin
                ? <ShieldCheck aria-hidden="true" className="size-4 text-blue-600" />
                : <GraduationCap aria-hidden="true" className="size-4 text-emerald-600" />}
              {scopeLabel}
            </span>
          </div>

          <h1 id="teacher-overview-heading" className="mt-5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl xl:text-4xl">
            {greeting}, {teacherName}!
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
            {description}
          </p>
        </div>

        <TeacherDashboardVisual
          name="teacher-welcome"
          decorative
          loading="eager"
          className="pointer-events-none absolute bottom-0 right-0 hidden h-full w-[48%] object-contain object-bottom-right lg:block"
        />
        <TeacherDashboardVisual
          name="teacher-welcome"
          decorative
          loading="eager"
          className="pointer-events-none mx-auto -mb-6 h-40 w-full max-w-sm object-contain object-bottom sm:h-44 lg:hidden"
        />
      </div>
    </section>
  );
};

export default DashboardHero;

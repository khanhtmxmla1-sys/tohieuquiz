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
      className="relative min-h-56 overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 text-white shadow-[var(--dashboard-card-shadow)] sm:min-h-64 lg:min-h-72"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgb(255_255_255_/_0.18),transparent_38%)]" aria-hidden="true" />
      <div className="relative z-10 grid min-h-56 items-center gap-4 px-5 py-6 sm:min-h-64 sm:px-7 lg:min-h-72 lg:grid-cols-[minmax(0,1.3fr)_minmax(250px,0.55fr)] lg:px-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
        <div className="max-w-2xl">
          <div className="flex flex-wrap gap-2 text-xs font-medium text-blue-50 sm:text-sm">
            <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 backdrop-blur-sm">
              <CalendarDays aria-hidden="true" className="size-4" />
              {dateLabel}
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 backdrop-blur-sm">
              {isAdmin
                ? <ShieldCheck aria-hidden="true" className="size-4" />
                : <GraduationCap aria-hidden="true" className="size-4" />}
              {scopeLabel}
            </span>
          </div>
          <h1 id="teacher-overview-heading" className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl xl:text-4xl">
            {greeting}, {teacherName}!
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-blue-50 sm:text-base sm:leading-7">
            {description}
          </p>
        </div>

        <TeacherDashboardVisual
          name="teacher-welcome"
          decorative
          loading="eager"
          className="pointer-events-none absolute bottom-0 right-0 hidden w-[46%] object-contain object-bottom-right lg:block xl:w-[48%]"
          style={{ height: 288 }}
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

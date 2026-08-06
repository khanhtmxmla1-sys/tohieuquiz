import React from 'react';
import { GraduationCap, ShieldCheck } from 'lucide-react';
import TeacherDashboardVisual from './TeacherDashboardVisual';

interface DashboardHeroProps {
  greeting: string;
  teacherName: string;
  dateLabel: string;
  scopeLabel: string;
  isAdmin: boolean;
}

const DashboardHero: React.FC<DashboardHeroProps> = ({ greeting, teacherName, dateLabel, scopeLabel, isAdmin }) => {
  const description = isAdmin
    ? 'Theo dõi hoạt động toàn trường, quản lý công việc quan trọng và nắm bắt tiến độ học tập trong ngày.'
    : 'Chuẩn bị bài giảng, theo dõi tiến độ lớp học và đồng hành cùng học sinh trong từng hoạt động.';

  return (
    <section
      aria-labelledby="teacher-overview-heading"
      className="relative min-h-[300px] overflow-hidden rounded-[28px] border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-cyan-50 text-slate-900 shadow-[var(--dashboard-card-shadow)]"
    >
      <div className="absolute -left-20 -top-24 size-64 rounded-full bg-blue-200/35 blur-3xl" aria-hidden="true" />
      <div className="absolute bottom-0 right-0 size-72 rounded-full bg-cyan-200/30 blur-3xl" aria-hidden="true" />
      <div className="relative z-10 grid min-h-[300px] items-center gap-4 px-6 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)] lg:px-9">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">{dateLabel}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-600 sm:text-sm">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-2 shadow-sm">
              {isAdmin ? <ShieldCheck aria-hidden="true" className="size-4 text-blue-600" /> : <GraduationCap aria-hidden="true" className="size-4 text-blue-600" />}
              {scopeLabel}
            </span>
          </div>
          <h1 id="teacher-overview-heading" className="mt-5 max-w-xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl xl:text-[42px] xl:leading-tight">
            {greeting}, {teacherName}!
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{description}</p>
        </div>

        <TeacherDashboardVisual
          name="teacher-welcome"
          decorative
          loading="eager"
          className="pointer-events-none hidden h-[285px] w-full object-contain object-bottom lg:block"
        />
        <TeacherDashboardVisual
          name="teacher-welcome"
          decorative
          loading="eager"
          className="pointer-events-none mx-auto -mb-7 h-44 w-full max-w-sm object-contain object-bottom sm:h-52 lg:hidden"
        />
      </div>
    </section>
  );
};

export default DashboardHero;

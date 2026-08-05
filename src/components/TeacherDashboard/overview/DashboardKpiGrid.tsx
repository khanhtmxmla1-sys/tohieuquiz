import React from 'react';
import { Skeleton } from '../../common';
import TeacherDashboardVisual, { type TeacherDashboardVisualName } from './TeacherDashboardVisual';
import { dashboardToneClasses, type DashboardTone } from './dashboardVisualConfig';

export interface DashboardKpi {
  label: string;
  value: string | number;
  helper: string;
  visual: TeacherDashboardVisualName;
  tone: DashboardTone;
  resultDependent?: boolean;
}

interface DashboardKpiGridProps {
  metrics: DashboardKpi[];
  isLoadingResults: boolean;
}

const DashboardKpiGrid: React.FC<DashboardKpiGridProps> = ({ metrics, isLoadingResults }) => (
  <section aria-label="Chỉ số tổng quan" className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
    {metrics.map((metric) => {
      const tone = dashboardToneClasses[metric.tone];
      const showSkeleton = Boolean(metric.resultDependent && isLoadingResults);
      return (
        <article
          key={metric.label}
          className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[var(--dashboard-card-shadow)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-blue-200 sm:p-4"
        >
          <div className="flex items-start gap-3">
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone.surface} sm:size-12`}>
              <TeacherDashboardVisual
                name={metric.visual}
                decorative
                className="size-9 object-contain sm:size-11"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 min-h-8 text-xs font-medium leading-4 text-slate-500 sm:text-sm">{metric.label}</p>
              {showSkeleton ? (
                <Skeleton className="mt-2 h-7 w-16" aria-label={`Đang tải ${metric.label}`} />
              ) : (
                <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
                  {metric.value}
                </p>
              )}
            </div>
          </div>
          <p className="mt-3 line-clamp-2 text-[11px] leading-4 text-slate-500 sm:text-xs sm:leading-5">
            {metric.helper}
          </p>
        </article>
      );
    })}
  </section>
);

export default DashboardKpiGrid;

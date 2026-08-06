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
  <section
    aria-label="Chỉ số tổng quan"
    className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4 xl:grid-cols-5"
  >
    {metrics.map((metric) => {
      const tone = dashboardToneClasses[metric.tone];
      const showSkeleton = Boolean(metric.resultDependent && isLoadingResults);
      return (
        <article
          key={metric.label}
          className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-[var(--dashboard-card-shadow)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:p-4"
        >
          <div className="flex min-w-0 items-center gap-3 xl:gap-4">
            <span className={`grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl ${tone.surface} sm:size-16 xl:size-20`}>
              <TeacherDashboardVisual
                name={metric.visual}
                decorative
                className="size-12 object-contain sm:size-14 xl:size-[72px]"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[11px] font-semibold uppercase leading-4 tracking-[0.08em] text-slate-500 sm:text-xs">
                {metric.label}
              </p>
              {showSkeleton ? (
                <Skeleton className="mt-2 h-7 w-16" aria-label={`Đang tải ${metric.label}`} />
              ) : (
                <p className={`mt-1 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${tone.text}`}>
                  {metric.value}
                </p>
              )}
              <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500 sm:text-[11px]">
                {metric.helper}
              </p>
            </div>
          </div>
        </article>
      );
    })}
  </section>
);

export default DashboardKpiGrid;

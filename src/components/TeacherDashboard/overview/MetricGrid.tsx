import React from 'react';
import { Skeleton } from '../../common';

export interface DashboardMetric {
    label: string;
    value: string | number;
    helper: string;
    icon: React.ReactElement;
    iconClassName: string;
    surfaceClassName: string;
}

interface MetricGridProps {
    metrics: DashboardMetric[];
    isLoadingResults: boolean;
}

const MetricGrid: React.FC<MetricGridProps> = ({ metrics, isLoadingResults }) => (
    <section aria-label="Chỉ số tổng quan" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric, index) => {
            const resultDependent = index > 0;
            const showSkeleton = isLoadingResults && resultDependent;

            return (
                <article key={metric.label} className="rounded-[14px] border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-600">{metric.label}</p>
                            {showSkeleton ? (
                                <Skeleton className="mt-3 h-9 w-20" aria-label={`Đang tải ${metric.label}`} />
                            ) : (
                                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{metric.value}</p>
                            )}
                        </div>
                        {React.cloneElement(metric.icon as React.ReactElement<{ className?: string; 'aria-hidden'?: boolean }>, {
                            className: `size-5 shrink-0 ${metric.iconClassName}`,
                            'aria-hidden': true,
                        })}
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500 sm:text-sm">{metric.helper}</p>
                </article>
            );
        })}
    </section>
);

export default MetricGrid;

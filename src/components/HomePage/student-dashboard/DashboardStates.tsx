import type { ReactNode } from 'react';

const skeletonLineClass = 'rounded-full bg-slate-200';

export function HeroSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Đang tải lời chào"
      className="overflow-hidden rounded-[14px] border border-slate-200 bg-white p-5 sm:p-7"
    >
      <div className="animate-pulse space-y-5" aria-hidden="true">
        <div className="space-y-3">
          <div className={`${skeletonLineClass} h-4 w-28`} />
          <div className={`${skeletonLineClass} h-8 w-3/4 max-w-md`} />
          <div className={`${skeletonLineClass} h-4 w-full max-w-xl`} />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="h-11 w-36 rounded-2xl bg-slate-200" />
          <div className="h-11 w-28 rounded-2xl bg-slate-200" />
        </div>
      </div>
    </section>
  );
}

export function AssignedWorkSkeleton({ count = 3 }: { count?: number }) {
  return (
    <section
      aria-busy="true"
      aria-label="Đang tải bài cần làm"
      className="space-y-3"
    >
      {Array.from({ length: Math.max(0, count) }, (_, index) => (
        <div
          key={index}
          data-testid="assigned-work-skeleton"
          className="animate-pulse rounded-[14px] border border-slate-200 bg-white p-4"
          aria-hidden="true"
        >
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 shrink-0 rounded-2xl bg-slate-200" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className={`${skeletonLineClass} h-4 w-2/3`} />
              <div className={`${skeletonLineClass} h-3 w-full`} />
              <div className={`${skeletonLineClass} h-3 w-1/2`} />
            </div>
            <div className="h-11 w-28 shrink-0 rounded-xl bg-slate-200" />
          </div>
        </div>
      ))}
    </section>
  );
}

export function ProgressSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Đang tải tiến độ học tập"
      className="rounded-[14px] border border-slate-200 bg-white p-5"
    >
      <div className="animate-pulse space-y-5" aria-hidden="true">
        <div className="flex items-center justify-between gap-4">
          <div className={`${skeletonLineClass} h-5 w-36`} />
          <div className={`${skeletonLineClass} h-4 w-14`} />
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-200" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-20 rounded-2xl bg-slate-100" />
          <div className="h-20 rounded-2xl bg-slate-100" />
        </div>
      </div>
    </section>
  );
}

interface DashboardEmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function DashboardEmptyState({
  title,
  description,
  icon,
  action,
}: DashboardEmptyStateProps) {
  return (
    <div
      role="status"
      className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center"
    >
      {icon ? (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-500">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

interface DashboardSectionErrorProps {
  message: string;
  onRetry?: () => void;
}

export function DashboardSectionError({ message, onRetry }: DashboardSectionErrorProps) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-rose-950"
    >
      <p className="text-sm font-medium">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-[10px] border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
        >
          Thử lại
        </button>
      ) : null}
    </div>
  );
}

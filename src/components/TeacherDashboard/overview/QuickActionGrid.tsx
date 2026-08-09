import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';
import TeacherDashboardVisual, { type TeacherDashboardVisualName } from './TeacherDashboardVisual';
import { dashboardToneClasses, type DashboardTone } from './dashboardVisualConfig';

export interface DashboardQuickAction {
  tab: TeacherDashboardTab;
  title: string;
  description: string;
  visual: Extract<TeacherDashboardVisualName,
    'assignment' | 'live-exam' | 'results' | 'classroom' | 'certificate' | 'quiz-management'>;
  tone: DashboardTone;
}

interface QuickActionGridProps {
  actions: DashboardQuickAction[];
  onSelect: (tab: TeacherDashboardTab) => void;
}

const QuickActionGrid: React.FC<QuickActionGridProps> = ({ actions, onSelect }) => (
  <section aria-labelledby="quick-actions-heading">
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-blue-700">Đi tới nhanh</p>
        <h2 id="quick-actions-heading" className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          Thao tác nhanh
        </h2>
      </div>
      <p className="hidden max-w-md text-right text-sm leading-6 text-slate-500 md:block">
        Mở ngay những công việc giáo viên thường sử dụng.
      </p>
    </div>

    <div data-testid="quick-actions-grid" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 xl:gap-4">
      {actions.map((action) => {
        const tone = dashboardToneClasses[action.tone];
        return (
          <button
            key={action.tab}
            type="button"
            onClick={() => onSelect(action.tab)}
            className="group relative flex min-h-28 min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 text-center shadow-[var(--dashboard-card-shadow)] transition-[transform,border-color,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-slate-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <span className={`grid size-14 shrink-0 place-items-center rounded-xl ${tone.surface}`}>
              <TeacherDashboardVisual
                name={action.visual}
                decorative
                className="size-12 object-contain"
              />
            </span>
            <span className="max-w-full line-clamp-2 text-sm font-semibold leading-5 text-slate-900">{action.title}</span>
            <span className="sr-only">{action.description}</span>
            <ArrowUpRight
              aria-hidden="true"
              className="absolute right-2.5 top-2.5 size-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-blue-500"
            />
          </button>
        );
      })}
    </div>
  </section>
);

export default QuickActionGrid;

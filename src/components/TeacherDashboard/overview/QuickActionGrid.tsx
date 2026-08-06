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
  <section
    aria-labelledby="quick-actions-heading"
    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--dashboard-card-shadow)] sm:p-5"
  >
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

    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {actions.map((action) => {
        const tone = dashboardToneClasses[action.tone];
        return (
          <button
            key={action.tab}
            type="button"
            onClick={() => onSelect(action.tab)}
            className="group flex min-h-24 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:min-h-28 sm:p-4"
          >
            <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${tone.surface} sm:size-14`}>
              <TeacherDashboardVisual
                name={action.visual}
                decorative
                className="size-11 object-contain sm:size-12"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900 sm:text-base">{action.title}</span>
                <ArrowUpRight aria-hidden="true" className="hidden size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:block" />
              </span>
              <span className="mt-1 hidden text-xs leading-5 text-slate-500 sm:block">{action.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  </section>
);

export default QuickActionGrid;

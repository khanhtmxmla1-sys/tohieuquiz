import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';

export interface DashboardQuickAction {
    tab: TeacherDashboardTab;
    title: string;
    description: string;
    icon: React.ReactElement;
    iconClassName: string;
    surfaceClassName: string;
}

interface QuickActionGridProps {
    actions: DashboardQuickAction[];
    onSelect: (tab: TeacherDashboardTab) => void;
}

const QuickActionGrid: React.FC<QuickActionGridProps> = ({ actions, onSelect }) => (
    <section aria-labelledby="quick-actions-heading" className="rounded-[14px] border border-[#E5E7EB] bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
                <p className="text-sm font-medium text-[#0284C7]">Thao tác nhanh</p>
                <h2 id="quick-actions-heading" className="mt-1 text-xl font-semibold tracking-tight text-[#172033] sm:text-2xl">
                    Bạn muốn làm gì?
                </h2>
            </div>
            <p className="max-w-md text-sm leading-5 text-[#526174]">
                Mở ngay công việc thường dùng mà không cần tìm trong menu.
            </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {actions.map((action) => (
                <button
                    key={action.tab}
                    type="button"
                    onClick={() => onSelect(action.tab)}
                    className="group flex min-h-24 items-start gap-3 rounded-[12px] border border-[#E5E7EB] bg-white p-3.5 text-left transition-colors hover:border-[#BAE6FD] hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:ring-offset-2 sm:p-4"
                >
                    {React.cloneElement(action.icon as React.ReactElement<{ className?: string; 'aria-hidden'?: boolean }>, {
                        className: `mt-0.5 size-5 shrink-0 ${action.iconClassName}`,
                        'aria-hidden': true,
                    })}
                    <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                            <span className="text-sm font-semibold text-[#172033] sm:text-base">{action.title}</span>
                            <ArrowUpRight aria-hidden="true" className="mt-0.5 hidden size-4 shrink-0 text-[#9AA5B1] transition-colors group-hover:text-[#0284C7] sm:block" />
                        </span>
                        <span className="mt-1 hidden text-sm leading-5 text-[#526174] sm:block">{action.description}</span>
                    </span>
                </button>
            ))}
        </div>
    </section>
);

export default QuickActionGrid;

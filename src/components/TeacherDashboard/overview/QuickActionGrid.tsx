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
            {actions.map((action) => {
                const isPrimary = action.tab === 'create';

                return (
                    <button
                        key={action.tab}
                        type="button"
                        onClick={() => onSelect(action.tab)}
                        className={`group flex min-h-24 items-start gap-3 rounded-[16px] border p-3.5 text-left shadow-[0_2px_10px_rgba(15,23,42,0.05)] transition-[transform,box-shadow,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-[#7DD3FC] hover:shadow-[0_10px_24px_rgba(14,165,233,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:ring-offset-2 sm:p-4 ${
                            isPrimary
                                ? 'border-[#BAE6FD] bg-gradient-to-br from-[#F0F9FF] via-white to-white'
                                : 'border-[#E2E8F0] bg-white'
                        }`}
                    >
                        <span className={`grid size-10 shrink-0 place-items-center rounded-[12px] ${action.surfaceClassName} sm:size-11`}>
                            {React.cloneElement(action.icon as React.ReactElement<{ className?: string; 'aria-hidden'?: boolean }>, {
                                className: `size-5 ${action.iconClassName} sm:size-6`,
                                'aria-hidden': true,
                            })}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                                <span className="text-sm font-semibold text-[#172033] sm:text-base">{action.title}</span>
                                <span className={`hidden size-8 shrink-0 place-items-center rounded-full transition-colors sm:grid ${
                                    isPrimary
                                        ? 'bg-[#E0F2FE] text-[#0284C7]'
                                        : 'bg-[#F1F5F9] text-[#64748B]'
                                } group-hover:bg-[#0EA5E9] group-hover:text-white`}>
                                    <ArrowUpRight aria-hidden="true" className="size-4" />
                                </span>
                            </span>
                            <span className="mt-1 hidden text-sm leading-5 text-[#526174] sm:block">{action.description}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    </section>
);

export default QuickActionGrid;

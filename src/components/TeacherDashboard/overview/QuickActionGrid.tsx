import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Card } from '../../common';
import TohieuIcon, { type TohieuIconName } from '../../icons/TohieuIcon';

import type { TeacherDashboardTab } from '../../../stores/useTeacherDashboardUIStore';

export interface DashboardQuickAction {
    tab: TeacherDashboardTab;
    title: string;
    description: string;
    icon: TohieuIconName;
    surfaceClassName: string;
}

interface QuickActionGridProps {
    actions: DashboardQuickAction[];
    onSelect: (tab: TeacherDashboardTab) => void;
}

const QuickActionGrid: React.FC<QuickActionGridProps> = ({ actions, onSelect }) => (
    <Card as="section" padding="sm" aria-labelledby="quick-actions-heading" className="rounded-[14px] shadow-none sm:p-1">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
                <p className="text-sm font-medium text-sky-700">Thao tác nhanh</p>
                <h2 id="quick-actions-heading" className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                    Bạn muốn làm gì?
                </h2>
            </div>
            <p className="max-w-md text-sm leading-5 text-slate-600">
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
                        className={`group flex min-h-24 items-start gap-3 rounded-[16px] border p-3.5 text-left shadow-[0_2px_10px_rgba(15,23,42,0.05)] transition-[transform,box-shadow,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_10px_24px_rgba(14,165,233,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2 sm:p-4 ${
                            isPrimary
                                ? 'border-sky-200 bg-gradient-to-br from-sky-50 via-white to-white'
                                : 'border-slate-200 bg-white'
                        }`}
                    >
                        <span className={`grid size-12 shrink-0 place-items-center rounded-[14px] ${action.surfaceClassName} sm:size-14`}>
                            <TohieuIcon
                                name={action.icon}
                                size={48}
                                decorative
                                className="size-12 object-contain"
                            />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                                <span className="text-sm font-semibold text-slate-900 sm:text-base">{action.title}</span>
                                <span className={`hidden size-8 shrink-0 place-items-center rounded-full transition-colors sm:grid ${
                                    isPrimary
                                        ? 'bg-sky-100 text-sky-600'
                                        : 'bg-slate-100 text-slate-500'
                                } group-hover:bg-sky-700 group-hover:text-white`}>
                                    <ArrowUpRight aria-hidden="true" className="size-4" />
                                </span>
                            </span>
                            <span className="mt-1 hidden text-sm leading-5 text-slate-600 sm:block">{action.description}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    </Card>
);

export default QuickActionGrid;

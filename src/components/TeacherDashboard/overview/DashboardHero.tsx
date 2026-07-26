import React from 'react';
import {
    ArrowRight,
    CalendarDays,
    FilePlus2,
    GraduationCap,
    ShieldCheck,
} from 'lucide-react';

interface DashboardHeroProps {
    greeting: string;
    teacherName: string;
    dateLabel: string;
    scopeLabel: string;
    isAdmin: boolean;
    todaySubmissionCount: number | string;
    passRate: number | string;
    uniqueStudents: number | string;
    onCreateQuiz: () => void;
    onViewResults: () => void;
}

const DashboardHero: React.FC<DashboardHeroProps> = ({
    greeting,
    teacherName,
    dateLabel,
    scopeLabel,
    isAdmin,
    todaySubmissionCount,
    passRate,
    uniqueStudents,
    onCreateQuiz,
    onViewResults,
}) => (
    <section
        aria-labelledby="teacher-overview-heading"
        className="rounded-[14px] border border-[#E5E7EB] bg-white px-5 py-5 text-[#172033] sm:px-6 sm:py-6 lg:px-7"
    >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)] xl:items-center">
            <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[#526174]">
                    <span className="inline-flex items-center gap-2">
                        <CalendarDays aria-hidden="true" className="size-4 text-[#0284C7]" />
                        {dateLabel}
                    </span>
                    <span aria-hidden="true" className="hidden h-4 w-px bg-[#E5E7EB] sm:block" />
                    <span className="inline-flex items-center gap-2">
                        {isAdmin
                            ? <ShieldCheck aria-hidden="true" className="size-4 text-[#0284C7]" />
                            : <GraduationCap aria-hidden="true" className="size-4 text-[#0284C7]" />}
                        {isAdmin ? 'Quản trị viên' : 'Giáo viên'} · {scopeLabel}
                    </span>
                </div>

                <h1 id="teacher-overview-heading" className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                    {greeting}, {teacherName}!
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526174] sm:text-base">
                    Theo dõi tình hình học tập và xử lý các công việc quan trọng trong một màn hình rõ ràng.
                </p>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                        type="button"
                        onClick={onCreateQuiz}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-[#0EA5E9] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0284C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:ring-offset-2"
                    >
                        <FilePlus2 aria-hidden="true" className="size-5" />
                        Tạo đề mới
                    </button>
                    <button
                        type="button"
                        onClick={onViewResults}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#172033] transition-colors hover:border-[#BAE6FD] hover:bg-[#F0F9FF] hover:text-[#0284C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:ring-offset-2"
                    >
                        Xem kết quả
                        <ArrowRight aria-hidden="true" className="size-4" />
                    </button>
                </div>
            </div>

            <dl className="grid grid-cols-3 divide-x divide-[#E5E7EB] rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] px-2 py-4 sm:px-3">
                <div className="min-w-0 px-2 text-center sm:px-3">
                    <dt className="text-[11px] font-medium leading-4 text-[#7A8796] sm:text-xs">Lượt nộp hôm nay</dt>
                    <dd className="mt-2 text-2xl font-bold text-[#172033]">{todaySubmissionCount}</dd>
                </div>
                <div className="min-w-0 px-2 text-center sm:px-3">
                    <dt className="text-[11px] font-medium leading-4 text-[#7A8796] sm:text-xs">Tỷ lệ đạt</dt>
                    <dd className="mt-2 text-2xl font-bold text-[#172033]">{typeof passRate === 'number' ? `${passRate}%` : passRate}</dd>
                </div>
                <div className="min-w-0 px-2 text-center sm:px-3">
                    <dt className="text-[11px] font-medium leading-4 text-[#7A8796] sm:text-xs">Học sinh</dt>
                    <dd className="mt-2 text-2xl font-bold text-[#172033]">{uniqueStudents}</dd>
                </div>
            </dl>
        </div>
    </section>
);

export default DashboardHero;

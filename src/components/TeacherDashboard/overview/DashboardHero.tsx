import React from 'react';
import {
    ArrowRight,
    CalendarDays,
    FilePlus2,
    GraduationCap,
    ShieldCheck,
} from 'lucide-react';
import { Button } from '../../common';

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
}) => {
    const description = isAdmin
        ? 'Theo dõi hoạt động toàn trường, nắm nhanh số liệu quan trọng và xử lý các công việc cần thiết ngay tại đây.'
        : 'Theo dõi tiến độ học tập của lớp, tạo và giao bài, đồng thời xem nhanh kết quả của học sinh ngay tại đây.';

    return (
        <section
            aria-labelledby="teacher-overview-heading"
            className="rounded-[14px] border border-slate-200 bg-white px-5 py-5 text-slate-900 sm:px-6 sm:py-6 lg:px-7"
        >
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)] xl:items-center">
                <div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-2">
                            <CalendarDays aria-hidden="true" className="size-4 text-sky-600" />
                            {dateLabel}
                        </span>
                        <span aria-hidden="true" className="hidden h-4 w-px bg-slate-200 sm:block" />
                        <span className="inline-flex items-center gap-2">
                            {isAdmin
                                ? <ShieldCheck aria-hidden="true" className="size-4 text-sky-600" />
                                : <GraduationCap aria-hidden="true" className="size-4 text-sky-600" />}
                            {isAdmin ? 'Quản trị viên' : 'Giáo viên'} · {scopeLabel}
                        </span>
                    </div>

                    <h1 id="teacher-overview-heading" className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                        {greeting}, {teacherName}!
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                        {description}
                    </p>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <Button
                            type="button"
                            onClick={onCreateQuiz}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2"
                        >
                            <FilePlus2 aria-hidden="true" className="size-5" />
                            Tạo đề mới
                        </Button>
                        <Button
                            type="button"
                            onClick={onViewResults}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2"
                        >
                            Xem kết quả
                            <ArrowRight aria-hidden="true" className="size-4" />
                        </Button>
                    </div>
                </div>

                <dl className="grid grid-cols-3 divide-x divide-slate-200 rounded-[12px] border border-slate-200 bg-slate-50 px-2 py-4 sm:px-3">
                    <div className="min-w-0 px-2 text-center sm:px-3">
                        <dt className="text-[11px] font-medium leading-4 text-slate-500 sm:text-xs">Lượt nộp hôm nay</dt>
                        <dd className="mt-2 text-2xl font-bold text-slate-900">{todaySubmissionCount}</dd>
                    </div>
                    <div className="min-w-0 px-2 text-center sm:px-3">
                        <dt className="text-[11px] font-medium leading-4 text-slate-500 sm:text-xs">Tỷ lệ đạt</dt>
                        <dd className="mt-2 text-2xl font-bold text-slate-900">{typeof passRate === 'number' ? `${passRate}%` : passRate}</dd>
                    </div>
                    <div className="min-w-0 px-2 text-center sm:px-3">
                        <dt className="text-[11px] font-medium leading-4 text-slate-500 sm:text-xs">Học sinh</dt>
                        <dd className="mt-2 text-2xl font-bold text-slate-900">{uniqueStudents}</dd>
                    </div>
                </dl>
            </div>
        </section>
    );
};

export default DashboardHero;

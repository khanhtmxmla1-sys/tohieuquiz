import React from 'react';
import { ArrowRight, CheckCircle2, Clock3, Inbox, TriangleAlert } from 'lucide-react';
import type { StudentResult } from '../../../types';

interface RecentSubmissionsPanelProps {
    submissions: StudentResult[];
    isLoading: boolean;
    hasError: boolean;
    onViewAll: () => void;
}

const formatSubmissionTime = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Không rõ giờ';
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const RecentSubmissionsPanel: React.FC<RecentSubmissionsPanelProps> = ({
    submissions,
    isLoading,
    hasError,
    onViewAll,
}) => (
    <section aria-labelledby="recent-submissions-heading" className="rounded-[14px] border border-[#E5E7EB] bg-white p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
            <div>
                <p className="text-sm font-medium text-[#0284C7]">Hoạt động hôm nay</p>
                <h2 id="recent-submissions-heading" className="mt-1 text-xl font-semibold tracking-tight text-[#172033]">
                    Bài vừa nộp
                </h2>
            </div>
            <button
                type="button"
                onClick={onViewAll}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] px-2.5 text-xs font-medium text-[#0284C7] transition-colors hover:bg-[#F0F9FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9]"
            >
                Xem tất cả
                <ArrowRight aria-hidden="true" className="size-4" />
            </button>
        </div>

        {isLoading ? (
            <div className="mt-5 space-y-4" aria-label="Đang tải hoạt động gần đây">
                {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="flex animate-pulse items-center gap-3">
                        <div className="size-10 rounded-full bg-[#E5E7EB]" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3 w-4/5 rounded bg-[#E5E7EB]" />
                            <div className="h-3 w-2/5 rounded bg-[#F1F5F9]" />
                        </div>
                    </div>
                ))}
            </div>
        ) : submissions.length > 0 ? (
            <ol className="mt-4 divide-y divide-[#E5E7EB]">
                {submissions.map((result) => {
                    const score = Number(result.score || 0);
                    const isPass = score >= 5;
                    return (
                        <li key={result.id} className="flex items-start gap-3 py-3 first:pt-1 last:pb-0">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#BAE6FD] bg-[#F0F9FF] text-sm font-semibold text-[#0284C7]">
                                {result.studentName.trim().charAt(0).toUpperCase() || '?'}
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-[#172033]">{result.studentName}</p>
                                        <p className="mt-0.5 line-clamp-1 text-xs text-[#526174]">
                                            <span>vừa nộp</span> {result.quizTitle || 'Bài kiểm tra'}
                                        </p>
                                    </div>
                                    <span className={`shrink-0 text-sm font-semibold ${isPass ? 'text-[#0D8B67]' : 'text-[#A16207]'}`}>
                                        {score} điểm
                                    </span>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${isPass ? 'text-[#0D8B67]' : 'text-[#A16207]'}`}>
                                        {isPass
                                            ? <CheckCircle2 aria-hidden="true" className="size-3.5" />
                                            : <TriangleAlert aria-hidden="true" className="size-3.5" />}
                                        {isPass ? 'Đạt' : 'Chưa đạt'}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#7A8796]">
                                        <Clock3 aria-hidden="true" className="size-3.5" />
                                        {formatSubmissionTime(result.submittedAt)}
                                    </span>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ol>
        ) : (
            <div className="py-10 text-center">
                <Inbox aria-hidden="true" className="mx-auto size-8 text-[#9AA5B1]" />
                <p className="mt-3 text-sm font-semibold text-[#172033]">
                    {hasError ? 'Không thể tải hoạt động' : 'Chưa có bài nộp hôm nay'}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#526174]">
                    {hasError ? 'Thử tải lại dữ liệu để xem các bài mới nhất.' : 'Các lượt nộp mới sẽ xuất hiện tại đây.'}
                </p>
            </div>
        )}
    </section>
);

export default RecentSubmissionsPanel;

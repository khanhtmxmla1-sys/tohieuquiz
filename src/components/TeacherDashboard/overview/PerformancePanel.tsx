import React from 'react';
import { BarChart3, Target } from 'lucide-react';
import type { ResultSummaryStatistics } from '../../../../shared/result-summary.contract';

interface PerformancePanelProps {
    statistics: ResultSummaryStatistics;
    isLoading: boolean;
    hasError?: boolean;
}

const PerformancePanel: React.FC<PerformancePanelProps> = ({ statistics, isLoading, hasError = false }) => {
    if (isLoading) {
        return (
            <section aria-label="Đang tải tình hình học tập" className="rounded-[14px] border border-[#E5E7EB] bg-white p-5 sm:p-6">
                <div className="h-5 w-48 animate-pulse rounded bg-[#E5E7EB]" />
                <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="h-64 animate-pulse rounded-[12px] bg-[#F1F5F9]" />
                    <div className="h-64 animate-pulse rounded-[12px] bg-[#F1F5F9]" />
                </div>
            </section>
        );
    }

    if (hasError) {
        return (
            <section className="rounded-[14px] border border-dashed border-[#F3B5A7] bg-white px-5 py-12 text-center sm:px-8">
                <BarChart3 aria-hidden="true" className="mx-auto size-8 text-[#E76F51]" />
                <h2 className="mt-4 text-xl font-semibold text-[#172033]">Không thể tải tình hình điểm số</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#526174]">
                    Dữ liệu tổng hợp chưa sẵn sàng. Hãy thử tải lại để xem các chỉ số đầy đủ.
                </p>
            </section>
        );
    }

    if (statistics.totalResults === 0) {
        return (
            <section className="rounded-[14px] border border-dashed border-[#D1D5DB] bg-white px-5 py-12 text-center sm:px-8">
                <BarChart3 aria-hidden="true" className="mx-auto size-8 text-[#9AA5B1]" />
                <h2 className="mt-4 text-xl font-semibold text-[#172033]">Chưa có dữ liệu học tập</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#526174]">
                    Biểu đồ phân bố điểm và tỷ lệ đạt sẽ xuất hiện sau khi học sinh hoàn thành bài kiểm tra.
                </p>
            </section>
        );
    }

    const maxCount = Math.max(...statistics.scoreDistribution.map((item) => item.count), 1);

    return (
        <section aria-labelledby="performance-heading" className="rounded-[14px] border border-[#E5E7EB] bg-white p-4 sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                    <p className="text-sm font-medium text-[#0284C7]">Kết quả học tập</p>
                    <h2 id="performance-heading" className="mt-1 text-xl font-semibold tracking-tight text-[#172033] sm:text-2xl">
                        Tình hình điểm số
                    </h2>
                    <p className="mt-1 text-sm text-[#526174]">
                        Tổng hợp từ {statistics.totalResults} bài hoàn thành; mỗi bài lấy lần nộp cuối cùng.
                    </p>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-[#526174]">
                    <Target aria-hidden="true" className="size-4 text-[#0284C7]" />
                    Mốc đạt: 5 điểm
                </span>
            </div>

            <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_230px] lg:items-stretch">
                <div>
                    <div
                        role="img"
                        aria-label={`Biểu đồ phân bố điểm: ${statistics.scoreDistribution.map((item) => `${item.range}: ${item.count} bài`).join(', ')}`}
                        className="grid h-56 grid-cols-5 items-end gap-2 border-b border-[#E5E7EB] px-1 pt-4 sm:gap-4 sm:px-3"
                    >
                        {statistics.scoreDistribution.map((item) => {
                            const heightPercent = item.count === 0 ? 4 : Math.max(12, Math.round((item.count / maxCount) * 100));
                            return (
                                <div key={item.range} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                                    <span className="text-xs font-semibold text-[#526174]">{item.count}</span>
                                    <div className="flex h-[156px] w-full items-end justify-center bg-[#F1F5F9] sm:h-[168px]">
                                        <div
                                            className="w-full max-w-14 bg-[#0EA5E9] transition-[height] duration-300 motion-reduce:transition-none"
                                            style={{ height: `${heightPercent}%` }}
                                        />
                                    </div>
                                    <span className="whitespace-nowrap text-[11px] font-medium text-[#7A8796] sm:text-xs">{item.range}</span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="mt-3 text-center text-xs text-[#9AA5B1]">Khoảng điểm</p>
                </div>

                <div className="flex flex-col rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                    <p className="text-sm font-medium text-[#526174]">Tỷ lệ đạt</p>
                    <p className="mt-2 text-4xl font-bold tracking-tight text-[#172033]">{statistics.passRate}%</p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E5E7EB]" aria-hidden="true">
                        <div className="h-full bg-[#10B981]" style={{ width: `${Math.min(100, Math.max(0, statistics.passRate))}%` }} />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#7A8796]">Tính trên các bài đạt từ 5 điểm trở lên.</p>

                    <dl className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 border-t border-[#E5E7EB] pt-4 text-sm">
                        <div>
                            <dt className="text-xs text-[#7A8796]">Điểm trung bình</dt>
                            <dd className="mt-1 font-semibold text-[#172033]">{statistics.mean}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[#7A8796]">Trung vị</dt>
                            <dd className="mt-1 font-semibold text-[#172033]">{statistics.median}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[#7A8796]">Cao nhất</dt>
                            <dd className="mt-1 font-semibold text-[#0D8B67]">{statistics.max}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-[#7A8796]">Thấp nhất</dt>
                            <dd className="mt-1 font-semibold text-[#A16207]">{statistics.min}</dd>
                        </div>
                    </dl>

                    <div className="mt-auto grid grid-cols-2 gap-2 pt-5 text-center text-xs font-medium">
                        <span className="rounded-[8px] border border-[#A7F3D0] bg-[#ECFDF5] px-2 py-2 text-[#0D8B67]">{statistics.passCount} bài đạt</span>
                        <span className="rounded-[8px] border border-[#FDE68A] bg-[#FFFBEB] px-2 py-2 text-[#A16207]">{statistics.failCount} chưa đạt</span>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default PerformancePanel;

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
            <section aria-label="Đang tải tình hình học tập" className="rounded-[14px] border border-slate-200 bg-white p-5 sm:p-6">
                <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
                <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="h-64 animate-pulse rounded-[12px] bg-slate-100" />
                    <div className="h-64 animate-pulse rounded-[12px] bg-slate-100" />
                </div>
            </section>
        );
    }

    if (hasError) {
        return (
            <section className="rounded-[14px] border border-dashed border-orange-200 bg-white px-5 py-12 text-center sm:px-8">
                <BarChart3 aria-hidden="true" className="mx-auto size-8 text-orange-600" />
                <h2 className="mt-4 text-xl font-semibold text-slate-900">Không thể tải tình hình điểm số</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                    Dữ liệu tổng hợp chưa sẵn sàng. Hãy thử tải lại để xem các chỉ số đầy đủ.
                </p>
            </section>
        );
    }

    if (statistics.totalResults === 0) {
        return (
            <section className="rounded-[14px] border border-dashed border-slate-300 bg-white px-5 py-12 text-center sm:px-8">
                <BarChart3 aria-hidden="true" className="mx-auto size-8 text-slate-400" />
                <h2 className="mt-4 text-xl font-semibold text-slate-900">Chưa có dữ liệu học tập</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                    Biểu đồ phân bố điểm và tỷ lệ đạt sẽ xuất hiện sau khi học sinh hoàn thành bài kiểm tra.
                </p>
            </section>
        );
    }

    const maxCount = Math.max(...statistics.scoreDistribution.map((item) => item.count), 1);

    return (
        <section aria-labelledby="performance-heading" className="rounded-[14px] border border-slate-200 bg-white p-4 sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                    <p className="text-sm font-medium text-sky-700">Kết quả học tập</p>
                    <h2 id="performance-heading" className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                        Tình hình điểm số
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                        Tổng hợp từ {statistics.totalResults} bài hoàn thành; mỗi bài lấy lần nộp cuối cùng.
                    </p>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                    <Target aria-hidden="true" className="size-4 text-sky-700" />
                    Mốc đạt: 5 điểm
                </span>
            </div>

            <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_230px] lg:items-stretch">
                <div>
                    <div
                        role="img"
                        aria-label={`Biểu đồ phân bố điểm: ${statistics.scoreDistribution.map((item) => `${item.range}: ${item.count} bài`).join(', ')}`}
                        className="grid h-56 grid-cols-5 items-end gap-2 border-b border-slate-200 px-1 pt-4 sm:gap-4 sm:px-3"
                    >
                        {statistics.scoreDistribution.map((item) => {
                            const heightPercent = item.count === 0 ? 4 : Math.max(12, Math.round((item.count / maxCount) * 100));
                            return (
                                <div key={item.range} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                                    <span className="text-xs font-semibold text-slate-600">{item.count}</span>
                                    <div className="flex h-[156px] w-full items-end justify-center bg-slate-100 sm:h-[168px]">
                                        <div
                                            className="w-full max-w-14 bg-sky-700 transition-[height] duration-300 motion-reduce:transition-none"
                                            style={{ height: `${heightPercent}%` }}
                                        />
                                    </div>
                                    <span className="whitespace-nowrap text-[11px] font-medium text-slate-500 sm:text-xs">{item.range}</span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="mt-3 text-center text-xs text-slate-400">Khoảng điểm</p>
                </div>

                <div className="flex flex-col rounded-[12px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-600">Tỷ lệ đạt</p>
                    <p className="mt-2 text-4xl font-bold tracking-tight text-slate-900">{statistics.passRate}%</p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                        <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, statistics.passRate))}%` }} />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">Tính trên các bài đạt từ 5 điểm trở lên.</p>

                    <dl className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 border-t border-slate-200 pt-4 text-sm">
                        <div>
                            <dt className="text-xs text-slate-500">Điểm trung bình</dt>
                            <dd className="mt-1 font-semibold text-slate-900">{statistics.mean}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-slate-500">Trung vị</dt>
                            <dd className="mt-1 font-semibold text-slate-900">{statistics.median}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-slate-500">Cao nhất</dt>
                            <dd className="mt-1 font-semibold text-emerald-700">{statistics.max}</dd>
                        </div>
                        <div>
                            <dt className="text-xs text-slate-500">Thấp nhất</dt>
                            <dd className="mt-1 font-semibold text-amber-700">{statistics.min}</dd>
                        </div>
                    </dl>

                    <div className="mt-auto grid grid-cols-2 gap-2 pt-5 text-center text-xs font-medium">
                        <span className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-2 py-2 text-emerald-700">{statistics.passCount} bài đạt</span>
                        <span className="rounded-[8px] border border-amber-200 bg-amber-50 px-2 py-2 text-amber-700">{statistics.failCount} chưa đạt</span>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default PerformancePanel;

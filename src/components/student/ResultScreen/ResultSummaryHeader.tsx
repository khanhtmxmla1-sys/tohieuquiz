import React from 'react';
import { CheckCircle2, Clock3, MinusCircle, XCircle } from 'lucide-react';
import type { StudentResultSummary } from '../../../features/results/studentResultSummary';

interface ResultSummaryHeaderProps {
    summary: StudentResultSummary;
    durationLabel: string;
}

const ResultSummaryHeader: React.FC<ResultSummaryHeaderProps> = ({ summary, durationLabel }) => {
    const correctWidth = summary.total > 0 ? (summary.correct / summary.total) * 100 : 0;
    const incorrectWidth = summary.total > 0 ? (summary.incorrect / summary.total) * 100 : 0;
    const skippedWidth = Math.max(0, 100 - correctWidth - incorrectWidth);

    return (
        <section aria-labelledby="result-summary-title" className="rounded-[14px] border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-sm font-semibold text-sky-700">Kết quả bài làm</p>
                    <h1 id="result-summary-title" className="mt-1 text-4xl font-bold tracking-tight text-slate-950">
                        {summary.score10}/10
                    </h1>
                    <p className="mt-2 text-sm font-medium text-slate-600">
                        {summary.correct} đúng · {summary.incorrect} sai · {summary.skipped} chưa làm
                    </p>
                </div>

                <div className="flex items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    <Clock3 className="h-4 w-4 text-sky-600" aria-hidden="true" />
                    {durationLabel}
                </div>
            </div>

            <div
                className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-100"
                aria-label={`${summary.correct} câu đúng, ${summary.incorrect} câu sai, ${summary.skipped} câu chưa làm`}
            >
                <div className="h-full bg-emerald-500" style={{ width: `${correctWidth}%` }} />
                <div className="h-full bg-rose-500" style={{ width: `${incorrectWidth}%` }} />
                <div className="h-full bg-slate-300" style={{ width: `${skippedWidth}%` }} />
            </div>

            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span className="font-semibold">Đúng {summary.correct}</span>
                </div>
                <div className="flex items-center gap-2 text-rose-700">
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    <span className="font-semibold">Sai {summary.incorrect}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                    <MinusCircle className="h-4 w-4" aria-hidden="true" />
                    <span className="font-semibold">Chưa làm {summary.skipped}</span>
                </div>
            </div>
        </section>
    );
};

export default ResultSummaryHeader;

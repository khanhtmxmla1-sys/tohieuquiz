import React, { useMemo } from 'react';
import { ArrowRight, BookOpenCheck, RotateCcw } from 'lucide-react';
import type { StudentResult } from '../../../../types';
import {
    buildStudentResultSummary,
    formatResultDuration,
    type StudentResultSummary,
} from '../../../../features/results/studentResultSummary';
import ResultSummaryHeader from '../ResultSummaryHeader';

interface Props {
    result: StudentResult;
    answers: Record<string, unknown>;
    onOpenReview: (filter?: 'incorrect' | 'skipped') => void;
    onOpenStudyPlan: () => void;
}

const getNextStep = (summary: StudentResultSummary) => {
    if (summary.skipped > 0) {
        return {
            title: `Em còn ${summary.skipped} câu chưa làm.`,
            description: 'Hãy xem lại các câu này trước. Nếu bài còn lượt làm, em có thể thử lại để hoàn thành đầy đủ hơn.',
            action: 'Xem câu chưa làm',
            target: 'skipped' as const,
        };
    }
    if (summary.incorrect > 0) {
        return {
            title: `Em có ${summary.incorrect} câu cần xem lại.`,
            description: 'Xem lại đáp án của em và đáp án đúng, sau đó mở kế hoạch ôn tập khi cần.',
            action: 'Xem câu sai',
            target: 'incorrect' as const,
        };
    }
    return {
        title: 'Em đã hoàn thành tất cả câu hỏi.',
        description: 'Kết quả đã được lưu. Em có thể xem lại bài hoặc tiếp tục với một thử thách mới.',
        action: 'Xem lại bài',
        target: undefined,
    };
};

const OverviewTab: React.FC<Props> = ({ result, answers, onOpenReview, onOpenStudyPlan }) => {
    const summary = useMemo(() => buildStudentResultSummary(result, answers), [answers, result]);
    const nextStep = getNextStep(summary);

    return (
        <section role="tabpanel" aria-label="Kết quả" className="space-y-4 p-4 sm:p-6">
            <ResultSummaryHeader summary={summary} durationLabel={formatResultDuration(result.timeTaken)} />

            <section aria-labelledby="next-step-title" className="rounded-[14px] border border-sky-200 bg-sky-50 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-sky-200 bg-white text-sky-700">
                        {summary.skipped > 0 ? (
                            <RotateCcw className="h-5 w-5" aria-hidden="true" />
                        ) : (
                            <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 id="next-step-title" className="text-lg font-bold text-slate-900">{nextStep.title}</h2>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">{nextStep.description}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => onOpenReview(nextStep.target)}
                                className="inline-flex items-center gap-2 rounded-[9px] bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                            >
                                {nextStep.action}
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </button>
                            {summary.incorrect > 0 ? (
                                <button
                                    type="button"
                                    onClick={onOpenStudyPlan}
                                    className="rounded-[9px] border border-sky-300 bg-white px-4 py-2.5 text-sm font-bold text-sky-700 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                                >
                                    Mở kế hoạch ôn tập
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>
            </section>
        </section>
    );
};

export default OverviewTab;

/**
 * Cohort question analysis for the teacher results dashboard.
 * Ranks instructional priorities from the selected class and quiz.
 */

import React, { useMemo, useState } from 'react';
import {
    AlertTriangle,
    BookOpenCheck,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    CircleHelp,
    Loader2,
    Target,
    Users,
} from 'lucide-react';
import {
    type AnalysisAttemptMode,
    type QuestionAnalysis,
} from '../../../utils/statisticsUtils';
import MathSpan from '../../common/MathSpan';

interface QuestionAnalysisTableProps {
    analysis: QuestionAnalysis[];
    showTopMissed?: number;
    cohortSize: number;
    attemptMode: AnalysisAttemptMode;
    onAttemptModeChange: (mode: AnalysisAttemptMode) => void;
    isLoading?: boolean;
    error?: string;
}

const priorityPresentation = {
    high: {
        label: 'Ưu tiên cao',
        badge: 'border-red-200 bg-red-50 text-red-700',
        bar: 'bg-red-500',
    },
    medium: {
        label: 'Cần củng cố',
        badge: 'border-amber-200 bg-amber-50 text-amber-700',
        bar: 'bg-amber-500',
    },
    low: {
        label: 'Đang ổn',
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        bar: 'bg-emerald-500',
    },
} as const;

export const QuestionAnalysisTable: React.FC<QuestionAnalysisTableProps> = ({
    analysis,
    showTopMissed = 5,
    cohortSize,
    attemptMode,
    onAttemptModeChange,
    isLoading = false,
    error = '',
}) => {
    const [showAll, setShowAll] = useState(false);
    const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

    const rankedAnalysis = useMemo(() => (
        analysis
            .filter(item => item.evaluatedCount > 0)
            .sort((left, right) => (
                right.wrongRate - left.wrongRate
                || right.wrongCount - left.wrongCount
                || left.questionNumber - right.questionNumber
            ))
    ), [analysis]);

    const visibleAnalysis = showAll ? rankedAnalysis : rankedAnalysis.slice(0, showTopMissed);
    const topQuestion = rankedAnalysis[0];
    const highPriorityCount = rankedAnalysis.filter(item => item.priority === 'high').length;

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-blue-700 p-5 text-white">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h3 className="flex items-center gap-2 text-lg font-bold">
                            <Target className="h-5 w-5" />
                            Câu sai nhiều nhất
                        </h3>
                        <p className="mt-1 text-sm text-blue-100">
                            Xếp hạng theo tỷ lệ sai, sau đó theo số học sinh sai để ưu tiên nội dung cần giảng lại.
                        </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <span className="text-blue-100">Cách tính:</span>
                        <select
                            value={attemptMode}
                            onChange={event => onAttemptModeChange(event.target.value as AnalysisAttemptMode)}
                            className="rounded-lg border border-white/30 bg-white px-3 py-2 font-medium text-slate-700 shadow-sm"
                        >
                            <option value="latest">Mỗi học sinh: lượt mới nhất</option>
                            <option value="all">Tất cả lượt làm</option>
                        </select>
                    </label>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}

            {isLoading && rankedAnalysis.length === 0 ? (
                <div className="flex items-center justify-center gap-3 py-12 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    Đang tổng hợp đáp án của cả lớp...
                </div>
            ) : rankedAnalysis.length === 0 ? (
                <div className="px-5 py-12 text-center">
                    <CircleHelp className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-3 font-semibold text-slate-700">Chưa đủ dữ liệu để phân tích câu hỏi</p>
                    <p className="mt-1 text-sm text-slate-500">
                        Các bài làm hiện tại chưa có dữ liệu đáp án tương ứng với bộ câu hỏi đã chọn.
                    </p>
                </div>
            ) : (
                <>
                    <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <Users className="h-4 w-4 text-blue-600" /> Học sinh được tính
                            </div>
                            <p className="mt-1 text-2xl font-bold text-slate-800">{cohortSize}</p>
                            <p className="mt-1 text-xs text-slate-500">
                                {attemptMode === 'latest' ? 'Không tính trùng học sinh làm lại' : 'Đang tính tất cả lượt làm'}
                            </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <AlertTriangle className="h-4 w-4 text-red-500" /> Cần ưu tiên cao
                            </div>
                            <p className="mt-1 text-2xl font-bold text-red-600">{highPriorityCount}</p>
                            <p className="mt-1 text-xs text-slate-500">Câu có ít nhất 50% học sinh trả lời sai</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <Target className="h-4 w-4 text-violet-500" /> Câu cần xem trước
                            </div>
                            <p className="mt-1 text-2xl font-bold text-cyan-800">
                                {topQuestion ? `Câu ${topQuestion.questionNumber}` : '—'}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                {topQuestion ? `${topQuestion.wrongRate}% trả lời sai` : 'Chưa có dữ liệu'}
                            </p>
                        </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {visibleAnalysis.map((item, rank) => {
                            const presentation = priorityPresentation[item.priority];
                            const expanded = expandedQuestionId === item.questionId;
                            const topWrongAnswer = item.commonWrongAnswers[0];

                            return (
                                <article key={item.questionId} className="p-4 transition-colors hover:bg-slate-50/70 sm:p-5">
                                    <div className="flex items-start gap-3 sm:gap-4">
                                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                            rank < showTopMissed
                                                ? 'bg-red-500 text-white'
                                                : 'bg-slate-200 text-slate-700'
                                        }`}>
                                            {rank + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                                    Câu {item.questionNumber}
                                                </span>
                                                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${presentation.badge}`}>
                                                    {presentation.label}
                                                </span>
                                                {item.skippedCount > 0 && (
                                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                                        {item.skippedCount} bỏ trống
                                                    </span>
                                                )}
                                            </div>

                                            <MathSpan
                                                content={item.questionText}
                                                className="mt-2 block text-sm font-medium leading-6 text-slate-800"
                                            />

                                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                                                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                                                    <div
                                                        className={`h-full rounded-full ${presentation.bar}`}
                                                        style={{ width: `${item.wrongRate}%` }}
                                                    />
                                                </div>
                                                <div className="shrink-0 text-sm">
                                                    <span className="font-bold text-red-600">{item.wrongCount}/{item.evaluatedCount} sai</span>
                                                    <span className="ml-2 text-slate-500">({item.wrongRate}%)</span>
                                                </div>
                                            </div>

                                            <div className="mt-3 grid gap-2 text-sm lg:grid-cols-2">
                                                <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">
                                                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                                    <span>
                                                        <strong>Đáp án đúng:</strong>{' '}
                                                        <MathSpan content={item.correctAnswerText || 'Xem trong nội dung câu hỏi'} />
                                                    </span>
                                                </div>
                                                <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                                                    <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0" />
                                                    <span>
                                                        <strong>Sai phổ biến:</strong>{' '}
                                                        {topWrongAnswer
                                                            ? <MathSpan content={`${topWrongAnswer.answer} (${topWrongAnswer.count} học sinh)`} />
                                                            : 'Chưa xác định được mẫu sai'}
                                                    </span>
                                                </div>
                                            </div>

                                            {(item.affectedStudents.length > 0 || item.unknownCount > 0) && (
                                                <div className="mt-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedQuestionId(expanded ? null : item.questionId)}
                                                        className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800"
                                                    >
                                                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                        {expanded ? 'Ẩn chi tiết' : `Xem ${item.affectedStudents.length} học sinh cần hỗ trợ`}
                                                    </button>
                                                    {expanded && (
                                                        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                                            {item.affectedStudents.length > 0 && (
                                                                <p><strong>Học sinh:</strong> {item.affectedStudents.join(', ')}</p>
                                                            )}
                                                            {item.commonWrongAnswers.length > 1 && (
                                                                <p className="mt-1">
                                                                    <strong>Các mẫu sai:</strong>{' '}
                                                                    <MathSpan content={item.commonWrongAnswers.map(entry => `${entry.answer} (${entry.count})`).join(' • ')} />
                                                                </p>
                                                            )}
                                                            {item.unknownCount > 0 && (
                                                                <p className="mt-1 text-amber-700">
                                                                    {item.unknownCount} đáp án cũ chưa xác định được đúng/sai và không được đưa vào mẫu số.
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>

                    {rankedAnalysis.length > showTopMissed && (
                        <div className="border-t border-slate-100 p-4 text-center">
                            <button
                                type="button"
                                onClick={() => setShowAll(current => !current)}
                                className="font-semibold text-blue-700 hover:text-blue-800"
                            >
                                {showAll ? 'Thu gọn' : `Xem toàn bộ ${rankedAnalysis.length} câu có dữ liệu`}
                            </button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
};

export default QuestionAnalysisTable;

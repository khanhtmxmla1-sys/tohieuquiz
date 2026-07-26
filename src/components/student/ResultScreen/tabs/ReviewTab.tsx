import React, { useMemo, useState } from 'react';
import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import type { Quiz, StudentResult } from '../../../../types';
import MathSpan from '../../../common/MathSpan';
import {
    getStoredAnswerOutcome,
    type AnswerOutcome,
} from '../../../../features/results/studentResultSummary';

interface ReviewTabProps {
    quiz: Quiz;
    result: StudentResult;
    answers: Record<string, unknown>;
    initialFilter?: ReviewFilter;
}

type ReviewFilter = 'all' | 'incorrect' | 'skipped';

const formatAnswer = (value: unknown): string => {
    if (value === undefined || value === null || value === '') return 'Chưa trả lời';
    if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : 'Chưa trả lời';
    if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([key]) => key !== 'selectedLeft' && key !== '__shuffledIds')
            .map(([key, item]) => `${key}: ${String(item)}`);
        return entries.length > 0 ? entries.join(' · ') : 'Chưa trả lời';
    }
    if (typeof value === 'boolean') return value ? 'Đúng' : 'Sai';
    return String(value);
};

const getSelectedAnswer = (result: StudentResult, questionId: string, fallback: unknown): unknown => {
    const stored = result.answers?.[questionId];
    if (stored && typeof stored === 'object' && !Array.isArray(stored) && 'selectedAnswer' in stored) {
        return (stored as { selectedAnswer?: unknown }).selectedAnswer;
    }
    return fallback;
};

const getCorrectAnswer = (result: StudentResult, questionId: string, question: any): unknown => {
    const stored = result.answers?.[questionId];
    const snapshot = stored && typeof stored === 'object' && !Array.isArray(stored)
        ? (stored as { questionSnapshot?: any }).questionSnapshot
        : null;
    const validation = result.validationDetails?.find((detail) => detail.questionId === questionId);
    return validation?.correctAnswer
        ?? snapshot?.correctAnswer
        ?? snapshot?.correctAnswers
        ?? snapshot?.correctWord
        ?? question.correctAnswer
        ?? question.correctAnswers
        ?? question.correctWord
        ?? null;
};

const statusMeta: Record<AnswerOutcome, { label: string; className: string; icon: React.ReactNode }> = {
    correct: {
        label: 'Đúng',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
    },
    incorrect: {
        label: 'Sai',
        className: 'border-rose-200 bg-rose-50 text-rose-700',
        icon: <XCircle className="h-4 w-4" aria-hidden="true" />,
    },
    skipped: {
        label: 'Chưa làm',
        className: 'border-slate-200 bg-slate-50 text-slate-600',
        icon: <MinusCircle className="h-4 w-4" aria-hidden="true" />,
    },
};

const ReviewTab: React.FC<ReviewTabProps> = ({ quiz, result, answers, initialFilter = 'all' }) => {
    const [filter, setFilter] = useState<ReviewFilter>(initialFilter);
    const items = useMemo(() => quiz.questions.map((question, index) => ({
        question,
        index,
        outcome: getStoredAnswerOutcome(result, question.id, answers[question.id]),
    })), [answers, quiz.questions, result]);
    const incorrectCount = items.filter((item) => item.outcome === 'incorrect').length;
    const skippedCount = items.filter((item) => item.outcome === 'skipped').length;
    const visibleItems = filter === 'all' ? items : items.filter((item) => item.outcome === filter);

    return (
        <section role="tabpanel" aria-label="Xem lại bài" className="space-y-5 p-4 sm:p-6">
            <div>
                <h2 className="text-xl font-bold text-slate-900">Xem lại bài</h2>
                <p className="mt-1 text-sm text-slate-600">Lọc nhanh các câu sai hoặc chưa làm để xem lại trước.</p>
            </div>

            <div className="flex flex-wrap gap-2" aria-label="Bộ lọc câu hỏi">
                {([
                    ['all', `Tất cả ${items.length}`],
                    ['incorrect', `Câu sai ${incorrectCount}`],
                    ['skipped', `Chưa làm ${skippedCount}`],
                ] as const).map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setFilter(value)}
                        aria-pressed={filter === value}
                        className={`rounded-[9px] border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                            filter === value
                                ? 'border-sky-600 bg-sky-600 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                {visibleItems.map(({ question, index, outcome }) => {
                    const meta = statusMeta[outcome];
                    const selectedAnswer = getSelectedAnswer(result, question.id, answers[question.id]);
                    const correctAnswer = getCorrectAnswer(result, question.id, question);
                    const questionText = (question as any).question || (question as any).mainQuestion || `Câu ${index + 1}`;

                    return (
                        <article key={question.id} className="rounded-[12px] border border-slate-200 bg-white p-4 sm:p-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm font-bold text-slate-500">Câu {index + 1}</p>
                                <span className={`inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-bold ${meta.className}`}>
                                    {meta.icon}
                                    {meta.label}
                                </span>
                            </div>
                            <MathSpan
                                content={questionText}
                                as="p"
                                className="mt-3 font-semibold leading-relaxed text-slate-900"
                            />
                            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                                <div className="rounded-[9px] bg-slate-50 p-3">
                                    <dt className="font-semibold text-slate-500">Câu trả lời của em</dt>
                                    <dd className="mt-1 break-words font-medium text-slate-800">
                                        <MathSpan content={formatAnswer(selectedAnswer)} />
                                    </dd>
                                </div>
                                {outcome !== 'correct' && correctAnswer !== null ? (
                                    <div className="rounded-[9px] bg-emerald-50 p-3">
                                        <dt className="font-semibold text-emerald-700">Đáp án đúng</dt>
                                        <dd className="mt-1 break-words font-medium text-emerald-900">
                                            <MathSpan content={formatAnswer(correctAnswer)} />
                                        </dd>
                                    </div>
                                ) : null}
                            </dl>
                        </article>
                    );
                })}
            </div>
        </section>
    );
};

export default ReviewTab;

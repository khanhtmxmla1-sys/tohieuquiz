import React, { useMemo, useState } from 'react';
import { Ban, CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import type { Quiz, StudentResult } from '../../../../types';
import {
    buildQuestionAnswerReview,
    unwrapStoredResultAnswer,
} from '../../../../domain/quiz-scoring';
import MathSpan from '../../../common/MathSpan';
import QuestionRichTextRenderer from '../../../common/QuestionRichTextRenderer';
import QuestionMedia from '../../../common/QuestionMedia';
import StudentReviewBody from '../../../common/QuestionReview/StudentReviewBody';
import {
    getStoredAnswerOutcome,
    type AnswerOutcome,
} from '../../../../features/results/studentResultSummary';

interface ReviewTabProps {
    quiz: Quiz;
    result: StudentResult;
    answers: Record<string, unknown>;
    hasAuthoritativeValidation?: boolean;
    initialFilter?: ReviewFilter;
}

type ReviewFilter = 'all' | 'incorrect' | 'skipped';

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
    voided: {
        label: 'Không tính điểm',
        className: 'border-amber-200 bg-amber-50 text-amber-800',
        icon: <Ban className="h-4 w-4" aria-hidden="true" />,
    },
};

const ReviewTab: React.FC<ReviewTabProps> = ({
    quiz,
    result,
    answers,
    hasAuthoritativeValidation = false,
    initialFilter = 'all',
}) => {
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
                    const storedAnswer = result.answers?.[question.id] ?? answers[question.id];
                    const serverReview = result.reviewDetails?.find((detail) => detail.questionId === question.id);
                    const storedSnapshot = storedAnswer && typeof storedAnswer === 'object' && !Array.isArray(storedAnswer)
                        ? (storedAnswer as { questionSnapshot?: unknown }).questionSnapshot
                        : undefined;
                    const hasAuthoritativeSnapshot = storedSnapshot && typeof storedSnapshot === 'object'
                        && !Array.isArray(storedSnapshot)
                        && Object.keys(storedSnapshot).length > 2;
                    const canUseCurrentPresentation = hasAuthoritativeValidation && Boolean(hasAuthoritativeSnapshot);
                    const localReview = buildQuestionAnswerReview(
                        question,
                        unwrapStoredResultAnswer(storedAnswer),
                        {
                            questionId: question.id,
                            type: String(question.type),
                            status: outcome === 'incorrect' ? 'wrong' : outcome,
                            isCorrect: outcome === 'correct',
                        },
                        { source: canUseCurrentPresentation ? 'submission' : 'legacy-unverified' },
                    );
                    const review = serverReview?.presentation?.type === 'UNSUPPORTED' && canUseCurrentPresentation
                        ? localReview
                        : serverReview ?? localReview;
                    const questionText = (question as any).question
                        || (question as any).mainQuestion
                        || (question as any).questionText
                        || (question as any).text
                        || `Câu ${index + 1}`;

                    return (
                        <article key={question.id} className="rounded-[12px] border border-slate-200 bg-white p-4 sm:p-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm font-bold text-slate-500">Câu {index + 1}</p>
                                <span className={`inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-bold ${meta.className}`}>
                                    {meta.icon}
                                    {meta.label}
                                </span>
                            </div>
                            {question.questionRichText ? (
                                <QuestionRichTextRenderer
                                    value={question.questionRichText}
                                    fallback={questionText}
                                    className="mt-3 font-semibold leading-relaxed text-slate-900"
                                />
                            ) : (
                                <MathSpan
                                    content={questionText}
                                    as="p"
                                    className="mt-3 font-semibold leading-relaxed text-slate-900"
                                />
                            )}
                            <QuestionMedia question={question} className="mt-4" showOptionImages={false} />
                            <StudentReviewBody
                                question={question}
                                selectedAnswer={unwrapStoredResultAnswer(storedAnswer)}
                                reviewDetail={review}
                                outcome={outcome}
                            />
                        </article>
                    );
                })}
            </div>
        </section>
    );
};

export default ReviewTab;

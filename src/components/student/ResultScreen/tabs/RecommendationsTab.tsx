import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    BookOpen,
    Heart,
    Lightbulb,
    RefreshCw,
    Target,
} from 'lucide-react';
import type { Quiz, StudentResult } from '../../../../types';
import {
    extractWrongAnswers,
    getAIRecommendations,
    type AIRecommendation,
} from '../../../../services/aiTutorService';
import { MathSpan } from '../../../common';
import type { StudentWeaknessFocus } from '../studentWeaknessFocus';

interface Props {
    quiz: Quiz;
    result: StudentResult;
    answers: Record<string, any>;
    focus?: StudentWeaknessFocus | null;
}

const RecommendationsTab: React.FC<Props> = ({ quiz, result, answers, focus }) => {
    const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const wrongAnswers = useMemo(
        () => extractWrongAnswers(quiz, answers, result),
        [answers, quiz, result],
    );

    const fetchRecommendations = useCallback(async () => {
        if (wrongAnswers.length === 0) {
            setRecommendation(null);
            setIsLoading(false);
            setError(null);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const aiResult = await getAIRecommendations(quiz, result, wrongAnswers);
            setRecommendation(aiResult);
        } catch (requestError) {
            console.error('Recommendation error:', requestError);
            setError('Chưa thể tạo kế hoạch ôn tập. Em hãy thử lại sau nhé.');
        } finally {
            setIsLoading(false);
        }
    }, [quiz, result, wrongAnswers]);

    useEffect(() => {
        void fetchRecommendations();
    }, [fetchRecommendations]);

    if (wrongAnswers.length === 0) {
        return (
            <section role="tabpanel" aria-label="Kế hoạch ôn tập" className="p-4 sm:p-6">
                <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-6 text-center">
                    <h2 className="text-xl font-bold text-emerald-900">Em chưa có câu sai cần ôn lại</h2>
                    <p className="mt-2 text-sm text-emerald-800">Hãy tiếp tục luyện tập để giữ vững kết quả nhé.</p>
                </div>
            </section>
        );
    }

    return (
        <section role="tabpanel" aria-label="Kế hoạch ôn tập" className="space-y-5 p-4 sm:p-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-sm font-semibold text-sky-700">Dựa trên các câu em đã trả lời sai</p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">Kế hoạch ôn tập</h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                        Hệ thống chỉ phân tích câu đã trả lời sai, không dùng các câu chưa làm để kết luận điểm yếu.
                    </p>
                </div>
                {!isLoading ? (
                    <button
                        type="button"
                        onClick={() => void fetchRecommendations()}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[9px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        Làm mới
                    </button>
                ) : null}
            </header>

            {wrongAnswers.length < 2 ? (
                <p className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
                    Gợi ý này mang tính định hướng vì bài làm hiện có ít câu sai.
                </p>
            ) : null}

            {focus ? (
                <div className="rounded-[12px] border border-sky-200 bg-sky-50 p-4">
                    <div className="flex items-start gap-3">
                        <Target className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-slate-900">{focus.recommendationTitle}</h3>
                            <p className="mt-1 text-sm leading-relaxed text-slate-600">{focus.recommendationSummary}</p>
                            <div className="mt-3 rounded-[9px] border border-sky-200 bg-white p-3">
                                <p className="text-xs font-bold uppercase tracking-wide text-sky-700">{focus.nextStepLabel}</p>
                                <p className="mt-1 text-sm leading-relaxed text-slate-600">{focus.nextStepHint}</p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {isLoading ? (
                <div className="rounded-[14px] border border-slate-200 bg-white p-8 text-center" aria-live="polite">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-sky-600 motion-reduce:animate-none" aria-hidden="true" />
                    <p className="mt-3 font-bold text-slate-900">Đang chuẩn bị kế hoạch cho em...</p>
                    <p className="mt-1 text-sm text-slate-500">Quá trình này có thể mất một chút thời gian.</p>
                </div>
            ) : null}

            {error ? (
                <div className="rounded-[14px] border border-rose-200 bg-rose-50 p-5 text-rose-800" role="alert">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                        <div className="flex-1">
                            <p className="font-semibold">{error}</p>
                            <button
                                type="button"
                                onClick={() => void fetchRecommendations()}
                                className="mt-3 rounded-[9px] bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                            >
                                Thử lại
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {!isLoading && !error && recommendation ? (
                <div className="space-y-4">
                    <div className="rounded-[12px] border border-sky-200 bg-sky-50 p-5">
                        <div className="flex items-start gap-3">
                            <Target className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden="true" />
                            <div>
                                <h3 className="font-bold text-slate-900">Nhận xét từ bài làm</h3>
                                <p className="mt-2 leading-relaxed text-slate-700">{recommendation.analysis}</p>
                            </div>
                        </div>
                    </div>

                    {recommendation.weakTopics.length > 0 ? (
                        <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-5">
                            <div className="flex items-center gap-2">
                                <BookOpen className="h-5 w-5 text-amber-700" aria-hidden="true" />
                                <h3 className="font-bold text-amber-950">Em cần ôn lại</h3>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {recommendation.weakTopics.map((topic) => (
                                    <span key={topic} className="rounded-[8px] border border-amber-200 bg-white px-3 py-1.5 text-sm font-semibold text-amber-900">
                                        {topic}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    <div className="rounded-[12px] border border-slate-200 bg-white p-5">
                        <div className="flex items-center gap-2">
                            <Lightbulb className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                            <h3 className="font-bold text-slate-900">Gợi ý học tập</h3>
                        </div>
                        <ol className="mt-4 space-y-3">
                            {recommendation.studyTips.map((tip, index) => (
                                <li key={`${index}-${tip}`} className="flex items-start gap-3 rounded-[10px] bg-slate-50 p-3">
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                                        {index + 1}
                                    </span>
                                    <p className="pt-0.5 leading-relaxed text-slate-700">{tip}</p>
                                </li>
                            ))}
                        </ol>
                    </div>

                    <div className="rounded-[12px] border border-rose-200 bg-rose-50 p-5">
                        <div className="flex items-start gap-3">
                            <Heart className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
                            <div>
                                <h3 className="font-bold text-rose-950">Lời động viên</h3>
                                <p className="mt-1 leading-relaxed text-rose-900">{recommendation.encouragement}</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-5">
                        <h3 className="font-bold text-slate-900">Các câu cần xem lại ({wrongAnswers.length})</h3>
                        <div className="mt-3 space-y-2">
                            {wrongAnswers.map((wrongAnswer) => (
                                <div key={`${wrongAnswer.questionNumber}-${wrongAnswer.questionText}`} className="flex items-start gap-3 rounded-[9px] bg-white p-3">
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-700">
                                        {wrongAnswer.questionNumber}
                                    </span>
                                    <MathSpan content={wrongAnswer.questionText} className="min-w-0 flex-1 text-sm text-slate-700" />
                                </div>
                            ))}
                        </div>
                        <p className="mt-3 text-sm text-slate-600">Mở phần “Xem lại bài” để đối chiếu đáp án của từng câu.</p>
                    </div>
                </div>
            ) : null}
        </section>
    );
};

export default RecommendationsTab;

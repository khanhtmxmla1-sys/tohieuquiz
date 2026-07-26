import React, { useMemo, useRef, useState } from 'react';
import { BarChart3, BookOpen, ClipboardCheck, Home } from 'lucide-react';
import type { Quiz, StudentResult } from '../../../types';
import {
    buildStudentResultSummary,
    getStoredAnswerOutcome,
} from '../../../features/results/studentResultSummary';
import OverviewTab from './tabs/OverviewTab';
import ReviewTab from './tabs/ReviewTab';
import RecommendationsTab from './tabs/RecommendationsTab';
import type { StudentWeaknessFocus } from './studentWeaknessFocus';

interface Props {
    quiz: Quiz;
    result: StudentResult;
    answers: Record<string, any>;
    onExit: () => void;
    studentName?: string;
    studentClass?: string;
    initialTab?: TabType;
}

export type TabType = 'result' | 'review' | 'study-plan';
type ReviewFilter = 'all' | 'incorrect' | 'skipped';

const ResultScreen: React.FC<Props> = ({ quiz, result, answers, onExit, initialTab = 'result' }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<TabType>(initialTab);
    const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
    const [recommendationFocus, setRecommendationFocus] = useState<StudentWeaknessFocus | null>(null);

    const displayResult = useMemo<StudentResult>(() => {
        const summary = buildStudentResultSummary(result, answers);
        const validationDetails = quiz.questions.map((question) => ({
            questionId: question.id,
            isCorrect: getStoredAnswerOutcome(result, question.id, answers[question.id]) === 'correct',
        }));

        return {
            ...result,
            correctCount: summary.correct,
            totalQuestions: summary.total,
            score: summary.score10,
            validationDetails,
        };
    }, [answers, quiz.questions, result]);

    const summary = useMemo(
        () => buildStudentResultSummary(displayResult, answers),
        [answers, displayResult],
    );
    const hasStudyPlan = summary.incorrect > 0;

    const openReview = (filter: 'incorrect' | 'skipped' | undefined) => {
        setReviewFilter(filter ?? 'all');
        setActiveTab('review');
    };

    const tabs = [
        { id: 'result' as const, label: 'Kết quả', icon: BarChart3 },
        { id: 'review' as const, label: 'Xem lại bài', icon: ClipboardCheck },
        ...(hasStudyPlan ? [{ id: 'study-plan' as const, label: 'Kế hoạch ôn tập', icon: BookOpen }] : []),
    ];

    return (
        <div ref={containerRef} className="min-h-screen bg-[#FFFDF7] font-['Be_Vietnam_Pro'] text-slate-800">
            <div className="mx-auto flex max-w-5xl items-center px-4 pb-2 pt-6">
                <button
                    type="button"
                    onClick={onExit}
                    className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 font-semibold text-sky-700 transition-colors hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                >
                    <Home className="h-5 w-5" aria-hidden="true" />
                    <span>Về trang chủ</span>
                </button>
            </div>

            <div className="mx-auto max-w-5xl px-4 pb-8">
                <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 bg-slate-50 px-3 py-3 sm:px-4">
                        <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Các phần kết quả bài làm">
                            {tabs.map(({ id, label, icon: Icon }) => (
                                <button
                                    key={id}
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === id}
                                    onClick={() => setActiveTab(id)}
                                    className={`inline-flex shrink-0 items-center gap-2 rounded-[9px] px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                                        activeTab === id
                                            ? 'bg-sky-600 text-white'
                                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    <Icon className="h-4 w-4" aria-hidden="true" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {activeTab === 'result' ? (
                        <OverviewTab
                            result={displayResult}
                            answers={answers}
                            onOpenReview={openReview}
                            onOpenStudyPlan={() => setActiveTab('study-plan')}
                        />
                    ) : null}

                    {activeTab === 'review' ? (
                        <ReviewTab
                            key={reviewFilter}
                            quiz={quiz}
                            result={displayResult}
                            answers={answers}
                            initialFilter={reviewFilter}
                        />
                    ) : null}

                    {activeTab === 'study-plan' && hasStudyPlan ? (
                        <RecommendationsTab
                            quiz={quiz}
                            result={displayResult}
                            answers={answers}
                            focus={recommendationFocus}
                        />
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default ResultScreen;

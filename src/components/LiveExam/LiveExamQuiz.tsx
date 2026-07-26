/**
 * Live Exam Quiz Component
 * 
 * Student takes the exam with real-time timer and activity tracking.
 * Simplified version that works with actual API.
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useLiveExamTimer, useLiveExamActivity } from '../../hooks';
import { submitAnswers } from '../../services/liveExamService';
import type { LiveExamSubmissionResponse, StudentAnswers } from '../../types/liveExam.types';
import type { Question, Quiz } from '../../types';
import QuestionRenderer from '../student/QuestionRenderer';
import QuizHeader from '../../features/quiz-player/components/QuizHeader';
import QuizNavigation from '../../features/quiz-player/components/QuizNavigation';
import QuizPagination from '../../features/quiz-player/components/QuizPagination';
import {
    getActiveQuestionNumber,
    useQuizPageNavigation,
} from '../../features/quiz-player/hooks/useQuizPageNavigation';
import { SubmitConfirmModal } from '../student';

interface LiveExamQuizProps {
    sessionId: string;
    questions: Question[];
    quizTitle: string;
    duration: number;
    endsAt: string;
    onComplete: (submission: LiveExamSubmissionResponse) => void;
}

export const LiveExamQuiz: React.FC<LiveExamQuizProps> = ({
    sessionId,
    questions,
    quizTitle,
    duration,
    endsAt,
    onComplete,
}) => {
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const { timeRemaining, isExpired } = useLiveExamTimer({
        endsAt,
    });

    // Track activity
    const { updateActivity } = useLiveExamActivity({
        sessionId,
    });

    const QUESTIONS_PER_PAGE = 10;
    const totalQuestions = questions.length;
    const totalPages = Math.max(1, Math.ceil(totalQuestions / QUESTIONS_PER_PAGE));

    // Auto-submit when time expires
    useEffect(() => {
        if (isExpired && !isSubmitting) {
            handleSubmit();
        }
    }, [isExpired, isSubmitting]);

    const handleAnswerChange = (questionId: string, value: any, subId?: string) => {
        setAnswers((prev) => {
            if (subId) {
                return {
                    ...prev,
                    [questionId]: { ...(prev[questionId] || {}), [subId]: value },
                };
            }

            return { ...prev, [questionId]: value };
        });
    };

    const handleMatchingClick = (questionId: string, item: string, type: 'left' | 'right') => {
        setAnswers((prev) => {
            const currentAnswers = prev[questionId] || {};
            const nextAnswers = { ...currentAnswers };

            if (type === 'left') {
                if (nextAnswers.selectedLeft === item) {
                    delete nextAnswers.selectedLeft;
                } else {
                    nextAnswers.selectedLeft = item;
                }
            } else if (nextAnswers.selectedLeft) {
                nextAnswers[nextAnswers.selectedLeft] = item;
                delete nextAnswers.selectedLeft;
            }

            return { ...prev, [questionId]: nextAnswers };
        });
    };

    const isQuestionAnswered = (q: Question) => {
        const val = answers[q.id];
        if (!val) return false;

        switch ((q.type || '').toString().toUpperCase()) {
            case 'TRUE_FALSE':
                return Array.isArray((q as any).items) && (q as any).items.every((item: any, idx: number) => {
                    const itemKey = item.id || `item-${idx}`;
                    return val[itemKey] !== undefined;
                });
            case 'MULTIPLE_SELECT':
                return Array.isArray(val) && val.length > 0;
            case 'WORD_SCRAMBLE':
                return Array.isArray(val) && val.length === (((q as any).letters || []).length);
            case 'ERROR_CORRECTION':
                return !!val.wrongWord && !!val.correctWord;
            default:
                return true;
        }
    };

    const questionsOnCurrentPage = questions.slice((currentPage - 1) * QUESTIONS_PER_PAGE, currentPage * QUESTIONS_PER_PAGE);
    const { activeQuestionId, changePage } = useQuizPageNavigation({
        questions,
        currentPage,
        totalPages,
        questionsPerPage: QUESTIONS_PER_PAGE,
        setCurrentPage,
    });
    const answeredCount = questions.filter(isQuestionAnswered).length;
    const unansweredCount = totalQuestions - answeredCount;

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError('');

        try {
            const submission = await submitAnswers(sessionId, answers as StudentAnswers);
            onComplete(submission);
        } catch (err: any) {
            setError(err.message || 'Không thể nộp bài');
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        if (questions.length === 0 || isSubmitting) return;

        void updateActivity({
            currentQuestion: getActiveQuestionNumber(
                questions,
                activeQuestionId,
                currentPage,
                QUESTIONS_PER_PAGE,
            ),
            answeredCount,
        });
    }, [activeQuestionId, currentPage, answeredCount, isSubmitting, questions, totalQuestions, updateActivity]);

    if (questions.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <QuizHeader
                title={quizTitle}
                timeLeft={timeRemaining}
                totalQuestions={questions.length}
                answeredCount={answeredCount}
                isPractice={false}
                studentName="Thi trực tiếp"
                avatar={null}
            />

            <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
                <div className="flex flex-col lg:flex-row gap-8">
                    <aside className="hidden lg:block w-72 flex-shrink-0">
                        <QuizNavigation
                            questions={questions}
                            isQuestionAnswered={isQuestionAnswered}
                            activeQuestionId={activeQuestionId}
                            QUESTIONS_PER_PAGE={QUESTIONS_PER_PAGE}
                            onPageChange={changePage}
                        />
                    </aside>

                    <main className="flex-1 min-w-0">
                        <div className="space-y-8">
                            {questionsOnCurrentPage.map((q, idx) => (
                                <div
                                    key={q.id}
                                    id={`question-${q.id}`}
                                    tabIndex={-1}
                                    aria-label={`Câu ${(currentPage - 1) * QUESTIONS_PER_PAGE + idx + 1}`}
                                    className="scroll-mt-32 transition-all duration-500 focus:outline-none"
                                >
                                    <QuestionRenderer
                                        question={q}
                                        index={(currentPage - 1) * QUESTIONS_PER_PAGE + idx}
                                        answers={answers}
                                        onAnswerChange={handleAnswerChange}
                                        onMatchingClick={handleMatchingClick}
                                    />
                                </div>
                            ))}
                        </div>

                        <QuizPagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={changePage}
                            onSubmit={() => setShowSubmitConfirm(true)}
                            isSubmitting={isSubmitting}
                        />

                        {error && (
                            <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-center font-medium flex items-center justify-center gap-2">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}
                    </main>
                </div>
            </div>

            <SubmitConfirmModal
                isOpen={showSubmitConfirm}
                unansweredCount={unansweredCount}
                onCancel={() => setShowSubmitConfirm(false)}
                onConfirm={() => {
                    setShowSubmitConfirm(false);
                    handleSubmit();
                }}
            />
        </div>
    );
};

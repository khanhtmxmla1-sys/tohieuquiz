/**
 * Live Exam Quiz Component
 * 
 * Student takes the exam with real-time timer and activity tracking.
 * Simplified version that works with actual API.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useLiveExamTimer, useLiveExamActivity } from '../../hooks';
import { getAnswerSnapshot, saveAnswerSnapshot, submitAnswers } from '../../services/liveExamService';
import type { LiveExamSubmissionResponse, StudentAnswers } from '../../types/liveExam.types';
import type { Question, Quiz } from '../../types';
import { useQuizProgress } from '../../features/quiz-player/hooks/useQuizProgress';
import QuestionRenderer from '../student/QuestionRenderer';
import QuizHeader from '../../features/quiz-player/components/QuizHeader';
import QuizNavigation from '../../features/quiz-player/components/QuizNavigation';
import QuizPagination from '../../features/quiz-player/components/QuizPagination';
import {
    getActiveQuestionNumber,
    useQuizPageNavigation,
} from '../../features/quiz-player/hooks/useQuizPageNavigation';
import { SubmitConfirmModal } from '../student';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import {
    clearLiveExamAnswerDraft,
    createLiveExamSubmissionAttempt,
    loadLiveExamAnswerDraft,
    saveLiveExamAnswerDraft,
    type LiveExamSubmissionAttempt,
} from '../../features/live-exam/liveExamAnswerDraft';

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
    const [answers, setAnswers] = useState<Record<string, any>>(
        () => loadLiveExamAnswerDraft(sessionId) as Record<string, any>,
    );
    const [answerSaveStatus, setAnswerSaveStatus] = useState<'saving' | 'saved' | 'offline' | 'error'>('saved');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const submissionAttemptRef = useRef<LiveExamSubmissionAttempt | null>(null);
    const autosaveVersionRef = useRef(0);
    const wasOnlineRef = useRef(true);
    const { isOnline } = useOnlineStatus();

    const { timeRemaining, isExpired } = useLiveExamTimer({
        endsAt,
    });

    // Track activity
    const { updateActivity } = useLiveExamActivity({
        sessionId,
    });

    useEffect(() => {
        setAnswers(loadLiveExamAnswerDraft(sessionId) as Record<string, any>);
        submissionAttemptRef.current = null;
        autosaveVersionRef.current = 0;
    }, [sessionId]);

    useEffect(() => {
        setAnswerSaveStatus(isOnline ? 'saving' : 'offline');
        const timer = window.setTimeout(() => {
            try {
                saveLiveExamAnswerDraft(sessionId, answers);
                if (isOnline) {
                    const attemptVersion = autosaveVersionRef.current + 1;
                    const idempotencyKey = `autosave:${sessionId}:${attemptVersion}:${crypto.randomUUID()}`;
                    void saveAnswerSnapshot(sessionId, { attemptVersion, idempotencyKey, answers: answers as StudentAnswers })
                        .then((snapshot) => {
                            autosaveVersionRef.current = snapshot.attemptVersion;
                            setAnswerSaveStatus('saved');
                        })
                        .catch(() => setAnswerSaveStatus('error'));
                } else {
                    setAnswerSaveStatus('offline');
                }
            } catch {
                setAnswerSaveStatus('error');
            }
        }, 250);
        return () => window.clearTimeout(timer);
    }, [answers, isOnline, sessionId]);

    useEffect(() => {
        if (isOnline && !wasOnlineRef.current) {
            setAnswerSaveStatus('saving');
            void getAnswerSnapshot(sessionId).then((snapshot) => {
                if (snapshot && snapshot.attemptVersion >= autosaveVersionRef.current) {
                    autosaveVersionRef.current = snapshot.attemptVersion;
                    setAnswers(snapshot.answers as Record<string, any>);
                    saveLiveExamAnswerDraft(sessionId, snapshot.answers);
                }
                setAnswerSaveStatus('saved');
            }).catch(() => setAnswerSaveStatus('error'));
        }
        wasOnlineRef.current = isOnline;
    }, [isOnline, sessionId]);

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
        submissionAttemptRef.current = null;
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
        submissionAttemptRef.current = null;
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

    const quizProgress = useQuizProgress(questions, answers);
    const isQuestionAnswered = (question: Question) => (
        quizProgress.byQuestionId[question.id]?.state === 'complete'
    );
    const questionsOnCurrentPage = questions.slice((currentPage - 1) * QUESTIONS_PER_PAGE, currentPage * QUESTIONS_PER_PAGE);
    const { activeQuestionId, changePage } = useQuizPageNavigation({
        questions,
        currentPage,
        totalPages,
        questionsPerPage: QUESTIONS_PER_PAGE,
        setCurrentPage,
    });
    const answeredCount = quizProgress.completeCount;
    const unansweredCount = quizProgress.emptyCount + quizProgress.partialCount;

    const handleSubmit = async () => {
        if (!isOnline) {
            setError('Thiết bị đang ngoại tuyến. Đáp án đã được lưu trên thiết bị; hãy nộp lại khi có mạng.');
            return;
        }
        setIsSubmitting(true);
        setError('');
        const attempt = createLiveExamSubmissionAttempt(
            sessionId,
            answers,
            submissionAttemptRef.current,
        );
        submissionAttemptRef.current = attempt;

        try {
            const submission = await submitAnswers(sessionId, answers as StudentAnswers, {
                idempotencyKey: attempt.idempotencyKey,
            });
            clearLiveExamAnswerDraft(sessionId);
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

            <div className="border-b border-slate-200 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-600" role="status" aria-live="polite">
                {answerSaveStatus === 'saving' && 'Đang lưu đáp án trên thiết bị…'}
                {answerSaveStatus === 'saved' && 'Đáp án đã được lưu trên thiết bị'}
                {answerSaveStatus === 'offline' && 'Mất kết nối — đáp án vẫn được lưu trên thiết bị'}
                {answerSaveStatus === 'error' && 'Không thể lưu đáp án trên thiết bị'}
            </div>

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

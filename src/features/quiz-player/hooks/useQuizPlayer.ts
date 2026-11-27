import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Quiz, Question, QuizResultSubmissionContext, StudentResult } from '../../../types';
import { useClassroomStore } from '../../../stores/useClassroomStore';
import { useQuizProgressRollout } from './useQuizProgressRollout';
import {
    loadQuizAttemptDraft,
} from '../quizAttemptDraft';
import { createQuizDeadline, remainingSeconds, useQuizDeadline } from './useQuizDeadline';
import { useQuizAttemptPersistence } from './useQuizAttemptPersistence';
import { useQuizNavigationGuard } from './useQuizNavigationGuard';
import { useQuizAccess } from './useQuizAccess';
import { updateMatchingAnswer } from '../utils/structuredAnswerUpdates';
import { resolveQuizDraftResume } from '../utils/resolveQuizDraftResume';
import { loadQuizStartQuestions } from '../utils/loadQuizStartQuestions';
import type { RandomizationPolicy } from '../../../../shared/randomization-policy.contract';
import { useQuizSubmission } from './useQuizSubmission';
export type { CompletionRewardData, CompletionRewardStatus } from './useQuizSubmission';

interface UseQuizPlayerProps {
    quiz: Quiz;
    onExit: () => void;
    onSaveResult: (result: StudentResult, context?: QuizResultSubmissionContext) => void | StudentResult | Promise<void | StudentResult>;
    randomizationPolicy?: RandomizationPolicy;
}

export type QuizStep = 'code' | 'info' | 'notice' | 'quiz' | 'result';

export const useQuizPlayer = ({ quiz, onExit, onSaveResult, randomizationPolicy }: UseQuizPlayerProps) => {
    const classroomStore = useClassroomStore();
    const session = classroomStore.studentSession;
    const isLoggedIn = !!session;

    // UUID generator utility
    const generateUUID = useCallback((): string => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }, []);

    // Shuffle algorithms
    const shuffleArray = useCallback(<T,>(array: T[]): T[] => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }, []);

    const shuffleWithinLevel = useCallback((questions: Question[]) => {
        const level1 = questions.filter((q: any) => q.difficultyLevel === 1);
        const level2 = questions.filter((q: any) => q.difficultyLevel === 2);
        const level3 = questions.filter((q: any) => q.difficultyLevel === 3);
        const noLevel = questions.filter((q: any) => !q.difficultyLevel);

        return [
            ...shuffleArray(level1),
            ...shuffleArray(noLevel),
            ...shuffleArray(level2),
            ...shuffleArray(level3)
        ];
    }, [shuffleArray]);

    const restoredDraft = useMemo(() => loadQuizAttemptDraft(quiz.id), [quiz.id]);
    // Initial step logic
    const getInitialStep = useCallback((): QuizStep => {
        if (quiz.requireCode) return 'code';
        if (isLoggedIn) return 'notice';
        return 'info';
    }, [isLoggedIn, quiz.requireCode]);

    // Core state
    const [step, setStep] = useState<QuizStep>(getInitialStep());
    const [studentName, setStudentName] = useState(restoredDraft?.studentName || session?.fullName || '');
    const [studentClass, setStudentClass] = useState(restoredDraft?.studentClass || session?.className || '');
    const studentAvatar = session?.avatar || null;
    const [answers, setAnswers] = useState<Record<string, any>>(restoredDraft?.answers || {});
    const [expiresAt, setExpiresAt] = useState<string | null>(restoredDraft?.expiresAt || null);
    const timeLeft = useQuizDeadline(expiresAt);
    const [startTime, setStartTime] = useState<number>(() => (
        restoredDraft ? Date.parse(restoredDraft.startedAt) : 0
    ));
    // Questions are always populated from the scoped learner endpoint at start.
    // A draft may provide the order/answers, but never authorizes using stale
    // questions from the catalog or session storage.
    const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
    const [isStarting, setIsStarting] = useState(false);
    const [startError, setStartError] = useState<string | null>(null);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const startTriggeredRef = useRef(false);
    const submissionTriggeredRef = useRef(false);
    const accessGrantRef = useRef<string | null>(null);
    const {
        enteredCode,
        setEnteredCode,
        codeError,
        isVerifyingCode,
        handleCodeVerify,
    } = useQuizAccess({
        quizId: quiz.id,
        assignmentId: quiz._assignmentData?.id,
        isLoggedIn,
        accessGrantRef,
        setStep,
    });

    // Pagination state
    const QUESTIONS_PER_PAGE = 10;
    const [currentPage, setCurrentPage] = useState(restoredDraft?.currentPage || 1);
    const totalPages = Math.max(1, Math.ceil(shuffledQuestions.length / QUESTIONS_PER_PAGE));
    const questionsOnCurrentPage = useMemo(() => {
        const startIndex = (currentPage - 1) * QUESTIONS_PER_PAGE;
        return shuffledQuestions.slice(startIndex, startIndex + QUESTIONS_PER_PAGE);
    }, [currentPage, shuffledQuestions]);
    const quizProgress = useQuizProgressRollout({
        quizId: quiz.id,
        questions: shuffledQuestions,
        answers,
    });

    useQuizAttemptPersistence({
        active: step === 'quiz',
        quizId: quiz.id,
        studentName,
        studentClass,
        answers,
        questions: shuffledQuestions,
        currentPage,
        startedAt: startTime,
        expiresAt,
    });

    // Browser navigation protection
    useQuizNavigationGuard({ active: step === 'quiz', quizId: quiz.id, onExit });

    const {
        result,
        isSubmitting,
        submitError,
        showReward,
        setShowReward,
        rewardData,
        handleSubmit,
        handleRetryReward,
    } = useQuizSubmission({
        quiz,
        answers,
        shuffledQuestions,
        startTime,
        studentName,
        studentClass,
        onSaveResult,
        generateUUID,
        classroomStore,
        submissionTriggeredRef,
        accessGrantRef,
        setStep,
    });

    // Handlers
    const handleStart = useCallback(async () => {
        if (!studentName || !studentClass || isStarting || startTriggeredRef.current) return;
        startTriggeredRef.current = true;
        setIsStarting(true);
        setStartError(null);

        try {
            const resolvedQuestions = await loadQuizStartQuestions({
                quizId: quiz.id,
                isPractice: quiz.isPractice,
                questions: quiz.questions,
                assignmentId: quiz._assignmentData?.id
                    ? String(quiz._assignmentData.id)
                    : undefined,
                accessGrant: accessGrantRef.current || undefined,
                session,
            });

            const { restoredOrder, canResumeDraft } = resolveQuizDraftResume(restoredDraft, resolvedQuestions);
            const hasLevels = resolvedQuestions.some((q: any) => q.difficultyLevel);
            const finalQuestions = canResumeDraft
                ? restoredOrder
                : randomizationPolicy?.shuffleQuestions === false
                    ? [...resolvedQuestions]
                    : hasLevels
                        ? shuffleWithinLevel(resolvedQuestions)
                        : shuffleArray(resolvedQuestions);
            const startedAt = Date.now();

            submissionTriggeredRef.current = false;
            setShuffledQuestions(finalQuestions);
            setAnswers(canResumeDraft ? restoredDraft.answers : {});
            setCurrentPage(canResumeDraft ? restoredDraft.currentPage : 1);
            setStartTime(canResumeDraft ? Date.parse(restoredDraft.startedAt) : startedAt);
            setExpiresAt(canResumeDraft ? restoredDraft.expiresAt : createQuizDeadline(quiz.timeLimit, startedAt));
            setStep('quiz');
        } catch (error: unknown) {
            startTriggeredRef.current = false;
            const message = error instanceof Error ? error.message : 'Không thể bắt đầu làm bài.';
            setStartError(message);
        } finally {
            setIsStarting(false);
        }
    }, [
        isStarting,
        quiz._assignmentData?.id,
        quiz.id,
        quiz.isPractice,
        quiz.questions,
        quiz.timeLimit,
        randomizationPolicy?.shuffleQuestions,
        session?.studentId,
        shuffleArray,
        shuffleWithinLevel,
        restoredDraft,
        studentClass,
        studentName,
    ]);

    const handleAnswerChange = useCallback((questionId: string, value: any, subId?: string) => {
        setAnswers(prev => {
            if (subId) {
                return {
                    ...prev,
                    [questionId]: { ...(prev[questionId] || {}), [subId]: value }
                };
            }
            return { ...prev, [questionId]: value };
        });
    }, []);

    const handleMatchingClick = useCallback((questionId: string, item: string, type: 'left' | 'right') => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: updateMatchingAnswer(prev[questionId], item, type),
        }));
    }, []);

    // Date.now is authoritative. timeLeft only triggers display refreshes and re-checks.
    useEffect(() => {
        if (step !== 'quiz' || quiz.isPractice || !quiz.timeLimit || !expiresAt || startTime <= 0) return;
        if (remainingSeconds(expiresAt) === 0) {
            void handleSubmit('timeout');
        }
    }, [expiresAt, handleSubmit, quiz.isPractice, quiz.timeLimit, startTime, step, timeLeft]);

    const isQuestionAnswered = useCallback(
        (question: Question) => quizProgress.byQuestionId[question.id]?.state === 'complete',
        [quizProgress.byQuestionId],
    );
    return {
        step, studentName, setStudentName, studentClass, setStudentClass, studentAvatar,
        enteredCode, setEnteredCode, codeError, isVerifyingCode, answers, timeLeft, result,
        shuffledQuestions, isStarting, startError, isSubmitting, submitError, showReward, setShowReward,
        showSubmitConfirm, setShowSubmitConfirm,
        rewardData, currentPage, setCurrentPage, totalPages, questionsOnCurrentPage, quizProgress,
        handleStart, handleCodeVerify, handleAnswerChange, handleMatchingClick, handleSubmit, handleRetryReward, isQuestionAnswered
    };
};

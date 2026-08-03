import { useState, useEffect, useCallback, useMemo } from 'react';
import { Quiz, Question, StudentResult } from '../../../types';
import { useClassroomStore } from '../../../stores/useClassroomStore';
import { useGamificationStore } from '../../../stores/useGamificationStore';
import { useGameLoopStore } from '../../../stores/useGameLoopStore';
import { validateAnswersOnServer } from '../../../services/quizValidationService';
import { playTingSound, showError } from '../../../utils/toast';
import { useQuizProgress } from './useQuizProgress';

interface UseQuizPlayerProps {
    quiz: Quiz;
    onExit: () => void;
    onSaveResult: (result: StudentResult) => void | StudentResult | Promise<void | StudentResult>;
}

export type CompletionRewardStatus = 'ready' | 'syncing' | 'error';

export interface CompletionRewardData {
    status: CompletionRewardStatus;
    resultId: string;
    score: number;
    correctCount: number;
    totalQuestions: number;
    expEarned: number;
    coinsEarned: number;
    newLevel: number;
    newExp: number;
    newExpToNext: number;
    newCoins: number;
    leveledUp: boolean;
    isPractice: boolean;
}

export const useQuizPlayer = ({ quiz, onExit, onSaveResult }: UseQuizPlayerProps) => {
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

    // Initial step logic
    const getInitialStep = useCallback((): 'code' | 'info' | 'quiz' | 'result' => {
        if (isLoggedIn && !quiz.requireCode) return 'info';
        if (quiz.requireCode) return 'code';
        return 'info';
    }, [isLoggedIn, quiz.requireCode]);

    // Core state
    const [step, setStep] = useState<'code' | 'info' | 'quiz' | 'result'>(getInitialStep());
    const [studentName, setStudentName] = useState(session?.fullName || '');
    const [studentClass, setStudentClass] = useState(session?.className || '');
    const studentAvatar = session?.avatar || null;
    const [enteredCode, setEnteredCode] = useState('');
    const [codeError, setCodeError] = useState('');
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [timeLeft, setTimeLeft] = useState(quiz.timeLimit * 60);
    const [startTime, setStartTime] = useState<number>(0);
    const [result, setResult] = useState<StudentResult | null>(null);
    const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

    // Gamification state
    const [showReward, setShowReward] = useState(false);
    const [rewardData, setRewardData] = useState<CompletionRewardData | null>(null);

    // Pagination state
    const QUESTIONS_PER_PAGE = 10;
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(shuffledQuestions.length / QUESTIONS_PER_PAGE));
    const questionsOnCurrentPage = useMemo(() => {
        const startIndex = (currentPage - 1) * QUESTIONS_PER_PAGE;
        return shuffledQuestions.slice(startIndex, startIndex + QUESTIONS_PER_PAGE);
    }, [currentPage, shuffledQuestions]);
    const quizProgress = useQuizProgress(shuffledQuestions, answers);

    // Timer logic
    useEffect(() => {
        if (quiz.isPractice || !quiz.timeLimit) return;
        if (step !== 'quiz' || timeLeft <= 0) {
            if (step === 'quiz' && timeLeft === 0) handleSubmit();
            return;
        }

        const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);

    }, [step, timeLeft, quiz.isPractice, quiz.timeLimit]);

    // Browser navigation protection
    useEffect(() => {
        if (step !== 'quiz') return;
        const handlePopState = (e: PopStateEvent) => {
            e.preventDefault();
            if (window.confirm('Bạn đang làm bài! Nếu quay lại, bài làm sẽ bị mất. Bạn có chắc muốn thoát?')) {
                onExit();
            } else {
                window.history.pushState(null, '', window.location.href);
            }
        };

        window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [step, onExit]);

    // Auto-start for logged-in students
    useEffect(() => {
        if (isLoggedIn && step === 'info' && studentName && studentClass) {
            handleStart();
        }

    }, [isLoggedIn, step]);

    // Handlers
    const handleStart = useCallback(() => {
        if (!studentName || !studentClass) return;

        const hasLevels = quiz.questions.some((q: any) => q.difficultyLevel);
        const finalQuestions = hasLevels ? shuffleWithinLevel(quiz.questions) : shuffleArray(quiz.questions);

        setShuffledQuestions(finalQuestions);
        setStartTime(Date.now());
        setStep('quiz');
    }, [studentName, studentClass, quiz.questions, shuffleWithinLevel, shuffleArray]);

    const handleCodeVerify = useCallback(() => {
        if (enteredCode.toUpperCase() === quiz.accessCode?.toUpperCase()) {
            setCodeError('');
            setStep('info');
        } else {
            setCodeError('Mã không đúng. Vui lòng thử lại!');
        }
    }, [enteredCode, quiz.accessCode]);

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
        setAnswers(prev => {
            const currentAnswers = prev[questionId] || {};
            const newAnswers = { ...currentAnswers };

            if (type === 'left') {
                if (newAnswers.selectedLeft === item) {
                    delete newAnswers.selectedLeft;
                } else {
                    newAnswers.selectedLeft = item;
                }
            } else {
                const selectedLeft = newAnswers.selectedLeft;
                if (selectedLeft) {
                    newAnswers[selectedLeft] = item;
                    delete newAnswers.selectedLeft;
                }
            }
            return { ...prev, [questionId]: newAnswers };
        });
    }, []);

    const handleSubmit = useCallback(async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setSubmitError(null);

        const elapsedSeconds = Math.max(0, Math.round((Date.now() - startTime) / 1000));
        const timeTaken = Math.round((elapsedSeconds / 60) * 100) / 100;

        try {
            const validationResult = await validateAnswersOnServer({
                quizId: quiz.id,
                answers,
                studentName,
                studentClass
            });

            if (!validationResult.success) throw new Error(validationResult.error || 'Server validation failed');

            const validationDetails = Array.isArray(validationResult.details)
                ? validationResult.details
                : [];
            const validationByQuestionId = new Map(
                validationDetails.map((detail) => [String(detail.questionId), detail]),
            );
            const finalAnswersWithSnapshots: Record<string, any> = {};

            quiz.questions.forEach((question) => {
                const serverResult = validationByQuestionId.get(String(question.id));
                finalAnswersWithSnapshots[question.id] = {
                    selectedAnswer: answers[question.id] ?? null,
                    isCorrect: serverResult?.isCorrect === true,
                    status: serverResult?.status ?? (serverResult?.isCorrect ? 'correct' : 'wrong'),
                    gradingVersion: validationResult.gradingVersion,
                    questionSnapshot: { ...question },
                };
            });

            const detailCorrectCount = validationDetails.filter((detail) => detail.isCorrect === true).length;
            const authoritativeTotalQuestions = Number.isFinite(Number(validationResult.total))
                && Number(validationResult.total) >= 0
                ? Number(validationResult.total)
                : quiz.questions.length;
            const authoritativeQuestionCount = Number.isFinite(Number(validationResult.questionCount))
                ? Number(validationResult.questionCount)
                : quiz.questions.length;
            const authoritativeVoidedCount = Number.isFinite(Number(validationResult.voidedCount))
                ? Number(validationResult.voidedCount)
                : validationDetails.filter((detail) => detail.status === 'voided').length;
            const authoritativeCorrectCount = Number.isFinite(Number(validationResult.correctCount))
                ? Number(validationResult.correctCount)
                : detailCorrectCount;
            const authoritativeScore = Number.isFinite(Number(validationResult.score))
                ? Number(validationResult.score)
                : authoritativeTotalQuestions === 0
                    ? 0
                    : Number(((authoritativeCorrectCount / authoritativeTotalQuestions) * 10).toFixed(1));
            const resultData: StudentResult = {
                id: generateUUID(), // Temporary client ID, will be replaced by server ID
                quizId: quiz.id,
                assignmentId: quiz._assignmentData?.id ? String(quiz._assignmentData.id) : undefined,
                quizTitle: quiz.title,
                studentName,
                studentClass,
                score: authoritativeScore,
                correctCount: authoritativeCorrectCount,
                questionCount: authoritativeQuestionCount,
                totalQuestions: authoritativeTotalQuestions,
                voidedCount: authoritativeVoidedCount,
                timeTaken,
                submittedAt: new Date().toISOString(),
                answers: {
                    ...finalAnswersWithSnapshots,
                    _questionOrder: shuffledQuestions.map(q => q.id)
                },
                validationDetails,
                gradingVersion: validationResult.gradingVersion
            };

            let finalResult = resultData;
            if (!quiz.isPractice) {
                const savedResult = await onSaveResult(resultData);
                if (savedResult) {
                    finalResult = savedResult;
                }
            }
            setResult(finalResult);

            const gamStore = useGamificationStore.getState();
            const currentPet = gamStore.pet;
            const baseRewardData: CompletionRewardData = {
                status: 'ready',
                resultId: finalResult.id,
                score: finalResult.score,
                correctCount: finalResult.correctCount,
                totalQuestions: finalResult.totalQuestions,
                expEarned: 0,
                coinsEarned: 0,
                newLevel: currentPet?.level ?? 1,
                newExp: currentPet?.exp ?? 0,
                newExpToNext: currentPet?.expToNext ?? 100,
                newCoins: gamStore.coins ?? 0,
                leveledUp: false,
                isPractice: Boolean(quiz.isPractice),
            };

            let completionReward = baseRewardData;
            const rewardUsername = classroomStore.studentSession?.username;
            if (!quiz.isPractice && rewardUsername && typeof gamStore.claimResultReward === 'function') {
                const claimedReward = await gamStore.claimResultReward(rewardUsername, finalResult.id);
                completionReward = claimedReward
                    ? {
                        ...baseRewardData,
                        status: 'ready',
                        expEarned: claimedReward.awardedExp,
                        coinsEarned: claimedReward.awardedCoins,
                        newLevel: claimedReward.newLevel,
                        newExp: claimedReward.newExp,
                        newExpToNext: claimedReward.newExpToNext,
                        newCoins: claimedReward.newCoins,
                        leveledUp: claimedReward.leveledUp,
                    }
                    : { ...baseRewardData, status: 'error' };
            }

            setRewardData(completionReward);
            setShowReward(true);

            if (classroomStore.studentSession?.username) {
                void useGameLoopStore.getState().trackQuizActivity({
                    username: classroomStore.studentSession.username,
                    activityId: finalResult.id,
                    quizId: quiz.id,
                    category: quiz.category,
                    subject: quiz.topic,
                    correctCount: authoritativeCorrectCount,
                    totalQuestions: authoritativeTotalQuestions,
                });
            }

            setStep('result');
            playTingSound();
        } catch (error: unknown) {
            const normalizedError = error instanceof Error ? error : new Error(String(error));
            setSubmitError('Lỗi khi nộp bài! ' + (normalizedError.message || ''));
        } finally {
            setIsSubmitting(false);
        }
    }, [isSubmitting, startTime, quiz, answers, studentName, studentClass, generateUUID, shuffledQuestions, onSaveResult, classroomStore.studentSession?.username]);

    const handleRetryReward = useCallback(async () => {
        const rewardUsername = classroomStore.studentSession?.username;
        if (!rewardData || rewardData.isPractice || !rewardUsername) return;

        const gamStore = useGamificationStore.getState();
        if (typeof gamStore.claimResultReward !== 'function') return;

        setRewardData((current) => current ? { ...current, status: 'syncing' } : current);
        const claimedReward = await gamStore.claimResultReward(rewardUsername, rewardData.resultId);
        if (!claimedReward) {
            setRewardData((current) => current ? { ...current, status: 'error' } : current);
            return;
        }

        setRewardData((current) => current ? {
            ...current,
            status: 'ready',
            expEarned: claimedReward.awardedExp,
            coinsEarned: claimedReward.awardedCoins,
            newLevel: claimedReward.newLevel,
            newExp: claimedReward.newExp,
            newExpToNext: claimedReward.newExpToNext,
            newCoins: claimedReward.newCoins,
            leveledUp: claimedReward.leveledUp,
        } : current);
    }, [classroomStore.studentSession?.username, rewardData]);

    const isQuestionAnswered = useCallback(
        (question: Question) => quizProgress.byQuestionId[question.id]?.state === 'complete',
        [quizProgress.byQuestionId],
    );
    return {
        step, studentName, setStudentName, studentClass, setStudentClass, studentAvatar,
        enteredCode, setEnteredCode, codeError, answers, timeLeft, result,
        shuffledQuestions, isSubmitting, submitError, showReward, setShowReward,
        showSubmitConfirm, setShowSubmitConfirm,
        rewardData, currentPage, setCurrentPage, totalPages, questionsOnCurrentPage, quizProgress,
        handleStart, handleCodeVerify, handleAnswerChange, handleMatchingClick, handleSubmit, handleRetryReward, isQuestionAnswered
    };
};

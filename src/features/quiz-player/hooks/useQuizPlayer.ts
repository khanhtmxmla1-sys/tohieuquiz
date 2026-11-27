import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Quiz, Question, QuizResultSubmissionContext, StudentResult } from '../../../types';
import { useClassroomStore } from '../../../stores/useClassroomStore';
import { useGamificationStore } from '../../../stores/useGamificationStore';
import { useGameLoopStore } from '../../../stores/useGameLoopStore';
import { adaptStudentQuizQuestion, fetchQuizPlayQuestions, requestQuizAccess } from '../../../services/quizAccessService';
import { gradeQuiz } from '../../../domain/quiz-scoring';
import { startAssignmentAttempt } from '../../../services/classroomService';
import { playTingSound } from '../../../utils/toast';
import { useQuizProgressRollout } from './useQuizProgressRollout';
import {
    clearQuizAttemptDraft,
    loadQuizAttemptDraft,
} from '../quizAttemptDraft';
import { createQuizDeadline, remainingSeconds, useQuizDeadline } from './useQuizDeadline';
import { useQuizAttemptPersistence } from './useQuizAttemptPersistence';
import { useQuizNavigationGuard } from './useQuizNavigationGuard';
import { updateMatchingAnswer } from '../utils/structuredAnswerUpdates';
import { resolveQuizDraftResume } from '../utils/resolveQuizDraftResume';
import type { RandomizationPolicy } from '../../../../shared/randomization-policy.contract';
import {
    practiceService,
    type PracticeGradeResponse,
    type PracticeSessionEnvelope,
} from '../../../services/practiceService';

interface UseQuizPlayerProps {
    quiz: Quiz;
    onExit: () => void;
    onSaveResult: (result: StudentResult, context?: QuizResultSubmissionContext) => void | StudentResult | Promise<void | StudentResult>;
    randomizationPolicy?: RandomizationPolicy;
}

export type QuizStep = 'code' | 'info' | 'notice' | 'quiz' | 'result';
type SubmissionReason = 'manual' | 'timeout';

type SecurePracticeQuiz = Quiz & { practiceSession?: unknown };

const hasOwnProperty = (value: object, key: string): boolean => (
    Object.prototype.hasOwnProperty.call(value, key)
);

const isSecurePracticeSession = (value: unknown): value is PracticeSessionEnvelope => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const session = value as Record<string, unknown>;
    if (session.version !== 'server-v1' || typeof session.token !== 'string'
        || !session.token.trim() || typeof session.expiresAt !== 'string') return false;
    const expiry = Date.parse(session.expiresAt);
    return Number.isFinite(expiry);
};

const isExpiredPracticeSession = (value: PracticeSessionEnvelope): boolean => (
    Date.parse(value.expiresAt) <= Date.now()
);

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
    const [enteredCode, setEnteredCode] = useState('');
    const [codeError, setCodeError] = useState('');
    const [isVerifyingCode, setIsVerifyingCode] = useState(false);
    const [answers, setAnswers] = useState<Record<string, any>>(restoredDraft?.answers || {});
    const [expiresAt, setExpiresAt] = useState<string | null>(restoredDraft?.expiresAt || null);
    const timeLeft = useQuizDeadline(expiresAt);
    const [startTime, setStartTime] = useState<number>(() => (
        restoredDraft ? Date.parse(restoredDraft.startedAt) : 0
    ));
    const [result, setResult] = useState<StudentResult | null>(null);
    // Questions are always populated from the scoped learner endpoint at start.
    // A draft may provide the order/answers, but never authorizes using stale
    // questions from the catalog or session storage.
    const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
    const [isStarting, setIsStarting] = useState(false);
    const [startError, setStartError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const startTriggeredRef = useRef(false);
    const submissionTriggeredRef = useRef(false);
    const accessGrantRef = useRef<string | null>(null);

    // Gamification state
    const [showReward, setShowReward] = useState(false);
    const [rewardData, setRewardData] = useState<CompletionRewardData | null>(null);

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

    // Handlers
    const handleStart = useCallback(async () => {
        if (!studentName || !studentClass || isStarting || startTriggeredRef.current) return;
        startTriggeredRef.current = true;
        setIsStarting(true);
        setStartError(null);

        try {
            const assignmentId = quiz._assignmentData?.id
                ? String(quiz._assignmentData.id)
                : '';
            const loadedQuestions = quiz.isPractice
                ? quiz.questions
                : (() => {
                    // Formal/public/assignment quizzes must use the scoped DTO.
                    // Practice quizzes are virtual and already carry their
                    // server-selected questions in memory.
                    return fetchQuizPlayQuestions(quiz.id, {
                        assignmentId: assignmentId || undefined,
                        accessGrant: accessGrantRef.current || undefined,
                    }).then((playPayload) => (
                        Array.isArray(playPayload.questions)
                            ? playPayload.questions.map((question) => adaptStudentQuizQuestion(question))
                            : []
                    ));
                })();
            const resolvedQuestions = await loadedQuestions;
            if (resolvedQuestions.length === 0) {
                throw new Error('Không tải được câu hỏi của bài làm.');
            }

            if (assignmentId) {
                if (!session?.studentId) {
                    throw new Error('Phiên học sinh không hợp lệ. Em hãy đăng nhập lại.');
                }
                await startAssignmentAttempt(assignmentId, String(session.studentId));
            }

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

    const handleCodeVerify = useCallback(async () => {
        if (isVerifyingCode) return;
        setIsVerifyingCode(true);
        setCodeError('');
        try {
            const assignmentId = quiz._assignmentData?.id
                ? String(quiz._assignmentData.id)
                : undefined;
            const access = await requestQuizAccess(quiz.id, enteredCode, assignmentId);
            if (access.valid) {
                accessGrantRef.current = access.accessGrant || null;
                setStep(isLoggedIn ? 'notice' : 'info');
            } else setCodeError('Mã không đúng. Vui lòng thử lại!');
        } catch {
            setCodeError('Không thể kiểm tra mã lúc này. Vui lòng thử lại.');
        } finally {
            setIsVerifyingCode(false);
        }
    }, [enteredCode, isLoggedIn, isVerifyingCode, quiz._assignmentData?.id, quiz.id]);

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

    const handleSubmit = useCallback(async (_reason: SubmissionReason = 'manual') => {
        if (submissionTriggeredRef.current || isSubmitting) return;
        if (startTime <= 0) {
            setSubmitError('Bài làm chưa được bắt đầu hợp lệ. Em hãy quay lại và thử lại.');
            return;
        }
        submissionTriggeredRef.current = true;
        setIsSubmitting(true);
        setSubmitError(null);

        const elapsedSeconds = Math.max(0, Math.round((Date.now() - startTime) / 1000));
        const timeTaken = Math.round((elapsedSeconds / 60) * 100) / 100;

        try {
            const resultData: StudentResult = {
                id: generateUUID(), // Temporary client ID, will be replaced by server ID
                quizId: quiz.id,
                assignmentId: quiz._assignmentData?.id ? String(quiz._assignmentData.id) : undefined,
                quizTitle: quiz.title,
                studentName,
                studentClass,
                // Formal submissions are scored by the Worker. These values
                // are placeholders for the request shape and are never used
                // to render or reward a saved result.
                score: 0,
                correctCount: 0,
                questionCount: shuffledQuestions.length,
                totalQuestions: shuffledQuestions.length,
                voidedCount: 0,
                timeTaken,
                submittedAt: new Date().toISOString(),
                answers: {
                    ...answers,
                    _questionOrder: shuffledQuestions.map(q => q.id)
                },
            };

            let finalResult: StudentResult;
            if (quiz.isPractice) {
                const secureMetadataPresent = hasOwnProperty(quiz as SecurePracticeQuiz, 'practiceSession');
                if (secureMetadataPresent) {
                    const sessionEnvelope = (quiz as SecurePracticeQuiz).practiceSession;
                    if (!isSecurePracticeSession(sessionEnvelope)) {
                        throw new Error('Phiên luyện tập không hợp lệ. Vui lòng tải lại bài.');
                    }
                    if (isExpiredPracticeSession(sessionEnvelope)) {
                        throw new Error('Phiên luyện tập đã hết hạn. Vui lòng tải lại bài.');
                    }

                    const questionOrder = shuffledQuestions.map((question) => String(question.id));
                    const grading = await practiceService.gradePracticeQuiz({
                        sessionToken: sessionEnvelope.token,
                        answers,
                        questionOrder,
                    }, quiz.id);
                    finalResult = mapPracticeGradeToStudentResult(
                        resultData,
                        grading,
                        questionOrder,
                    );
                } else {
                    // Legacy Workers and teacher-owned previews have no secure
                    // session marker and retain their existing local grading path.
                    const grading = gradeQuiz({ ...quiz, questions: shuffledQuestions }, answers);
                    const questionById = new Map(shuffledQuestions.map((question) => [String(question.id), question]));
                    const validationDetails = grading.details.map((detail) => ({
                        questionId: detail.questionId,
                        isCorrect: detail.isCorrect,
                        status: detail.status,
                        issueCode: detail.issueCode,
                    }));
                    const practiceAnswers = Object.fromEntries(grading.details.map((detail) => {
                        const question = questionById.get(detail.questionId);
                        return [detail.questionId, {
                            selectedAnswer: answers[detail.questionId] ?? null,
                            isCorrect: detail.isCorrect,
                            status: detail.status,
                            gradingVersion: grading.engineVersion,
                            questionSnapshot: question ? { ...question } : undefined,
                        }];
                    }));
                    finalResult = {
                        ...resultData,
                        score: grading.score,
                        correctCount: grading.correctCount,
                        questionCount: grading.questionCount,
                        totalQuestions: grading.totalQuestions,
                        voidedCount: grading.voidedCount,
                        answers: {
                            ...practiceAnswers,
                            _questionOrder: shuffledQuestions.map(q => q.id),
                        },
                        validationDetails,
                        gradingVersion: grading.engineVersion,
                    };
                }
            } else {
                const savedResult = await onSaveResult(resultData, {
                    accessGrant: accessGrantRef.current || undefined,
                });
                if (!savedResult) {
                    throw new Error('Worker không trả về kết quả authoritative. Vui lòng thử lại.');
                }
                finalResult = savedResult;
            }
            setResult(finalResult);
            clearQuizAttemptDraft(quiz.id);

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

            if (!quiz.isPractice && classroomStore.studentSession?.username) {
                void useGameLoopStore.getState().trackQuizActivity({ resultId: finalResult.id });
            }

            setStep('result');
            playTingSound();
        } catch (error: unknown) {
            submissionTriggeredRef.current = false;
            const normalizedError = error instanceof Error ? error : new Error(String(error));
            setSubmitError('Lỗi khi nộp bài! ' + (normalizedError.message || ''));
        } finally {
            setIsSubmitting(false);
        }
    }, [isSubmitting, startTime, quiz, answers, studentName, studentClass, generateUUID, shuffledQuestions, onSaveResult, classroomStore.studentSession?.username]);

    // Date.now is authoritative. timeLeft only triggers display refreshes and re-checks.
    useEffect(() => {
        if (step !== 'quiz' || quiz.isPractice || !quiz.timeLimit || !expiresAt || startTime <= 0) return;
        if (remainingSeconds(expiresAt) === 0) {
            void handleSubmit('timeout');
        }
    }, [expiresAt, handleSubmit, quiz.isPractice, quiz.timeLimit, startTime, step, timeLeft]);

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
        enteredCode, setEnteredCode, codeError, isVerifyingCode, answers, timeLeft, result,
        shuffledQuestions, isStarting, startError, isSubmitting, submitError, showReward, setShowReward,
        showSubmitConfirm, setShowSubmitConfirm,
        rewardData, currentPage, setCurrentPage, totalPages, questionsOnCurrentPage, quizProgress,
        handleStart, handleCodeVerify, handleAnswerChange, handleMatchingClick, handleSubmit, handleRetryReward, isQuestionAnswered
    };
};

const mapPracticeGradeToStudentResult = (
    baseResult: StudentResult,
    grading: PracticeGradeResponse,
    questionOrder: string[],
): StudentResult => ({
    ...baseResult,
    id: grading.practiceId,
    score: grading.score,
    correctCount: grading.correctCount,
    questionCount: grading.questionCount,
    totalQuestions: grading.totalQuestions,
    voidedCount: grading.voidedCount,
    gradingVersion: grading.gradingVersion,
    answers: {
        ...grading.answers,
        _questionOrder: questionOrder,
    },
    validationDetails: [...grading.validationDetails] as StudentResult['validationDetails'],
    reviewDetails: grading.reviewDetails as StudentResult['reviewDetails'],
});

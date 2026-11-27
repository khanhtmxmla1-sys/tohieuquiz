import { useCallback, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Quiz, Question, QuizResultSubmissionContext, StudentResult } from '../../../types';
import type { StudentSession } from '../../../types/classroom.types';
import { useGamificationStore } from '../../../stores/useGamificationStore';
import { useGameLoopStore } from '../../../stores/useGameLoopStore';
import { playTingSound } from '../../../utils/toast';
import { clearQuizAttemptDraft } from '../quizAttemptDraft';
import { practiceService } from '../../../services/practiceService';
import {
    buildLegacyPracticeResult,
    hasOwnProperty,
    isExpiredPracticeSession,
    isSecurePracticeSession,
    mapPracticeGradeToStudentResult,
    type SecurePracticeQuiz,
} from '../utils/practiceSubmission';

type SubmissionReason = 'manual' | 'timeout';

interface CapturedClassroomStore {
    studentSession: StudentSession | null;
}

interface UseQuizSubmissionProps {
    quiz: Quiz;
    answers: Record<string, any>;
    shuffledQuestions: Question[];
    startTime: number;
    studentName: string;
    studentClass: string;
    onSaveResult: (
        result: StudentResult,
        context?: QuizResultSubmissionContext,
    ) => void | StudentResult | Promise<void | StudentResult>;
    generateUUID: () => string;
    classroomStore: CapturedClassroomStore;
    submissionTriggeredRef: MutableRefObject<boolean>;
    accessGrantRef: MutableRefObject<string | null>;
    setStep: (step: 'result') => void;
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

export const useQuizSubmission = ({
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
}: UseQuizSubmissionProps) => {
    const [result, setResult] = useState<StudentResult | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [showReward, setShowReward] = useState(false);
    const [rewardData, setRewardData] = useState<CompletionRewardData | null>(null);

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
                    finalResult = buildLegacyPracticeResult(
                        resultData,
                        quiz,
                        shuffledQuestions,
                        answers,
                    );
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
    }, [isSubmitting, startTime, quiz, answers, studentName, studentClass, generateUUID, shuffledQuestions, onSaveResult, classroomStore.studentSession?.username, submissionTriggeredRef, accessGrantRef, setStep]);

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

    return {
        result,
        isSubmitting,
        submitError,
        showReward,
        setShowReward,
        rewardData,
        handleSubmit,
        handleRetryReward,
    };
};

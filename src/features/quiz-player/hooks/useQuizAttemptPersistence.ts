import { useEffect } from 'react';
import type { Question } from '../../../types';
import { saveQuizAttemptDraft } from '../quizAttemptDraft';

interface UseQuizAttemptPersistenceProps {
    active: boolean;
    quizId: string;
    studentName: string;
    studentClass: string;
    answers: Record<string, unknown>;
    questions: Question[];
    currentPage: number;
    startedAt: number;
    expiresAt: string | null;
}

export const useQuizAttemptPersistence = ({
    active,
    quizId,
    studentName,
    studentClass,
    answers,
    questions,
    currentPage,
    startedAt,
    expiresAt,
}: UseQuizAttemptPersistenceProps): void => {
    useEffect(() => {
        if (!active || questions.length === 0 || startedAt <= 0) return;
        saveQuizAttemptDraft({
            version: 1,
            quizId,
            studentName,
            studentClass,
            answers,
            questionOrder: questions.map((question) => question.id),
            currentPage,
            startedAt: new Date(startedAt).toISOString(),
            expiresAt,
        });
    }, [answers, currentPage, expiresAt, quizId, questions, startedAt, active, studentClass, studentName]);
};

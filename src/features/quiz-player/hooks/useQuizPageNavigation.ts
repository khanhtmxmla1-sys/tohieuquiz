import { useCallback, useEffect, useRef, useState } from 'react';
import type { Question } from '../../../types';

export type QuizPageChangeHandler = (page: number, focusQuestionId?: string) => void;

interface UseQuizPageNavigationOptions {
    questions: Question[];
    currentPage: number;
    totalPages: number;
    questionsPerPage: number;
    setCurrentPage: (page: number) => void;
}

const getQuestionIdAtPageStart = (
    questions: Question[],
    page: number,
    questionsPerPage: number,
): string | null => questions[(page - 1) * questionsPerPage]?.id ?? null;

export const getActiveQuestionNumber = (
    questions: Question[],
    activeQuestionId: string | null,
    currentPage: number,
    questionsPerPage: number,
): number => {
    const activeQuestionIndex = questions.findIndex((question) => question.id === activeQuestionId);
    if (activeQuestionIndex >= 0) return activeQuestionIndex + 1;
    if (questions.length === 0) return 0;

    return Math.min((currentPage - 1) * questionsPerPage + 1, questions.length);
};

export const useQuizPageNavigation = ({
    questions,
    currentPage,
    totalPages,
    questionsPerPage,
    setCurrentPage,
}: UseQuizPageNavigationOptions) => {
    const initialQuestionId = getQuestionIdAtPageStart(questions, currentPage, questionsPerPage);
    const [activeQuestionId, setActiveQuestionId] = useState<string | null>(initialQuestionId);
    const pendingQuestionIdRef = useRef<string | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const secondAnimationFrameRef = useRef<number | null>(null);

    const cancelScheduledScroll = useCallback(() => {
        if (animationFrameRef.current !== null) {
            window.cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (secondAnimationFrameRef.current !== null) {
            window.cancelAnimationFrame(secondAnimationFrameRef.current);
            secondAnimationFrameRef.current = null;
        }
    }, []);

    const scrollToQuestion = useCallback((questionId: string) => {
        cancelScheduledScroll();

        const performScroll = () => {
            const target = document.getElementById(`question-${questionId}`);
            if (!target) return;

            target.focus({ preventScroll: true });
            const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
            target.scrollIntoView({
                behavior: reduceMotion ? 'auto' : 'smooth',
                block: 'start',
            });
        };

        animationFrameRef.current = window.requestAnimationFrame(() => {
            secondAnimationFrameRef.current = window.requestAnimationFrame(performScroll);
        });
    }, [cancelScheduledScroll]);

    const changePage = useCallback<QuizPageChangeHandler>((requestedPage, focusQuestionId) => {
        const safeTotalPages = Math.max(1, totalPages);
        const nextPage = Math.min(safeTotalPages, Math.max(1, requestedPage));
        const targetQuestionId = focusQuestionId
            ?? getQuestionIdAtPageStart(questions, nextPage, questionsPerPage);

        if (!targetQuestionId) return;

        setActiveQuestionId(targetQuestionId);

        if (nextPage === currentPage) {
            scrollToQuestion(targetQuestionId);
            return;
        }

        pendingQuestionIdRef.current = targetQuestionId;
        setCurrentPage(nextPage);
    }, [currentPage, questions, questionsPerPage, scrollToQuestion, setCurrentPage, totalPages]);

    useEffect(() => {
        if (currentPage > Math.max(1, totalPages)) {
            changePage(Math.max(1, totalPages));
            return;
        }

        const pendingQuestionId = pendingQuestionIdRef.current;
        if (!pendingQuestionId) return;

        pendingQuestionIdRef.current = null;
        scrollToQuestion(pendingQuestionId);
    }, [changePage, currentPage, scrollToQuestion, totalPages]);

    useEffect(() => {
        if (activeQuestionId && questions.some((question) => question.id === activeQuestionId)) return;
        setActiveQuestionId(getQuestionIdAtPageStart(questions, currentPage, questionsPerPage));
    }, [activeQuestionId, currentPage, questions, questionsPerPage]);

    useEffect(() => cancelScheduledScroll, [cancelScheduledScroll]);

    return {
        activeQuestionId,
        changePage,
    };
};

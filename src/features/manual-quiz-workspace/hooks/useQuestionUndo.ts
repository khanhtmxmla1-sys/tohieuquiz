import { useCallback, useEffect, useRef, useState } from 'react';
import { useManualQuizWorkspaceStore } from '../store/useManualQuizWorkspaceStore';
import type { ManualQuizQuestion } from '../types/manualQuizWorkspace.types';

const UNDO_WINDOW_MS = 8_000;

interface PendingQuestionDeletion {
    question: ManualQuizQuestion;
    index: number;
    displayNumber: number;
}

const cloneQuestion = (question: ManualQuizQuestion): ManualQuizQuestion => {
    if (typeof structuredClone === 'function') return structuredClone(question);
    return JSON.parse(JSON.stringify(question)) as ManualQuizQuestion;
};

export const useQuestionUndo = () => {
    const envelope = useManualQuizWorkspaceStore((state) => state.envelope);
    const removeQuestion = useManualQuizWorkspaceStore((state) => state.removeQuestion);
    const restoreQuestion = useManualQuizWorkspaceStore((state) => state.restoreQuestion);
    const [pendingDeletion, setPendingDeletion] = useState<PendingQuestionDeletion | null>(null);
    const expiryTimerRef = useRef<number | null>(null);

    const clearExpiryTimer = useCallback(() => {
        if (expiryTimerRef.current !== null) {
            window.clearTimeout(expiryTimerRef.current);
            expiryTimerRef.current = null;
        }
    }, []);

    const deleteWithUndo = useCallback((questionId: string) => {
        const questions = envelope?.quiz.questions ?? [];
        const index = questions.findIndex((question) => question.id === questionId);
        if (index < 0) return;

        clearExpiryTimer();
        setPendingDeletion({
            question: cloneQuestion(questions[index]),
            index,
            displayNumber: index + 1,
        });
        removeQuestion(questionId);
        expiryTimerRef.current = window.setTimeout(() => {
            setPendingDeletion(null);
            expiryTimerRef.current = null;
        }, UNDO_WINDOW_MS);
    }, [clearExpiryTimer, envelope, removeQuestion]);

    const undoDeletion = useCallback(() => {
        if (!pendingDeletion) return;
        clearExpiryTimer();
        restoreQuestion(pendingDeletion.question, pendingDeletion.index);
        setPendingDeletion(null);
    }, [clearExpiryTimer, pendingDeletion, restoreQuestion]);

    useEffect(() => () => clearExpiryTimer(), [clearExpiryTimer]);

    return {
        pendingDeletion,
        deleteWithUndo,
        undoDeletion,
    };
};

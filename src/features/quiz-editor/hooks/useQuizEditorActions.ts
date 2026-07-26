/**
 * useQuizEditorActions.ts
 *
 * Encapsulates question-level CRUD and AI-regeneration actions:
 *   - deleteQuestion
 *   - regenerateSingleQuestion
 *
 * Extracted from the QuizPreview monolith so that the container
 * component only coordinates state, not raw business logic.
 */

import { useState, useCallback } from 'react';
import type { Quiz, Question } from '../../../types';
import { showError } from '../../../utils/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseQuizEditorActionsOptions {
    quiz: Quiz | null;
    onUpdateQuestions?: (questions: Question[]) => void;
    onRegenerateQuestion?: (question: Question) => Promise<Question | null>;
}

interface UseQuizEditorActionsReturn {
    /** ID of the question currently being regenerated, or null. */
    isGeneratingSingle: string | null;
    /** Remove a question by ID from the quiz. */
    deleteQuestion: (questionId: string) => void;
    /** Replace a question with a new AI-generated version. */
    regenerateSingleQuestion: (question: Question) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQuizEditorActions({
    quiz,
    onUpdateQuestions,
    onRegenerateQuestion,
}: UseQuizEditorActionsOptions): UseQuizEditorActionsReturn {
    const [isGeneratingSingle, setIsGeneratingSingle] = useState<string | null>(null);

    /** Remove a question by ID. No-op if quiz or callback is absent. */
    const deleteQuestion = useCallback(
        (questionId: string) => {
            if (!quiz || !onUpdateQuestions) return;
            const updated = quiz.questions.filter((q) => q.id !== questionId);
            onUpdateQuestions(updated);
        },
        [quiz, onUpdateQuestions],
    );

    /**
     * Calls the parent-provided AI regeneration service, then replaces the
     * question in the quiz list if successful.
     */
    const regenerateSingleQuestion = useCallback(
        async (question: Question) => {
            if (!onRegenerateQuestion || !quiz || !onUpdateQuestions) return;

            setIsGeneratingSingle(question.id);
            try {
                const newQuestion = await onRegenerateQuestion(question);
                if (newQuestion) {
                    const updated = quiz.questions.map((existing) =>
                        existing.id === question.id ? newQuestion : existing,
                    );
                    onUpdateQuestions(updated);
                }
            } catch (err: unknown) {
                console.error('Failed to regenerate question:', err);
                showError('Lỗi khi sinh lại câu hỏi. Vui lòng thử lại.');
            } finally {
                setIsGeneratingSingle(null);
            }
        },
        [quiz, onUpdateQuestions, onRegenerateQuestion],
    );

    return {
        isGeneratingSingle,
        deleteQuestion,
        regenerateSingleQuestion,
    };
}

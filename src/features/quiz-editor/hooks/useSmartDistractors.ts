/**
 * useSmartDistractors.ts
 *
 * Encapsulates all state and logic related to AI-generated "smart distractors"
 * for MCQ / MULTIPLE_SELECT / IMAGE_QUESTION types.
 *
 * Extracted from the QuizPreview monolith to make it independently testable
 * and reusable across both the preview list and the edit modal.
 */

import { useState, useCallback } from 'react';
import type { Quiz, Question } from '../../../types';
import { generateSmartDistractors } from '../../../services/smartDistractorService';
import { supportsDistractors } from '../utils/questionHelpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingDistractorProposal {
    questionId: string;
    previousOptions: string[];
    proposedOptions: string[];
}

interface UseSmartDistractorsOptions {
    /** The current quiz. Required to look up question data. */
    quiz: Quiz | null;
    /**
     * Called when distractors are generated in "list" mode
     * (i.e. updating the quiz directly, not via an edit modal draft).
     */
    onUpdateQuestions?: (questions: Question[]) => void;
    /**
     * Called when distractors are generated in "modal" mode
     * (i.e. updating the local draft options array inside the editor).
     */
    onUpdateEditOptions?: (options: string[]) => void;
    /** Keep generated options pending until the teacher explicitly accepts them. */
    requireConfirmation?: boolean;
}

interface UseSmartDistractorsReturn {
    /** ID of the question currently being processed (list mode). */
    generatingDistractorId: string | null;
    /** True while generation is running inside the edit modal. */
    isGeneratingDistractors: boolean;
    /** Current selected distractor count (2–5). */
    distractorCount: number;
    setDistractorCount: (count: number) => void;
    /** ID of the question whose popover is open. */
    showDistractorPopover: string | null;
    setShowDistractorPopover: (id: string | null) => void;
    /** Last error message, or null if none. */
    distractorError: string | null;
    pendingDistractorProposal: PendingDistractorProposal | null;
    acceptPendingDistractors: () => void;
    rejectPendingDistractors: () => void;
    /**
     * Trigger distractor generation.
     * @param questionId - target question
     * @param count - number of distractors to generate
     * @param isFromModal - if true, calls onUpdateEditOptions; otherwise onUpdateQuestions
     */
    generateDistractors: (
        questionId: string,
        count: number,
        isFromModal?: boolean,
    ) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSmartDistractors({
    quiz,
    onUpdateQuestions,
    onUpdateEditOptions,
    requireConfirmation = false,
}: UseSmartDistractorsOptions): UseSmartDistractorsReturn {
    const [generatingDistractorId, setGeneratingDistractorId] = useState<string | null>(null);
    const [isGeneratingDistractors, setIsGeneratingDistractors] = useState(false);
    const [distractorCount, setDistractorCount] = useState(3);
    const [showDistractorPopover, setShowDistractorPopover] = useState<string | null>(null);
    const [distractorError, setDistractorError] = useState<string | null>(null);
    const [pendingDistractorProposal, setPendingDistractorProposal] = useState<PendingDistractorProposal | null>(null);

    const generateDistractors = useCallback(
        async (questionId: string, count: number, isFromModal = false) => {
            if (!quiz) return;

            const question = quiz.questions.find((q) => q.id === questionId);
            if (!question || !supportsDistractors(question.type)) return;

            // Cast to `Record` locally to access loosely-typed legacy fields
            const q = question as unknown as Record<string, unknown>;

            const options = (q.options as string[] | undefined) ?? [];
            const correctLetters: string[] =
                Array.isArray(q.correctAnswers)
                    ? (q.correctAnswers as string[])
                    : q.correctAnswer
                        ? [q.correctAnswer as string]
                        : [];

            const correctIndices = correctLetters.map((l) => l.charCodeAt(0) - 65);
            const correctTexts = correctIndices
                .map((idx) => options[idx] ?? '')
                .filter(Boolean);

            if (correctTexts.length === 0) {
                setDistractorError('Không tìm thấy đáp án đúng. Vui lòng kiểm tra lại.');
                return;
            }

            // --- Start loading ---
            if (isFromModal) {
                setIsGeneratingDistractors(true);
            } else {
                setGeneratingDistractorId(questionId);
            }
            setDistractorError(null);
            setShowDistractorPopover(null);

            try {
                const distractors = await generateSmartDistractors({
                    question: String(q.question ?? q.mainQuestion ?? ''),
                    correctAnswer: correctTexts.join(', '),
                    classLevel: quiz.classLevel || '3',
                    difficulty: q.difficulty as 1 | 2 | 3 | undefined,
                    existingOptions: options.filter((_, i) => !correctIndices.includes(i)),
                    count,
                });

                // Build new options: keep correct answers in place, fill rest with distractors
                const totalOptions = correctIndices.length + count;
                const newOptions: string[] = [];
                let distractorIdx = 0;

                for (let i = 0; i < totalOptions; i++) {
                    if (correctIndices.includes(i)) {
                        const correctTextIdx = correctIndices.indexOf(i);
                        newOptions.push(correctTexts[correctTextIdx]);
                    } else if (distractorIdx < distractors.length) {
                        newOptions.push(distractors[distractorIdx]);
                        distractorIdx++;
                    }
                }

                if (requireConfirmation) {
                    setPendingDistractorProposal({
                        questionId,
                        previousOptions: [...options],
                        proposedOptions: newOptions,
                    });
                } else if (isFromModal) {
                    onUpdateEditOptions?.(newOptions);
                } else {
                    const updatedQuestions = quiz.questions.map((qq) => {
                        if (qq.id !== questionId) return qq;
                        return { ...qq, options: newOptions } as Question;
                    });
                    onUpdateQuestions?.(updatedQuestions);
                }
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? err.message
                        : 'Không thể tạo đáp án nhiễu. Thử lại sau.';
                setDistractorError(message);
            } finally {
                setGeneratingDistractorId(null);
                setIsGeneratingDistractors(false);
            }
        },
        [quiz, onUpdateQuestions, onUpdateEditOptions, requireConfirmation],
    );

    const acceptPendingDistractors = useCallback(() => {
        if (!quiz || !pendingDistractorProposal) return;
        const updatedQuestions = quiz.questions.map((question) => question.id === pendingDistractorProposal.questionId
            ? { ...question, options: [...pendingDistractorProposal.proposedOptions] } as Question
            : question);
        onUpdateQuestions?.(updatedQuestions);
        setPendingDistractorProposal(null);
    }, [onUpdateQuestions, pendingDistractorProposal, quiz]);

    const rejectPendingDistractors = useCallback(() => {
        setPendingDistractorProposal(null);
    }, []);

    return {
        generatingDistractorId,
        isGeneratingDistractors,
        distractorCount,
        setDistractorCount,
        showDistractorPopover,
        setShowDistractorPopover,
        distractorError,
        pendingDistractorProposal,
        acceptPendingDistractors,
        rejectPendingDistractors,
        generateDistractors,
    };
}

import { useState } from 'react';
import type { Quiz, Question } from '../../../types';

export interface QuestionRegenerationChange {
    before: Question;
    after: Question;
}

interface RegenerationOptions {
    quiz: Quiz | null;
    onUpdateQuestions?: (questions: Question[]) => void;
    onRegenerateQuestion?: (question: Question) => Promise<Question | null>;
}

export const useQuestionRegeneration = ({
    quiz,
    onUpdateQuestions,
    onRegenerateQuestion,
}: RegenerationOptions) => {
    const [isGeneratingSingle, setIsGeneratingSingle] = useState<string | null>(null);
    const [lastRegeneration, setLastRegeneration] = useState<QuestionRegenerationChange | null>(null);

    const regenerateQuestion = async (question: Question) => {
        if (!onRegenerateQuestion || !quiz || !onUpdateQuestions) return;
        setIsGeneratingSingle(question.id);
        try {
            const replacement = await onRegenerateQuestion(question);
            if (replacement) {
                const normalizedReplacement = { ...replacement, id: question.id } as Question;
                onUpdateQuestions(
                    quiz.questions.map((existing) => (
                        existing.id === question.id ? normalizedReplacement : existing
                    )),
                );
                setLastRegeneration({ before: question, after: normalizedReplacement });
            }
        } finally {
            setIsGeneratingSingle(null);
        }
    };

    const undoLastRegeneration = () => {
        if (!lastRegeneration || !quiz || !onUpdateQuestions) return;
        onUpdateQuestions(
            quiz.questions.map((existing) => (
                existing.id === lastRegeneration.after.id
                    ? lastRegeneration.before
                    : existing
            )),
        );
        setLastRegeneration(null);
    };

    return {
        isGeneratingSingle,
        lastRegeneration,
        regenerateQuestion,
        undoLastRegeneration,
        dismissLastRegeneration: () => setLastRegeneration(null),
    };
};

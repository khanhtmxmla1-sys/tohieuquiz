import { useState } from 'react';
import type { Quiz, Question } from '../../../types';

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

    const regenerateQuestion = async (question: Question) => {
        if (!onRegenerateQuestion || !quiz || !onUpdateQuestions) return;
        setIsGeneratingSingle(question.id);
        try {
            const replacement = await onRegenerateQuestion(question);
            if (replacement) {
                onUpdateQuestions(
                    quiz.questions.map((existing) => existing.id === question.id ? replacement : existing),
                );
            }
        } finally {
            setIsGeneratingSingle(null);
        }
    };

    return { isGeneratingSingle, regenerateQuestion };
};

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { Quiz } from '../../../types';
import { parseQuizTags } from '../domain/quizCreationDefaults';

interface UseGeneratedQuizSyncOptions {
    generatedQuiz: Quiz | null;
    setGeneratedQuiz: Dispatch<SetStateAction<Quiz | null>>;
    manualTimeLimit: number | '';
    classLevel: string;
    category: string;
    requireCode: boolean;
    accessCode: string;
    showOnHome: boolean;
    quizTitle: string;
    teacherName: string | null;
    tags: string[];
}

export const useGeneratedQuizSync = ({
    generatedQuiz,
    setGeneratedQuiz,
    manualTimeLimit,
    classLevel,
    category,
    requireCode,
    accessCode,
    showOnHome,
    quizTitle,
    teacherName,
    tags,
}: UseGeneratedQuizSyncOptions) => {
    useEffect(() => {
        if (!generatedQuiz) return;

        const updates: Partial<Quiz> = {};
        if (typeof manualTimeLimit === 'number' && manualTimeLimit !== generatedQuiz.timeLimit) {
            updates.timeLimit = manualTimeLimit;
        }
        if (classLevel !== generatedQuiz.classLevel) updates.classLevel = classLevel;
        if (category !== generatedQuiz.category) updates.category = category;
        if (requireCode !== generatedQuiz.requireCode) updates.requireCode = requireCode;

        const normalizedAccessCode = requireCode
            ? (accessCode.toUpperCase() || undefined)
            : undefined;
        if (normalizedAccessCode !== (generatedQuiz.accessCode || undefined)) {
            updates.accessCode = normalizedAccessCode;
        }
        if (showOnHome !== generatedQuiz.showOnHome) updates.showOnHome = showOnHome;
        if (quizTitle && quizTitle !== generatedQuiz.title) updates.title = quizTitle;
        if (!generatedQuiz.createdBy && teacherName) updates.createdBy = teacherName;

        if (Object.keys(updates).length > 0) {
            setGeneratedQuiz({ ...generatedQuiz, ...updates });
        }
    }, [
        manualTimeLimit,
        classLevel,
        category,
        requireCode,
        accessCode,
        showOnHome,
        quizTitle,
        teacherName,
    ]);

    useEffect(() => {
        if (!generatedQuiz) return;
        const currentTags = parseQuizTags(generatedQuiz.tags);
        if (JSON.stringify(currentTags) !== JSON.stringify(tags)) {
            setGeneratedQuiz({ ...generatedQuiz, tags });
        }
    }, [tags]);
};

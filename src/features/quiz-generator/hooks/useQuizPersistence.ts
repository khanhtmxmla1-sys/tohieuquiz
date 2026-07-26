import { useState } from 'react';
import type { Quiz } from '../../../types';
import { showError } from '../../../utils/toast';
import type { useQuizFormState } from './useQuizFormState';
import type { useQuizShareState } from './useQuizShareState';

interface UseQuizPersistenceOptions {
    form: ReturnType<typeof useQuizFormState>;
    share: ReturnType<typeof useQuizShareState>;
    editingQuiz: Quiz | null;
    onSaveQuiz: (quiz: Quiz) => Promise<void>;
    onUpdateQuiz: (quiz: Quiz) => Promise<void>;
    onSuccess: () => void;
    addAssignment: (payload: unknown) => Promise<unknown>;
}

export const useQuizPersistence = ({
    form,
    share,
    editingQuiz,
    onSaveQuiz,
    onUpdateQuiz,
    onSuccess,
    addAssignment,
}: UseQuizPersistenceOptions) => {
    const [isSaving, setIsSaving] = useState(false);

    const handleSaveQuiz = async () => {
        if (!form.generatedQuiz || isSaving) return;
        if (!form.classLevel || !form.classLevel.trim()) {
            showError('Vui lòng chọn Khối lớp trước khi lưu đề thi');
            return;
        }

        setIsSaving(true);
        try {
            if (editingQuiz) await onUpdateQuiz(form.generatedQuiz);
            else await onSaveQuiz(form.generatedQuiz);

            if (form.assignToClass && form.selectedClassId) {
                try {
                    await addAssignment({
                        classId: form.selectedClassId,
                        quizId: form.generatedQuiz.id,
                        quizTitle: form.generatedQuiz.title,
                        dueDate: new Date(form.deadline).toISOString(),
                        type: 'quiz',
                        settings: {
                            duration: form.generatedQuiz.timeLimit,
                            maxAttempts: form.maxAttempts,
                            viewAnswers: true,
                            shuffleQuestions: true,
                        },
                    });
                } catch {
                    // Preserve the existing behavior: quiz save succeeds even if assignment creation fails.
                }
            }

            share.openSavedQuizLink(form.generatedQuiz.id);
            form.resetAfterSave();
            onSuccess();
        } catch (error: unknown) {
            const normalizedError = error instanceof Error ? error : new Error(String(error));
            showError(normalizedError.message || 'Lỗi khi lưu bài kiểm tra');
        } finally {
            setIsSaving(false);
        }
    };

    return {
        isSaving,
        handleSaveQuiz,
    };
};

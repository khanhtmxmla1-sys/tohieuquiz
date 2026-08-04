import { systemDateTimeLocalToIso } from '../../../utils/dateTime';
import { useState } from 'react';
import type { Quiz } from '../../../types';
import type { AiQuestionQualitySummary } from '../../../../shared/ai-question-quality.contract';
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
    qualitySummary: AiQuestionQualitySummary | null;
    acknowledgedWarningIds: ReadonlySet<string>;
    canSave: boolean;
    saveBlockReason: string | null;
}

export const useQuizPersistence = ({
    form,
    share,
    editingQuiz,
    onSaveQuiz,
    onUpdateQuiz,
    onSuccess,
    addAssignment,
    qualitySummary,
    acknowledgedWarningIds,
    canSave,
    saveBlockReason,
}: UseQuizPersistenceOptions) => {
    const [isSaving, setIsSaving] = useState(false);

    const handleSaveQuiz = async () => {
        if (!form.generatedQuiz || isSaving) return;
        if (!canSave) {
            showError(saveBlockReason || 'Đề chưa vượt qua kiểm tra chất lượng.');
            return;
        }
        if (!form.classLevel || !form.classLevel.trim()) {
            showError('Vui lòng chọn Khối lớp trước khi lưu đề thi');
            return;
        }

        const quizToSave: Quiz = qualitySummary
            ? {
                ...form.generatedQuiz,
                aiGeneration: {
                    ...form.generatedQuiz.aiGeneration,
                    qualitySummary: {
                        version: qualitySummary.version,
                        checkedAt: qualitySummary.checkedAt,
                        blockingCount: qualitySummary.blockingCount,
                        warningCount: qualitySummary.warningCount,
                        acknowledgedWarningIds: qualitySummary.issues
                            .filter((issue) => (
                                issue.severity === 'warning'
                                && acknowledgedWarningIds.has(issue.id)
                            ))
                            .map((issue) => issue.id),
                    },
                },
            }
            : form.generatedQuiz;

        setIsSaving(true);
        try {
            if (editingQuiz) await onUpdateQuiz(quizToSave);
            else await onSaveQuiz(quizToSave);

            if (form.assignToClass && form.selectedClassId) {
                try {
                    await addAssignment({
                        classId: form.selectedClassId,
                        quizId: quizToSave.id,
                        quizTitle: quizToSave.title,
                        dueDate: systemDateTimeLocalToIso(`${form.deadline}T23:59`),
                        type: 'quiz',
                        settings: {
                            duration: quizToSave.timeLimit,
                            maxAttempts: form.maxAttempts,
                            viewAnswers: true,
                            shuffleQuestions: true,
                        },
                    });
                } catch {
                    // Preserve the existing behavior: quiz save succeeds even if assignment creation fails.
                }
            }

            share.openSavedQuizLink(quizToSave.id);
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

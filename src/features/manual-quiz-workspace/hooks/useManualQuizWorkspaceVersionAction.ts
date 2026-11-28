import { useCallback, useState } from 'react';
import type { NavigateFunction } from 'react-router';
import { getQuizEditorRoute } from '../../../app/navigationRoutes';
import { createQuizVersion } from '../services/quizEditorService';
import { useManualQuizWorkspaceStore } from '../store/useManualQuizWorkspaceStore';

export interface UseManualQuizWorkspaceVersionActionOptions {
    quizId?: string;
    envelopeTitle?: string;
    availableQuizTitle?: string;
    guardTransition: () => boolean;
    navigate: NavigateFunction;
    loadQuizzes: (options: { force: true; includeQuestions: true }) => Promise<void>;
    onEditorAccessErrorChange: (message: string) => void;
}

export interface ManualQuizWorkspaceVersionAction {
    isCreatingVersion: boolean;
    createVersion: () => Promise<void>;
}

export const useManualQuizWorkspaceVersionAction = ({
    quizId,
    envelopeTitle,
    availableQuizTitle,
    guardTransition,
    navigate,
    loadQuizzes,
    onEditorAccessErrorChange,
}: UseManualQuizWorkspaceVersionActionOptions): ManualQuizWorkspaceVersionAction => {
    const [isCreatingVersion, setCreatingVersion] = useState(false);

    const createVersion = useCallback(async () => {
        if (!quizId || isCreatingVersion) return;
        if (!guardTransition()) return;
        setCreatingVersion(true);
        onEditorAccessErrorChange('');
        try {
            const version = await createQuizVersion(
                quizId,
                `${envelopeTitle || availableQuizTitle || 'Đề kiểm tra'} - Bản chỉnh sửa`,
            );
            useManualQuizWorkspaceStore.getState().reset();
            navigate(getQuizEditorRoute(version.id), { replace: true });
            void loadQuizzes({ force: true, includeQuestions: true }).catch(() => undefined);
        } catch (error: unknown) {
            onEditorAccessErrorChange(error instanceof Error ? error.message : 'Không thể tạo phiên bản mới.');
        } finally {
            setCreatingVersion(false);
        }
    }, [availableQuizTitle, envelopeTitle, guardTransition, isCreatingVersion, loadQuizzes, navigate, onEditorAccessErrorChange, quizId]);

    return { isCreatingVersion, createVersion };
};

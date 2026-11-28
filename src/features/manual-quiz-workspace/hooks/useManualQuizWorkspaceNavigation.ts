import React, { useCallback, useEffect, useRef } from 'react';
import type { NavigateFunction } from 'react-router';
import { showConfirm } from '../../../utils/toast';
import { useManualQuizWorkspaceStore } from '../store/useManualQuizWorkspaceStore';
import type {
    ManualQuizDraftEnvelope,
    ManualQuizQuestion,
} from '../types/manualQuizWorkspace.types';

export type ManualQuizWorkspaceView = 'overview' | 'edit' | 'preview';

type PendingEditorFocus = {
    questionId: string;
    field?: string;
    originElement: HTMLElement | null;
    activated: boolean;
};

export interface UseManualQuizWorkspaceNavigationOptions {
    envelope: ManualQuizDraftEnvelope | null;
    workspaceView: ManualQuizWorkspaceView;
    setWorkspaceView: React.Dispatch<React.SetStateAction<ManualQuizWorkspaceView>>;
    serverResolutionVersion: number;
    isReadOnly: boolean;
    requiresPublishedWarning?: boolean;
    guardTransition: () => boolean;
    publishAfterGuard: () => void;
    selectQuestion: (questionId: string) => void;
    setValidationOpen: React.Dispatch<React.SetStateAction<boolean>>;
    navigate: NavigateFunction;
}

export interface ManualQuizWorkspaceNavigation {
    previewQuestion: ManualQuizQuestion | null;
    focusQuestionEditor: (questionId: string, field?: string, skipGuard?: boolean) => void;
    handleQuestionEditorReady: (readyQuestionId: string) => void;
    openQuestionEditor: (questionId: string) => void;
    handleQuestionAdded: (questionId: string) => void;
    handleBackToOverview: () => void;
    handlePreview: (question: ManualQuizQuestion) => void;
    handleBackFromPreview: () => void;
    moveQuestion: (offset: -1 | 1) => void;
    finishQuestionEdit: () => void;
    handleHeaderBack: () => void;
    requestPublish: () => void;
}

export const useManualQuizWorkspaceNavigation = ({
    envelope,
    workspaceView,
    setWorkspaceView,
    serverResolutionVersion,
    isReadOnly,
    requiresPublishedWarning,
    guardTransition,
    publishAfterGuard,
    selectQuestion,
    setValidationOpen,
    navigate,
}: UseManualQuizWorkspaceNavigationOptions): ManualQuizWorkspaceNavigation => {
    const [previewQuestion, setPreviewQuestion] = React.useState<ManualQuizQuestion | null>(null);
    const [lastEditedQuestionId, setLastEditedQuestionId] = React.useState<string | null>(null);
    const pendingEditorFocusRef = useRef<PendingEditorFocus | null>(null);

    const focusQuestionEditor = useCallback((questionId: string, field?: string, skipGuard = false) => {
        if (!skipGuard && !guardTransition()) return;
        const originElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        pendingEditorFocusRef.current = { questionId, field, originElement, activated: false };
        setLastEditedQuestionId(questionId);
        selectQuestion(questionId);
        setWorkspaceView('edit');
        setValidationOpen(false);
    }, [guardTransition, selectQuestion, setValidationOpen, setWorkspaceView]);

    useEffect(() => {
        const pending = pendingEditorFocusRef.current;
        if (!pending) return;
        if (workspaceView === 'edit' && pending.questionId === envelope?.selectedQuestionId) {
            pending.activated = true;
            const activeElement = document.activeElement;
            const focusWasMoved = activeElement instanceof HTMLElement
                && activeElement !== document.body
                && activeElement !== pending.originElement;
            if (focusWasMoved) {
                pendingEditorFocusRef.current = null;
                return;
            }
            const editor = document.querySelector<HTMLElement>('[aria-label="Trình soạn câu hỏi"]');
            const target = editor?.querySelector<HTMLElement>(pending.field === 'points'
                ? '[aria-label="Điểm câu hỏi"]'
                : '[data-testid="question-rich-editor"]');
            if (target) {
                target.focus();
                pendingEditorFocusRef.current = null;
            }
            return;
        }
        if (pending.activated) pendingEditorFocusRef.current = null;
    }, [envelope?.selectedQuestionId, workspaceView]);

    useEffect(() => () => {
        pendingEditorFocusRef.current = null;
    }, []);

    const handleQuestionEditorReady = useCallback((readyQuestionId: string) => {
        const pending = pendingEditorFocusRef.current;
        if (!pending) return;
        if (readyQuestionId !== pending.questionId) return;
        const currentEnvelope = useManualQuizWorkspaceStore.getState().envelope;
        if (workspaceView !== 'edit' || currentEnvelope?.selectedQuestionId !== pending.questionId) {
            if (pending.activated) pendingEditorFocusRef.current = null;
            return;
        }
        pending.activated = true;

        const activeElement = document.activeElement;
        const focusWasMoved = activeElement instanceof HTMLElement
            && activeElement !== document.body
            && activeElement !== pending.originElement;
        if (focusWasMoved) {
            pendingEditorFocusRef.current = null;
            return;
        }

        const editor = document.querySelector<HTMLElement>('[aria-label="Trình soạn câu hỏi"]');
        const target = editor?.querySelector<HTMLElement>(pending.field === 'points'
            ? '[aria-label="Điểm câu hỏi"]'
            : '[data-testid="question-rich-editor"]');
        if (!target) return;
        target.focus();
        pendingEditorFocusRef.current = null;
    }, [workspaceView]);

    useEffect(() => {
        if (serverResolutionVersion === 0) return;
        const acceptedEnvelope = useManualQuizWorkspaceStore.getState().envelope;
        const acceptedQuestion = acceptedEnvelope?.quiz.questions.find(
            (question) => question.id === acceptedEnvelope.selectedQuestionId,
        ) ?? null;
        setPreviewQuestion(acceptedQuestion);
    }, [serverResolutionVersion]);

    const openQuestionEditor = useCallback((questionId: string) => {
        if (isReadOnly) {
            if (!guardTransition()) return;
            setLastEditedQuestionId(questionId);
            selectQuestion(questionId);
            const question = useManualQuizWorkspaceStore.getState().envelope?.quiz.questions.find((item) => item.id === questionId);
            if (question) setPreviewQuestion(question);
            setWorkspaceView('preview');
            return;
        }
        focusQuestionEditor(questionId);
    }, [focusQuestionEditor, guardTransition, isReadOnly, selectQuestion, setWorkspaceView]);

    const handleQuestionAdded = useCallback((questionId: string) => {
        focusQuestionEditor(questionId, undefined, true);
    }, [focusQuestionEditor]);

    const handleBackToOverview = useCallback(() => {
        if (!guardTransition()) return;
        setWorkspaceView('overview');
    }, [guardTransition, setWorkspaceView]);

    const handlePreview = useCallback((question: ManualQuizQuestion) => {
        if (!guardTransition()) return;
        setPreviewQuestion(question);
        setWorkspaceView('preview');
    }, [guardTransition, setWorkspaceView]);

    const handleBackFromPreview = useCallback(() => {
        if (!guardTransition()) return;
        setWorkspaceView(isReadOnly ? 'overview' : 'edit');
    }, [guardTransition, isReadOnly, setWorkspaceView]);

    const moveQuestion = useCallback((offset: -1 | 1) => {
        if (!guardTransition()) return;
        const currentEnvelope = useManualQuizWorkspaceStore.getState().envelope;
        const currentId = currentEnvelope?.selectedQuestionId;
        if (!currentEnvelope || !currentId) return;
        const index = currentEnvelope.quiz.questions.findIndex((question) => question.id === currentId);
        const next = currentEnvelope.quiz.questions[index + offset];
        if (!next) return;
        focusQuestionEditor(next.id, undefined, true);
    }, [focusQuestionEditor, guardTransition]);

    const finishQuestionEdit = useCallback(() => {
        if (!guardTransition()) return;
        setWorkspaceView('overview');
    }, [guardTransition, setWorkspaceView]);

    const handleHeaderBack = useCallback(() => {
        if (workspaceView === 'preview' || workspaceView === 'edit') {
            handleBackToOverview();
            return;
        }
        if (!guardTransition()) return;
        navigate(-1);
    }, [guardTransition, handleBackToOverview, navigate, workspaceView]);

    useEffect(() => {
        if (workspaceView !== 'overview' || !lastEditedQuestionId) return;
        const timer = window.setTimeout(() => {
            const row = document.querySelector<HTMLElement>(`[data-question-id="${lastEditedQuestionId}"]`);
            if (row && typeof row.scrollIntoView === 'function') {
                row.scrollIntoView({ block: 'nearest' });
            }
            const semanticAction = row?.querySelector<HTMLElement>('button[aria-label^="Sửa câu"], button[aria-label^="Xem câu"]')
                ?? row?.querySelector<HTMLElement>('button[aria-label^="Chọn câu"]');
            semanticAction?.focus();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [lastEditedQuestionId, workspaceView]);

    const requestPublish = useCallback(() => {
        if (isReadOnly) return;
        if (!guardTransition()) return;
        if (requiresPublishedWarning) {
            showConfirm({
                message: 'Đề đã được giao cho học sinh. Những thay đổi sẽ áp dụng cho các lượt làm tiếp theo. Bạn có chắc muốn lưu?',
                confirmLabel: 'Lưu thay đổi',
                onConfirm: () => {
                    if (!guardTransition()) return;
                    publishAfterGuard();
                },
            });
            return;
        }
        publishAfterGuard();
    }, [guardTransition, isReadOnly, publishAfterGuard, requiresPublishedWarning]);

    return {
        previewQuestion,
        focusQuestionEditor,
        handleQuestionEditorReady,
        openQuestionEditor,
        handleQuestionAdded,
        handleBackToOverview,
        handlePreview,
        handleBackFromPreview,
        moveQuestion,
        finishQuestionEdit,
        handleHeaderBack,
        requestPublish,
    };
};

import { useCallback, useRef, useState } from 'react';
import type { Quiz } from '../../../types';
import { useQuizStore } from '../../../../stores/quizStore';
import { deleteRemoteManualQuizDraftIfExists } from '../../../services/manualQuizDraftService';
import { removeLocalDraft } from '../draft/manualQuizDraftRepository';
import { useManualQuizWorkspaceStore } from '../store/useManualQuizWorkspaceStore';
import type { ManualQuizDraftEnvelope } from '../types/manualQuizWorkspace.types';
import { reportManualQuizTelemetry } from '../../../services/telemetryService';
import {
    hasBlockingManualQuizIssues,
    validateManualQuiz,
    type ManualQuizIssue,
} from '../validation/manualQuizValidation';

interface UseManualQuizPublishOptions {
    envelope: ManualQuizDraftEnvelope | null;
    onSuccess?(quiz: Quiz): void | Promise<void>;
}

export interface ManualQuizPublishController {
    isPublishing: boolean;
    error: string | null;
    cleanupWarning: string | null;
    validationIssues: ManualQuizIssue[];
    publish(): Promise<boolean>;
}

const cloneQuizSnapshot = (quiz: Quiz): Quiz => {
    if (typeof structuredClone === 'function') return structuredClone(quiz);
    return JSON.parse(JSON.stringify(quiz)) as Quiz;
};

export const useManualQuizPublish = ({
    envelope,
    onSuccess,
}: UseManualQuizPublishOptions): ManualQuizPublishController => {
    const createQuiz = useQuizStore((state) => state.createQuiz);
    const modifyQuiz = useQuizStore((state) => state.modifyQuiz);
    const loadQuizzes = useQuizStore((state) => state.loadQuizzes);
    const resetWorkspace = useManualQuizWorkspaceStore((state) => state.reset);
    const publishLockRef = useRef(false);
    const [isPublishing, setPublishing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cleanupWarning, setCleanupWarning] = useState<string | null>(null);
    const [validationIssues, setValidationIssues] = useState<ManualQuizIssue[]>([]);

    const publish = useCallback(async (): Promise<boolean> => {
        if (publishLockRef.current || !envelope) return false;

        const snapshot = cloneQuizSnapshot(envelope.quiz);
        const issues = validateManualQuiz(snapshot, { targetPoints: envelope.targetPoints });
        setValidationIssues(issues);
        setError(null);
        setCleanupWarning(null);

        if (hasBlockingManualQuizIssues(issues)) {
            reportManualQuizTelemetry('validation_failed', {
                mode: envelope.quizId ? 'edit' : 'new',
                outcome: 'blocked',
                questionCount: snapshot.questions.length,
                issueCount: issues.filter((issue) => issue.severity === 'error').length,
                errorCode: 'VALIDATION_ERROR',
            });
            setError('Đề vẫn còn lỗi bắt buộc. Vui lòng kiểm tra và sửa trước khi xuất bản.');
            return false;
        }

        const publishStartedAt = performance.now();
        publishLockRef.current = true;
        setPublishing(true);
        try {
            if (envelope.quizId) await modifyQuiz(snapshot);
            else await createQuiz(snapshot);

            const cleanupResults = await Promise.allSettled([
                Promise.resolve().then(() => removeLocalDraft(envelope.ownerUsername, envelope.draftId)),
                deleteRemoteManualQuizDraftIfExists(envelope.draftId),
            ]);
            if (cleanupResults.some((result) => result.status === 'rejected')) {
                setCleanupWarning(
                    'Đề đã xuất bản thành công nhưng một bản nháp cũ chưa được dọn. Hệ thống sẽ bỏ qua bản này ở lần mở sau.',
                );
            }

            try {
                await loadQuizzes({ force: true });
            } catch {
                setCleanupWarning((current) => current || (
                    'Đề đã xuất bản thành công nhưng danh sách đề chưa làm mới. Hãy tải lại trang Quản lý.'
                ));
            }

            reportManualQuizTelemetry('publish_succeeded', {
                mode: envelope.quizId ? 'edit' : 'new',
                outcome: 'success',
                durationMs: performance.now() - publishStartedAt,
                questionCount: snapshot.questions.length,
            });
            resetWorkspace();
            await onSuccess?.(snapshot);
            return true;
        } catch (caught) {
            const normalized = caught instanceof Error ? caught : new Error(String(caught));
            reportManualQuizTelemetry('publish_failed', {
                mode: envelope.quizId ? 'edit' : 'new',
                outcome: 'failure',
                durationMs: performance.now() - publishStartedAt,
                questionCount: snapshot.questions.length,
                errorCode: normalized.message,
            });
            setError(normalized.message || 'Không thể xuất bản đề. Vui lòng thử lại.');
            return false;
        } finally {
            publishLockRef.current = false;
            setPublishing(false);
        }
    }, [createQuiz, envelope, loadQuizzes, modifyQuiz, onSuccess, resetWorkspace]);

    return {
        isPublishing,
        error,
        cleanupWarning,
        validationIssues,
        publish,
    };
};

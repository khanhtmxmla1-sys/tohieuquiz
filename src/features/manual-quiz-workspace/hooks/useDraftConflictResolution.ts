import { useCallback, useState } from 'react';
import type { ManualQuizDraftRecord } from '../../../../shared/manual-quiz-draft.contract';
import {
    ManualQuizDraftConflictError,
    putRemoteManualQuizDraft,
} from '../../../services/manualQuizDraftService';
import { reportManualQuizTelemetry } from '../../../services/telemetryService';
import type {
    ManualQuizDraftEnvelope,
    ManualQuizSaveStatus,
} from '../types/manualQuizWorkspace.types';

interface UseDraftConflictResolutionOptions {
    getLatestLocalDraft(): ManualQuizDraftEnvelope | null;
    acceptRemoteRecord(record: ManualQuizDraftRecord): void | Promise<void>;
    setSaveStatus(status: ManualQuizSaveStatus, error?: string | null): void;
}

export interface DraftConflictResolutionController {
    conflict: ManualQuizDraftRecord | null;
    isResolvingConflict: boolean;
    captureConflict(error: ManualQuizDraftConflictError): void;
    resolveWithLocal(): Promise<void>;
    resolveWithServer(): Promise<void>;
}

export const useDraftConflictResolution = ({
    getLatestLocalDraft,
    acceptRemoteRecord,
    setSaveStatus,
}: UseDraftConflictResolutionOptions): DraftConflictResolutionController => {
    const [conflict, setConflict] = useState<ManualQuizDraftRecord | null>(null);
    const [isResolvingConflict, setIsResolvingConflict] = useState(false);

    const captureConflict = useCallback((error: ManualQuizDraftConflictError) => {
        if (!error.current) {
            const localDraft = getLatestLocalDraft();
            reportManualQuizTelemetry('conflict_detected', {
                mode: localDraft?.quizId ? 'edit' : 'new',
                saveTarget: 'remote',
                outcome: 'blocked',
                questionCount: localDraft?.quiz.questions.length,
                conflictKind: 'missing_remote',
                errorCode: 'REVISION_CONFLICT',
            });
            setSaveStatus('error', 'Bản nháp trên hệ thống không còn tồn tại.');
            return;
        }
        setConflict(error.current);
        setSaveStatus('conflict');
    }, [setSaveStatus]);

    const resolveWithServer = useCallback(async () => {
        if (!conflict || isResolvingConflict) return;
        setIsResolvingConflict(true);
        try {
            await acceptRemoteRecord(conflict);
            setConflict(null);
            setSaveStatus('saved');
        } catch (error) {
            setSaveStatus(
                'error',
                error instanceof Error ? error.message : 'Không thể dùng bản nháp trên hệ thống.',
            );
        } finally {
            setIsResolvingConflict(false);
        }
    }, [acceptRemoteRecord, conflict, isResolvingConflict, setSaveStatus]);

    const resolveWithLocal = useCallback(async () => {
        if (!conflict || isResolvingConflict) return;
        const localDraft = getLatestLocalDraft();
        if (!localDraft) return;

        setIsResolvingConflict(true);
        setSaveStatus('saving-remote');
        try {
            const record = await putRemoteManualQuizDraft(localDraft, conflict.revision);
            await acceptRemoteRecord(record);
            setConflict(null);
            setSaveStatus('saved');
        } catch (error) {
            if (error instanceof ManualQuizDraftConflictError) {
                captureConflict(error);
            } else {
                setSaveStatus(
                    'error',
                    error instanceof Error ? error.message : 'Không thể đồng bộ bản nháp trên máy.',
                );
            }
        } finally {
            setIsResolvingConflict(false);
        }
    }, [captureConflict, conflict, getLatestLocalDraft, isResolvingConflict, setSaveStatus, acceptRemoteRecord]);

    return {
        conflict,
        isResolvingConflict,
        captureConflict,
        resolveWithLocal,
        resolveWithServer,
    };
};

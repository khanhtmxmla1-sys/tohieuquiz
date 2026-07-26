import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { saveLocalDraft } from '../draft/manualQuizDraftRepository';
import { getManualQuizDraftHash } from '../draft/manualQuizDraftSerializer';
import { useManualQuizWorkspaceStore } from '../store/useManualQuizWorkspaceStore';
import type { ManualQuizDraftEnvelope } from '../types/manualQuizWorkspace.types';
import { browserIsOnline } from './manualQuizAutosaveUtils';
import { reportManualQuizTelemetry } from '../../../services/telemetryService';

const LOCAL_AUTOSAVE_DELAY_MS = 600;

export interface LocalManualQuizAutosaveController {
    lastSavedHashRef: MutableRefObject<string | null>;
    persistImmediately(envelope: ManualQuizDraftEnvelope): string;
}

export const useLocalManualQuizAutosave = (
    envelope: ManualQuizDraftEnvelope | null,
): LocalManualQuizAutosaveController => {
    const setSaveStatus = useManualQuizWorkspaceStore((state) => state.setSaveStatus);
    const activeDraftIdRef = useRef<string | null>(null);
    const lastSavedHashRef = useRef<string | null>(null);
    const hasUnsavedChangesRef = useRef(false);

    if (envelope && activeDraftIdRef.current !== envelope.draftId) {
        activeDraftIdRef.current = envelope.draftId;
        lastSavedHashRef.current = null;
        hasUnsavedChangesRef.current = false;
    }

    const persistImmediately = useCallback((draft: ManualQuizDraftEnvelope): string => {
        const startedAt = performance.now();
        try {
            const result = saveLocalDraft(draft);
            lastSavedHashRef.current = result.hash;
            hasUnsavedChangesRef.current = false;
            reportManualQuizTelemetry('draft_save_succeeded', {
                mode: draft.quizId ? 'edit' : 'new',
                saveTarget: 'local',
                outcome: 'success',
                durationMs: performance.now() - startedAt,
                questionCount: draft.quiz.questions.length,
                online: browserIsOnline(),
            });
            return result.hash;
        } catch (error) {
            reportManualQuizTelemetry('draft_save_failed', {
                mode: draft.quizId ? 'edit' : 'new',
                saveTarget: 'local',
                outcome: 'failure',
                durationMs: performance.now() - startedAt,
                questionCount: draft.quiz.questions.length,
                online: browserIsOnline(),
                errorCode: error instanceof Error ? error.message : 'LOCAL_STORAGE_ERROR',
            });
            throw error;
        }
    }, []);

    useEffect(() => {
        if (!envelope) return undefined;

        let currentHash: string;
        try {
            currentHash = getManualQuizDraftHash(envelope);
        } catch (error) {
            hasUnsavedChangesRef.current = true;
            reportManualQuizTelemetry('draft_save_failed', {
                mode: envelope.quizId ? 'edit' : 'new',
                saveTarget: 'local',
                outcome: 'failure',
                questionCount: envelope.quiz.questions.length,
                online: browserIsOnline(),
                errorCode: 'VALIDATION_ERROR',
            });
            setSaveStatus(
                'error',
                error instanceof Error
                    ? error.message
                    : 'Không thể chuẩn bị bản nháp để tự động lưu.',
            );
            return undefined;
        }

        if (currentHash === lastSavedHashRef.current) {
            hasUnsavedChangesRef.current = false;
            return undefined;
        }

        hasUnsavedChangesRef.current = true;
        const timer = window.setTimeout(() => {
            setSaveStatus('saving-local');
            try {
                persistImmediately(envelope);
                setSaveStatus(browserIsOnline() ? 'saved' : 'offline');
            } catch (error) {
                setSaveStatus(
                    'error',
                    error instanceof Error
                        ? error.message
                        : 'Không thể lưu bản nháp trên trình duyệt.',
                );
            }
        }, LOCAL_AUTOSAVE_DELAY_MS);

        return () => window.clearTimeout(timer);
    }, [envelope, persistImmediately, setSaveStatus]);

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!hasUnsavedChangesRef.current) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    return { lastSavedHashRef, persistImmediately };
};

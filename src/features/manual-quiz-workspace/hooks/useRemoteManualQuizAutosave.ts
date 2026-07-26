import { useCallback, useEffect, useRef, useState } from 'react';
import type { ManualQuizDraftRecord } from '../../../../shared/manual-quiz-draft.contract';
import {
    ManualQuizDraftConflictError,
    putRemoteManualQuizDraft,
} from '../../../services/manualQuizDraftService';
import {
    getManualQuizDraftContentHash,
    getManualQuizDraftHash,
} from '../draft/manualQuizDraftSerializer';
import { useManualQuizWorkspaceStore } from '../store/useManualQuizWorkspaceStore';
import type { ManualQuizDraftEnvelope } from '../types/manualQuizWorkspace.types';
import { browserIsOnline } from './manualQuizAutosaveUtils';
import {
    useDraftConflictResolution,
    type DraftConflictResolutionController,
} from './useDraftConflictResolution';
import type { LocalManualQuizAutosaveController } from './useLocalManualQuizAutosave';
import { reportManualQuizTelemetry } from '../../../services/telemetryService';

export interface RemoteManualQuizAutosaveController extends DraftConflictResolutionController {
    saveNow(): void;
}

const REMOTE_AUTOSAVE_DELAY_MS = 2_000;

export const useRemoteManualQuizAutosave = (
    envelope: ManualQuizDraftEnvelope | null,
    localAutosave: LocalManualQuizAutosaveController,
): RemoteManualQuizAutosaveController => {
    const { lastSavedHashRef, persistImmediately } = localAutosave;
    const setSaveStatus = useManualQuizWorkspaceStore((state) => state.setSaveStatus);
    const replaceEnvelope = useManualQuizWorkspaceStore((state) => state.replaceEnvelope);
    const acknowledgeRemoteRevision = useManualQuizWorkspaceStore(
        (state) => state.acknowledgeRemoteRevision,
    );
    const activeDraftIdRef = useRef<string | null>(null);
    const latestEnvelopeRef = useRef<ManualQuizDraftEnvelope | null>(envelope);
    const lastRemoteContentHashRef = useRef<string | null>(null);
    const serverRevisionRef = useRef(0);
    const remoteInFlightRef = useRef(false);
    const remotePendingRef = useRef(false);
    const forceImmediateRemoteRef = useRef(false);
    const requestSequenceRef = useRef(0);
    const controllersRef = useRef(new Set<AbortController>());
    const [remoteRetryTick, setRemoteRetryTick] = useState(0);

    latestEnvelopeRef.current = envelope;
    if (envelope && activeDraftIdRef.current !== envelope.draftId) {
        activeDraftIdRef.current = envelope.draftId;
        lastRemoteContentHashRef.current = null;
        serverRevisionRef.current = envelope.revision;
        remotePendingRef.current = false;
    } else if (envelope && envelope.revision > serverRevisionRef.current) {
        serverRevisionRef.current = envelope.revision;
    }

    const acceptRemoteRecord = useCallback((record: ManualQuizDraftRecord) => {
        const normalized = {
            ...(record.draft as ManualQuizDraftEnvelope),
            draftId: record.id,
            quizId: record.quizId,
            ownerUsername: record.ownerUsername,
            revision: record.revision,
            updatedAt: record.updatedAt,
        } satisfies ManualQuizDraftEnvelope;

        persistImmediately(normalized);
        lastRemoteContentHashRef.current = getManualQuizDraftContentHash(normalized);
        serverRevisionRef.current = record.revision;
        replaceEnvelope(normalized);
        setSaveStatus('saved');
    }, [persistImmediately, replaceEnvelope, setSaveStatus]);

    const conflictController = useDraftConflictResolution({
        getLatestLocalDraft: () => latestEnvelopeRef.current,
        acceptRemoteRecord,
        setSaveStatus,
    });

    useEffect(() => {
        const handleOffline = () => setSaveStatus('offline');
        const handleOnline = () => {
            forceImmediateRemoteRef.current = true;
            setSaveStatus('idle');
            setRemoteRetryTick((value) => value + 1);
        };
        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);
        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, [setSaveStatus]);

    useEffect(() => {
        if (!envelope || conflictController.conflict) return undefined;

        let contentHash: string;
        let fullHash: string;
        try {
            contentHash = getManualQuizDraftContentHash(envelope);
            fullHash = getManualQuizDraftHash(envelope);
        } catch {
            return undefined;
        }

        if (contentHash === lastRemoteContentHashRef.current) return undefined;
        if (!browserIsOnline()) {
            setSaveStatus('offline');
            return undefined;
        }

        const delay = forceImmediateRemoteRef.current ? 0 : REMOTE_AUTOSAVE_DELAY_MS;
        forceImmediateRemoteRef.current = false;
        const timer = window.setTimeout(async () => {
            const current = latestEnvelopeRef.current;
            if (!current) return;

            const latestFullHash = getManualQuizDraftHash(current);
            const latestContentHash = getManualQuizDraftContentHash(current);
            if (latestContentHash !== contentHash || latestFullHash !== fullHash) return;
            if (lastSavedHashRef.current !== latestFullHash) {
                setRemoteRetryTick((value) => value + 1);
                return;
            }
            if (remoteInFlightRef.current) {
                remotePendingRef.current = true;
                return;
            }

            remoteInFlightRef.current = true;
            remotePendingRef.current = false;
            const sequence = ++requestSequenceRef.current;
            const controller = new AbortController();
            controllersRef.current.add(controller);
            setSaveStatus('saving-remote');
            let hadConflict = false;
            const remoteStartedAt = performance.now();

            try {
                const record = await putRemoteManualQuizDraft(
                    current,
                    serverRevisionRef.current,
                    controller.signal,
                );
                serverRevisionRef.current = record.revision;
                lastRemoteContentHashRef.current = latestContentHash;

                const newest = latestEnvelopeRef.current;
                const newestContentHash = newest
                    ? getManualQuizDraftContentHash(newest)
                    : null;
                const responseIsLatest = sequence === requestSequenceRef.current
                    && newestContentHash === latestContentHash;

                acknowledgeRemoteRevision(
                    record.revision,
                    responseIsLatest ? record.updatedAt : undefined,
                );
                reportManualQuizTelemetry('draft_save_succeeded', {
                    mode: current.quizId ? 'edit' : 'new',
                    saveTarget: 'remote',
                    outcome: 'success',
                    durationMs: performance.now() - remoteStartedAt,
                    questionCount: current.quiz.questions.length,
                    online: true,
                });
                if (responseIsLatest) {
                    setSaveStatus('saved');
                } else {
                    remotePendingRef.current = true;
                    setSaveStatus('idle');
                }
            } catch (error) {
                if (error instanceof ManualQuizDraftConflictError) {
                    hadConflict = true;
                    reportManualQuizTelemetry('conflict_detected', {
                        mode: current.quizId ? 'edit' : 'new',
                        saveTarget: 'remote',
                        outcome: 'blocked',
                        durationMs: performance.now() - remoteStartedAt,
                        questionCount: current.quiz.questions.length,
                        conflictKind: error.current ? 'revision' : 'missing_remote',
                        errorCode: 'REVISION_CONFLICT',
                    });
                    conflictController.captureConflict(error);
                } else if (!controller.signal.aborted) {
                    reportManualQuizTelemetry('draft_save_failed', {
                        mode: current.quizId ? 'edit' : 'new',
                        saveTarget: 'remote',
                        outcome: 'failure',
                        durationMs: performance.now() - remoteStartedAt,
                        questionCount: current.quiz.questions.length,
                        online: browserIsOnline(),
                        errorCode: error instanceof Error ? error.message : 'NETWORK_ERROR',
                    });
                    setSaveStatus(
                        browserIsOnline() ? 'error' : 'offline',
                        browserIsOnline() && error instanceof Error ? error.message : null,
                    );
                }
            } finally {
                controllersRef.current.delete(controller);
                remoteInFlightRef.current = false;
                if (!hadConflict && remotePendingRef.current) {
                    forceImmediateRemoteRef.current = true;
                    setRemoteRetryTick((value) => value + 1);
                }
            }
        }, delay);

        return () => window.clearTimeout(timer);
    }, [
        acknowledgeRemoteRevision,
        conflictController.captureConflict,
        conflictController.conflict,
        envelope,
        lastSavedHashRef,
        remoteRetryTick,
        setSaveStatus,
    ]);

    const saveNow = useCallback(() => {
        const current = latestEnvelopeRef.current;
        if (!current) return;
        persistImmediately(current);
        if (!browserIsOnline()) {
            setSaveStatus('offline');
            return;
        }
        forceImmediateRemoteRef.current = true;
        setSaveStatus('idle');
        setRemoteRetryTick((value) => value + 1);
    }, [persistImmediately, setSaveStatus]);

    useEffect(() => () => {
        controllersRef.current.forEach((controller) => controller.abort());
        controllersRef.current.clear();
    }, []);

    return { ...conflictController, saveNow };
};

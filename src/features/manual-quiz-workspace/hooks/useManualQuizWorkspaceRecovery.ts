import { useEffect, useState } from 'react';
import { findLatestLocalDraft, removeLocalDraft } from '../draft/manualQuizDraftRepository';
import { getRemoteManualQuizDraft } from '../../../services/manualQuizDraftService';
import type { Quiz } from '../../../types';
import type {
    ManualQuizDraftEnvelope,
    ManualQuizSeed,
} from '../types/manualQuizWorkspace.types';

export interface UseManualQuizWorkspaceRecoveryOptions {
    username: string | null;
    quizId?: string;
    availableQuiz: Quiz | null;
    seed: ManualQuizSeed;
    workspaceStartedAt?: string;
    requestedDraftId: string | null;
    isReadOnly: boolean;
    editorAccessStatus: 'loading' | 'loaded' | 'error';
    envelope: ManualQuizDraftEnvelope | null;
    hydrateEnvelope: (envelope: ManualQuizDraftEnvelope) => void;
    initializeFromQuiz: (quiz: Quiz, ownerUsername: string) => void;
    initializeFromSeed: (seed: ManualQuizSeed, ownerUsername: string) => void;
}

export interface ManualQuizWorkspaceRecovery {
    pendingRecovery: ManualQuizDraftEnvelope | null;
    remoteDraftStatus: 'loading' | 'loaded' | 'error';
    remoteDraftError: string;
    continueRecoveredDraft: () => void;
    discardRecoveredDraft: () => void;
}

export const useManualQuizWorkspaceRecovery = ({
    username,
    quizId,
    availableQuiz,
    seed,
    workspaceStartedAt,
    requestedDraftId,
    isReadOnly,
    editorAccessStatus,
    envelope,
    hydrateEnvelope,
    initializeFromQuiz,
    initializeFromSeed,
}: UseManualQuizWorkspaceRecoveryOptions): ManualQuizWorkspaceRecovery => {
    const [pendingRecovery, setPendingRecovery] = useState<ManualQuizDraftEnvelope | null>(null);
    const [recoveryChecked, setRecoveryChecked] = useState(false);
    const [remoteDraftStatus, setRemoteDraftStatus] = useState<'loading' | 'loaded' | 'error'>(
        requestedDraftId ? 'loading' : 'loaded',
    );
    const [remoteDraftError, setRemoteDraftError] = useState('');

    useEffect(() => {
        if (!username || !requestedDraftId || envelope || remoteDraftStatus !== 'loading') return;
        if (quizId && editorAccessStatus !== 'loaded') return;
        if (isReadOnly) {
            setRemoteDraftStatus('loaded');
            return;
        }
        const controller = new AbortController();
        setRemoteDraftError('');

        void getRemoteManualQuizDraft(requestedDraftId, controller.signal)
            .then((record) => {
                if (controller.signal.aborted) return;
                hydrateEnvelope({
                    ...(record.draft as ManualQuizDraftEnvelope),
                    draftId: record.id,
                    quizId: record.quizId,
                    ownerUsername: record.ownerUsername,
                    revision: record.revision,
                    updatedAt: record.updatedAt,
                });
                setRemoteDraftStatus('loaded');
                setRecoveryChecked(true);
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setRemoteDraftError(error instanceof Error ? error.message : 'Không thể mở bản nháp đã chọn.');
                setRemoteDraftStatus('error');
            });

        return () => controller.abort();
    }, [editorAccessStatus, envelope, hydrateEnvelope, isReadOnly, quizId, remoteDraftStatus, requestedDraftId, username]);

    useEffect(() => {
        if (!username || envelope || pendingRecovery || recoveryChecked) return;
        if (quizId && editorAccessStatus !== 'loaded') return;
        if (requestedDraftId && remoteDraftStatus !== 'error') return;

        if (!isReadOnly) {
            const latestDraft = findLatestLocalDraft(username, quizId);
            const isNewerThanCurrentEntry = latestDraft
                && (!workspaceStartedAt || latestDraft.updatedAt > workspaceStartedAt);

            if (latestDraft && isNewerThanCurrentEntry) {
                setPendingRecovery(latestDraft);
                setRecoveryChecked(true);
                return;
            }
        }

        setRecoveryChecked(true);
        if (availableQuiz) {
            initializeFromQuiz(availableQuiz, username);
        } else {
            initializeFromSeed(seed, username);
        }
    }, [
        availableQuiz,
        editorAccessStatus,
        envelope,
        initializeFromQuiz,
        initializeFromSeed,
        isReadOnly,
        workspaceStartedAt,
        pendingRecovery,
        quizId,
        recoveryChecked,
        remoteDraftStatus,
        requestedDraftId,
        seed,
        username,
    ]);

    const continueRecoveredDraft = () => {
        if (!pendingRecovery) return;
        hydrateEnvelope(pendingRecovery);
        setPendingRecovery(null);
    };

    const discardRecoveredDraft = () => {
        if (!pendingRecovery || !username) return;
        removeLocalDraft(username, pendingRecovery.draftId);
        setPendingRecovery(null);
        if (availableQuiz) {
            initializeFromQuiz(availableQuiz, username);
        } else {
            initializeFromSeed(seed, username);
        }
    };

    return {
        pendingRecovery,
        remoteDraftStatus,
        remoteDraftError,
        continueRecoveredDraft,
        discardRecoveredDraft,
    };
};
